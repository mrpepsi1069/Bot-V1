import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { Team, GuildConfig } from '../models/index.js';
import { getTeamThumbnail } from '../utils/permissions.js';

export const data = new SlashCommandBuilder()
  .setName('roster')
  .setDescription('View a team\'s roster')
  .addRoleOption(opt => opt.setName('team').setDescription('The team role').setRequired(true));

export async function execute(interaction) {
  try {
    const team = interaction.options.getRole('team');
    const teamData = await Team.findOne(interaction.guildId, { roleId: team.id.toString() });
    if (!teamData) {
      return interaction.reply({
        content: 'Team not found. This role is not registered as a team.',
        ephemeral: true
      });
    }

    const config = await GuildConfig.findOne(interaction.guildId);
    const franchiseRoles = config?.franchise_roles || {};
    const cap = config?.signings?.rosterCap || 24;

    const teamColor = team.color || 0x5865F2;

    const rosterList = teamData.roster || [];
    const rosterCount = rosterList.length;

    const staffList = [];
    if (teamData.coaches?.franchise_owner) {
      const fo = await interaction.guild.members.fetch(teamData.coaches.franchise_owner);
      if (fo) {
        const roleMention = franchiseRoles.franchise_owner ? `<@&${franchiseRoles.franchise_owner}>` : '';
        staffList.push(`> ${roleMention} <@${fo.id}> \`${fo.displayName}\``);
      }
    }
    if (teamData.coaches?.general_manager) {
      const gm = await interaction.guild.members.fetch(teamData.coaches.general_manager);
      if (gm) {
        const roleMention = franchiseRoles.general_manager ? `<@&${franchiseRoles.general_manager}>` : '';
        staffList.push(`> ${roleMention} <@${gm.id}> \`${gm.displayName}\``);
      }
    }
    if (teamData.coaches?.head_coach) {
      const hc = await interaction.guild.members.fetch(teamData.coaches.head_coach);
      if (hc) {
        const roleMention = franchiseRoles.head_coach ? `<@&${franchiseRoles.head_coach}>` : '';
        staffList.push(`> ${roleMention} <@${hc.id}> \`${hc.displayName}\``);
      }
    }
    if (teamData.coaches?.assistant_coach) {
      const ac = await interaction.guild.members.fetch(teamData.coaches.assistant_coach);
      if (ac) {
        const roleMention = franchiseRoles.assistant_coach ? `<@&${franchiseRoles.assistant_coach}>` : '';
        staffList.push(`> ${roleMention} <@${ac.id}> \`${ac.displayName}\``);
      }
    }

    const playerList = [];
    for (const playerId of rosterList) {
      const player = await interaction.guild.members.fetch(playerId);
      if (player) {
        playerList.push(`> <@${player.id}> \`${player.displayName}\``);
      }
    }

    const embed = new EmbedBuilder()
      .setAuthor({ name: 'Team Roster', iconURL: interaction.guild.iconURL() })
      .setTitle(`**${teamData.teamName || ''}**`)
      .setDescription(`**Check ${teamData.teamName || ''} Roster ↓**\n\n**Roster:** ${rosterCount}/${cap}`)
      .addFields(
        { name: '\u200b', value: staffList.join('\n') || '> No staff assigned' },
        { name: '**Players**', value: playerList.join('\n') || '> No players on roster' }
      )
      .setThumbnail(getTeamThumbnail(teamData.teamEmoji || ''))
      .setColor(teamColor)
      .setFooter({ text: `By ${interaction.client.user.username}` });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (err) {
    console.error('[Roster Command Error]', err);
    return interaction.reply({ content: `Error: ${err}`, ephemeral: true });
  }
}