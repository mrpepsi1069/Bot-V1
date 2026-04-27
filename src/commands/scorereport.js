import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { Team, GuildConfig, GameReport } from '../models/index.js';
import { canManageTeam, getMemberRank } from '../utils/permissions.js';

export const data = new SlashCommandBuilder()
  .setName('scorereport')
  .setDescription('Quick score report - saves directly to database')
  .addRoleOption(opt    => opt.setName('yourteam').setDescription('Your team role').setRequired(true))
  .addRoleOption(opt    => opt.setName('oppteam').setDescription('Opponent team role').setRequired(true))
  .addIntegerOption(opt => opt.setName('yourscore').setDescription('Your team score').setRequired(true))
  .addIntegerOption(opt => opt.setName('oppscore').setDescription('Opponent score').setRequired(true))
  .addAttachmentOption(opt => opt.setName('stats').setDescription('Optional JSON stats file'));

export async function execute(interaction) {
  try {
    const { allowed, team: yourTeam } = await canManageTeam(
      interaction.guildId,
      interaction.user.id.toString(),
      interaction.member
    );

    if (!allowed || !yourTeam) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setDescription('❌ You must be a General Manager or higher to submit a score report.')
          .setColor(0xFF4444)
        ],
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const yourTeamRole = interaction.options.getRole('yourteam');
    const oppTeamRole  = interaction.options.getRole('oppteam');
    const yourScore    = interaction.options.getInteger('yourscore');
    const oppScore     = interaction.options.getInteger('oppscore');
    const jsonStat     = interaction.options.getAttachment('stats');

    if (yourScore < 0 || oppScore < 0) {
      return interaction.followUp({ content: '❌ Scores cannot be negative.', ephemeral: true });
    }
    if (yourScore > 999 || oppScore > 999) {
      return interaction.followUp({ content: '❌ Scores must be 999 or less.', ephemeral: true });
    }

    // Parse optional JSON stats file
    let jsonData = null;
    if (jsonStat) {
      try {
        const response = await fetch(jsonStat.url);
        const text     = await response.text();
        const parts    = text.split('///');
        if (parts.length > 1) jsonData = JSON.parse(parts[1].trim());
      } catch (e) {
        console.log('[JSON Parse Error]', e);
      }
    }

    // Look up team data for display names / emojis
    const yourTeamData = await Team.findOne(interaction.guildId, { roleId: yourTeamRole.id.toString() });
    const oppTeamData  = await Team.findOne(interaction.guildId, { roleId: oppTeamRole.id.toString() });

    const yourTeamName = yourTeamData?.teamName || yourTeamRole.name;
    const oppTeamName  = oppTeamData?.teamName  || oppTeamRole.name;
    const yourEmoji   = yourTeamData?.teamEmoji || '';
    const oppEmoji    = oppTeamData?.teamEmoji  || '';

    const winner = yourScore > oppScore ? yourTeamName
                 : oppScore > yourScore ? oppTeamName
                 : 'TIE';

    // Save to database
    await GameReport.create(
      interaction.guildId,
      yourTeamName,
      oppTeamName,
      yourScore,
      oppScore,
      winner,
      jsonData,
      interaction.user.id
    );

    const embed = new EmbedBuilder()
      .setTitle('Score Saved')
      .setDescription(`> ${yourEmoji} **${yourTeamName}** ${yourScore} - ${oppScore} **${oppTeamName}** ${oppEmoji}\nWinner: ${winner}`)
      .setColor(0x00CC66);

    await interaction.followUp({ embeds: [embed], ephemeral: true });

  } catch (err) {
    console.error('[Scorereport Error]', err);
    try {
      await interaction.followUp({ content: `❌ An error occurred: ${err.message}`, ephemeral: true });
    } catch {}
  }
}