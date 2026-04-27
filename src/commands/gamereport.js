import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Team, GuildConfig, GameReport, PendingReport } from '../models/index.js';
import { canManageTeam, getMemberRank, getTeamThumbnail, Rank, RANK_DISPLAY } from '../utils/permissions.js';

// Maps rank → franchise_roles key so we can look up the role ID for the "Reported By" field
const RANK_TO_COACH_KEY = {
  [Rank.FRANCHISE_OWNER]: 'franchise_owner',
  [Rank.GENERAL_MANAGER]: 'general_manager',
  [Rank.HEAD_COACH]:      'head_coach',
  [Rank.ASSISTANT_COACH]: 'assistant_coach',
};

export const data = new SlashCommandBuilder()
  .setName('gamereport')
  .setDescription('Submit a game score report')
  .addRoleOption(opt    => opt.setName('yourteam').setDescription('Your team role').setRequired(true))
  .addRoleOption(opt    => opt.setName('oppteam').setDescription('Opponent team role').setRequired(true))
  .addIntegerOption(opt => opt.setName('yourscore').setDescription('Your team score').setRequired(true))
  .addIntegerOption(opt => opt.setName('oppscore').setDescription('Opponent score').setRequired(true))
  .addAttachmentOption(opt => opt.setName('stats').setDescription('Optional JSON stats file'));

export async function execute(interaction) {
  try {
    const { allowed, team } = await canManageTeam(
      interaction.guildId,
      interaction.user.id.toString(),
      interaction.member
    );

    if (!allowed || !team) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setDescription('❌ You must be a General Manager or higher to submit a game report.')
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
    const yourEmoji    = yourTeamData?.teamEmoji || '';
    const oppEmoji     = oppTeamData?.teamEmoji  || '';

    const winner = yourScore > oppScore ? yourTeamName
                 : oppScore > yourScore ? oppTeamName
                 : 'TIE';

    // Get the reporter's coach role mention for the "Reported By" field
    const config       = await GuildConfig.findOne(interaction.guildId);
    const { rank }     = await getMemberRank(interaction.guildId, interaction.user.id.toString(), interaction.member);
    const coachKey     = RANK_TO_COACH_KEY[rank];
    const coachRoleId  = coachKey ? config?.franchise_roles?.[coachKey] : null;
    const coachMention = coachRoleId ? `<@&${coachRoleId}>` : (RANK_DISPLAY[rank] || 'Coach');
    const discordName = interaction.user.username;

    const teamColor    = interaction.guild.roles.cache.get(yourTeamRole.id)?.color || 0x5865F2;
    const thumbnailUrl = getTeamThumbnail(yourEmoji);
    const nowUnix      = Math.floor(Date.now() / 1000);
    const nowDisplay   = new Date().toLocaleString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

    // Build the pending embed (Status: Pending)
    const embed = buildScoreEmbed({
      title: 'Score Report',
      yourEmoji, yourTeamRole, yourScore,
      oppEmoji, oppTeamRole, oppScore,
      coachMention,
      userId: interaction.user.id,
      discordName,
      nowUnix,
      nowDisplay,
      teamColor,
      thumbnailUrl,
      finalized: false,
    });

    // Save pending report to DB
    const staffChannelId = config?.channels?.staff_channel;
    const scoresChannelId = config?.channels?.scores;

    const pending = await PendingReport.create({
      guildId:      interaction.guildId,
      type:         'score',
      yourTeamName,
      oppTeamName,
      yourScore,
      oppScore,
      winner,
      yourEmoji,
      oppEmoji,
      yourTeamRoleId: yourTeamRole.id,
      oppTeamRoleId:  oppTeamRole.id,
      coachMention,
      userId:       interaction.user.id,
      discordName,
      nowDisplay,
      teamColor,
      thumbnailUrl,
      scoresChannelId,
      jsonData:     jsonData ? { json: jsonData } : null,
    });

    const finalizeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`finalize_report:${pending._id.toString()}`)
        .setLabel('✅ Finalize Report')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`reject_report:${pending._id.toString()}`)
        .setLabel('❌ Reject')
        .setStyle(ButtonStyle.Danger)
    );

    // Post to staff channel if configured, otherwise fall back to current channel
    if (staffChannelId) {
      const staffChannel = interaction.guild.channels.cache.get(staffChannelId);
      if (staffChannel) {
        await staffChannel.send({ embeds: [embed], components: [finalizeRow] });
        return interaction.followUp({ content: `✅ Game report sent to <#${staffChannelId}> for review.`, ephemeral: true });
      }
    }

    // Fallback: no staff channel configured
    await interaction.channel.send({ embeds: [embed], components: [finalizeRow] });
    return interaction.followUp({ content: '✅ Game report submitted. (Tip: set a Staff Channel in `/panel` for a private review flow.)', ephemeral: true });

  } catch (err) {
    console.error('[Gamereport Error]', err);
    try {
      await interaction.followUp({ content: `❌ An error occurred: ${err.message}`, ephemeral: true });
    } catch {}
  }
}

// ─── Shared embed builder (used by gamereport and finalize handler) ───────────

export function buildScoreEmbed({ title, yourEmoji, yourTeamRole, yourScore, oppEmoji, oppTeamRole, oppScore, coachMention, userId, discordName, nowUnix, nowDisplay, teamColor, thumbnailUrl, finalized, isForfeit = false }) {
  const scoreDisplay = isForfeit
    ? `> ${yourEmoji} <@&${yourTeamRole.id ?? yourTeamRole}> **${yourScore}** - **${oppScore}** <@&${oppTeamRole.id ?? oppTeamRole}> ${oppEmoji}\n> *(Forfeit)*`
    : `> ${yourEmoji} <@&${yourTeamRole.id ?? yourTeamRole}> **${yourScore}** - **${oppScore}** <@&${oppTeamRole.id ?? oppTeamRole}> ${oppEmoji}`;

  const statusValue = finalized ? '> ✅ Finalized' : '> ⏳ Pending Finalization';

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(teamColor)
    .addFields(
      { name: '\u200b',          value: `⏰ <t:${nowUnix}:R>`,                                                 inline: false },
      { name: 'Final Score:',    value: scoreDisplay,                                                          inline: false },
      { name: 'Reported By:',    value: `> ${coachMention} <@${userId}>`,                                       inline: false },
      { name: 'Status:',         value: statusValue,                                                           inline: false },
    )
    .setFooter({ text: `${discordName} • ${nowDisplay}` });

  if (thumbnailUrl) embed.setThumbnail(thumbnailUrl);
  return embed;
}
