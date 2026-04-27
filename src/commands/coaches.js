import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { Team, GuildConfig } from '../models/index.js';

function getTeamThumbnail(teamEmoji) {
  if (!teamEmoji) return null;
  const match = teamEmoji.match(/<:(.+):(\d+)>/);
  if (match) return `https://cdn.discordapp.com/emojis/${match[2]}.png`;
  return null;
}

// Command 1: appoint
export const data = new SlashCommandBuilder()
  .setName('appoint')
  .setDescription('Appoint a member as Franchise Owner of a team')
  .addUserOption(opt => opt.setName('member').setDescription('The member to appoint').setRequired(true))
  .addRoleOption(opt => opt.setName('team_role').setDescription('The team to appoint them to').setRequired(true));

export async function execute(interaction) {
  if (!interaction.member.permissions.has('Administrator')) {
    return interaction.reply({ content: 'You must be an administrator to use this command.', ephemeral: true });
  }
  
  await interaction.deferReply({ ephemeral: true });
  
  const member = interaction.options.getMember('member');
  const teamRole = interaction.options.getRole('team_role');
  
  const team = await Team.findOne(interaction.guildId, { roleId: teamRole.id.toString() });
  if (!team) {
    return interaction.followUp({
      embeds: [new EmbedBuilder().setDescription(`❌ ${teamRole} is not a registered team.`).setColor(0xFF4444)],
      ephemeral: true
    });
  }
  
  const config = await GuildConfig.findOne(interaction.guildId);
  const franchiseRoles = config?.franchise_roles || {};
  
  await Team.updateOne(team._id.toString(), { $set: { 'coaches.franchise_owner': member.id.toString() } });
  
  const foRoleId = franchiseRoles.franchise_owner;
  if (foRoleId) {
    try {
      await member.roles.add(foRoleId);
    } catch(e) {
      console.error('[Appoint Error - FO Role]', e);
    }
  }

  try {
    await member.roles.add(teamRole);
  } catch(e) {
    console.error('[Appoint Error - Team Role]', e);
  }
  
  const teamEmoji = team.teamEmoji || '';
  const teamName = team.teamName || '';
  
  const embed = new EmbedBuilder()
    .setTitle('Appointment Report')
    .setColor(teamRole.color)
    .setAuthor({ name: `${interaction.guild.name} Transactions`, iconURL: interaction.guild.iconURL() })
    .addFields(
      { name: '**Team:**', value: `${teamEmoji} ${teamRole}`, inline: true },
      { name: '**New Franchise Owner:**', value: `${member}\n\`${member.displayName}\``, inline: true },
      { name: '**Responsible Admin:**', value: `${interaction.user}\n\`${interaction.user.displayName}\``, inline: true }
    )
    .setThumbnail(getTeamThumbnail(teamEmoji))
    .setFooter({ text: `${interaction.user.displayName} • Today`, iconURL: interaction.user.displayAvatarURL() });
  
  const alertsId = config?.channels?.alerts;
  if (alertsId) {
    const channel = interaction.guild.channels.cache.get(alertsId);
    if (channel) await channel.send({ embeds: [embed] });
  }
  
  await interaction.followUp({
    embeds: [new EmbedBuilder()
      .setTitle('✅ Franchise Owner Appointed')
      .setDescription(`You appointed ${member} as Franchise Owner of **${teamName}**.`)
      .setColor(0x00CC66)
    ],
    ephemeral: true
  });
}

// Promote command
export const data_promote = new SlashCommandBuilder()
  .setName('promote')
  .setDescription('Promote a member to a coaching position')
  .addUserOption(opt => opt.setName('member').setDescription('The member to promote').setRequired(true))
  .addRoleOption(opt => opt.setName('team_role').setDescription('Team role').setRequired(true))
  .addStringOption(opt => opt.setName('position').setDescription('Position')
    .addChoices(
      { name: 'General Manager', value: 'general_manager' },
      { name: 'Head Coach', value: 'head_coach' },
      { name: 'Assistant Coach', value: 'assistant_coach' }
    ).setRequired(true));

export async function execute_promote(interaction) {
  const member = interaction.options.getMember('member');
  const teamRole = interaction.options.getRole('team_role');
  const position = interaction.options.getString('position');
  
  const team = await Team.findOne(interaction.guildId, { roleId: teamRole.id.toString() });
  if (!team) {
    return interaction.reply({ content: `${teamRole} is not a registered team.`, ephemeral: true });
  }
  
  const config = await GuildConfig.findOne(interaction.guildId);
  const franchiseRoles = config?.franchise_roles || {};
  
  await Team.updateOne(team._id.toString(), { $set: { [`coaches.${position}`]: member.id.toString() } });
  
  const roleId = franchiseRoles[position];
  if (roleId) {
    try { await member.roles.add(roleId); } catch {}
  }
  
  const positionDisplay = { general_manager: 'General Manager', head_coach: 'Head Coach', assistant_coach: 'Assistant Coach' };
  
  return interaction.reply({
    embeds: [new EmbedBuilder()
      .setTitle('✅ Promoted')
      .setDescription(`${member} promoted to **${positionDisplay[position]}** of ${teamRole}`)
      .setColor(0x00CC66)
    ],
    ephemeral: true
  });
}

// Demote command
export const data_demote = new SlashCommandBuilder()
  .setName('demote')
  .setDescription('Demote a coach')
  .addUserOption(opt => opt.setName('member').setDescription('The coach to demote').setRequired(true))
  .addRoleOption(opt => opt.setName('team_role').setDescription('Team role').setRequired(true));

export async function execute_demote(interaction) {
  const member = interaction.options.getMember('member');
  const teamRole = interaction.options.getRole('team_role');
  
  const config = await GuildConfig.findOne(interaction.guildId);
  const franchiseRoles = config?.franchise_roles || {};
  
  // Find and remove coaching position
  let found = null;
  for (const [pos, id] of Object.entries(franchiseRoles)) {
    if (id && member.roles.cache.has(id)) {
      found = pos;
      try { await member.roles.remove(id); } catch {}
    }
  }
  
  // Remove from team
  const team = await Team.findOne(interaction.guildId, { roleId: teamRole.id.toString() });
  if (team) {
    for (const pos of ['franchise_owner', 'general_manager', 'head_coach', 'assistant_coach']) {
      if (team.coaches?.[pos] === member.id.toString()) {
        await Team.updateOne(team._id.toString(), { $set: { [`coaches.${pos}`]: null } });
      }
    }
  }
  
  return interaction.reply({
    embeds: [new EmbedBuilder()
      .setTitle('✅ Demoted')
      .setDescription(`${member} has been demoted.`)
      .setColor(0x00CC66)
    ],
    ephemeral: true
  });
}