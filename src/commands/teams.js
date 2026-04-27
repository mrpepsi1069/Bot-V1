import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { Team, GuildConfig } from '../models/index.js';
import { canManageTeam, getTeamThumbnail, setGuildHeader } from '../utils/permissions.js';

export const data = new SlashCommandBuilder()
  .setName('addteam')
  .setDescription('Add a new team')
  .addRoleOption(opt => opt.setName('team_role').setDescription('The role that represents this team').setRequired(true))
  .addStringOption(opt => opt.setName('team_emoji').setDescription('Emoji for the team').setRequired(true));

export async function execute(interaction) {
  try {
    const teamRole = interaction.options.getRole('team_role');
    const teamEmoji = interaction.options.getString('team_emoji');

    const existing = await Team.findOne(interaction.guildId, { roleId: teamRole.id.toString() });
    if (existing) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setDescription(`❌ ${teamRole} is already a registered team.`)
          .setColor(0xFF4444)
        ],
        ephemeral: true
      });
    }

    await Team.create(interaction.guildId, teamRole.id.toString(), teamRole.name, teamEmoji);

    const embed = new EmbedBuilder()
      .setTitle('✅ Team Added')
      .setColor(0x00CC66)
      .addFields(
        { name: 'Team', value: `${teamEmoji} **${teamRole.name}**`, inline: true },
        { name: 'Role', value: teamRole.toString(), inline: true },
        { name: 'Emoji', value: teamEmoji, inline: true }
      )
      .setFooter({ text: `By ${interaction.client.user.username}` });

    return interaction.reply({ embeds: [embed] });
  } catch (err) {
    console.error('[Teams Command Error]', err);
    await interaction.reply({ content: `❌ An error occurred: ${err.message}`, ephemeral: true });
  }
}

// disband command
export const data2 = new SlashCommandBuilder()
  .setName('disband')
  .setDescription('Disband a team (removes all players and coaches)')
  .addRoleOption(opt => opt.setName('team_role').setDescription('The team to disband').setRequired(true));

export async function execute2(interaction) {
  await interaction.deferReply({ ephemeral: true });
  
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

  const roster = team.roster || [];
  const coachesDict = team.coaches || {};
  
  async function getMember(userId) {
    if (!userId) return null;
    try {
      return await interaction.guild.members.fetch(userId);
    } catch { return null; }
  }

  const oldFo = await getMember(coachesDict.franchise_owner);
  const oldGm = await getMember(coachesDict.general_manager);
  const oldHc = await getMember(coachesDict.head_coach);
  const oldAc = await getMember(coachesDict.assistant_coach);

  // Remove players from team role
  for (const playerId of roster) {
    const member = await getMember(playerId);
    if (member && member.roles.cache.has(teamRole.id)) {
      try { await member.roles.remove(teamRole); } catch {}
    }
  }

  // Remove coaches
  for (const coachId of Object.values(coachesDict)) {
    if (!coachId) continue;
    const member = await getMember(coachId);
    if (member) {
      if (member.roles.cache.has(teamRole.id)) {
        try { await member.roles.remove(teamRole); } catch {}
      }
      for (const roleId of Object.values(franchiseRoles)) {
        if (roleId && member.roles.cache.has(roleId)) {
          try { await member.roles.remove(roleId); } catch {}
        }
      }
    }
  }

  await Team.updateOne(team._id.toString(), {
    $set: {
      roster: [],
      'coaches.franchise_owner': null,
      'coaches.general_manager': null,
      'coaches.head_coach': null,
      'coaches.assistant_coach': null,
    }
  });

  const teamEmoji = team.teamEmoji || '';
  const teamName = team.teamName || '';
  
  function formatCoach(member) {
    if (member) return `${member}\n\`${member.displayName}\``;
    return '`None None`';
  }

  const embed = new EmbedBuilder()
    .setTitle('Franchise Disbanding Report')
    .setColor(teamRole.color)
    .setAuthor({ name: `${interaction.guild.name} Transactions`, iconURL: interaction.guild.iconURL() })
    .addFields(
      { name: '**Franchise Disbanded:**', value: `${teamEmoji} ${teamRole}`, inline: false },
      { name: '**Former Franchise Owner:**', value: formatCoach(oldFo), inline: true },
      { name: '**Former General Manager:**', value: formatCoach(oldGm), inline: true },
      { name: '**Former Head Coach:**', value: formatCoach(oldHc), inline: true },
      { name: '**Former Assistant Coach:**', value: formatCoach(oldAc), inline: true },
      { name: '**Total Players Released:**', value: roster.length.toString(), inline: true },
      { name: '**Responsible Admin:**', value: `${interaction.user}\n\`${interaction.user.displayName}\``, inline: true }
    )
    .setThumbnail(getTeamThumbnail(teamEmoji))
    .setFooter({ text: `${interaction.user.displayName} • Today`, iconURL: interaction.user.displayAvatarURL() });

  const alertsId = config?.channels?.alerts;
  if (alertsId) {
    const channel = interaction.guild.channels.cache.get(alertsId);
    if (channel) await channel.send({ embeds: [embed] });
  }

  return interaction.followUp({
    embeds: [new EmbedBuilder()
      .setTitle('Franchise Disbanded')
      .setDescription(`You disbanded **${teamName}**.\n\nAll players and coaches have been removed.`)
      .setColor(0xFF4444)
      .setFooter({ text: `By ${interaction.client.user.username}` })
    ],
    ephemeral: true
  });
}

// removeteam command
export const data4 = new SlashCommandBuilder()
  .setName('removeteam')
  .setDescription('Remove a team from the league')
  .addRoleOption(opt => opt.setName('team_role').setDescription('The team to remove').setRequired(true));

export async function execute4(interaction) {
  await interaction.deferReply({ ephemeral: true });
  
  const teamRole = interaction.options.getRole('team_role');
  const team = await Team.findOne(interaction.guildId, { roleId: teamRole.id.toString() });
  
  if (!team) {
    return interaction.followUp({
      embeds: [new EmbedBuilder().setDescription(`❌ ${teamRole} is not a registered team.`).setColor(0xFF4444)],
      ephemeral: true
    });
  }

  const teamName = team.teamName || teamRole.name;
  await Team.deleteOne(team._id.toString());

  return interaction.followUp({
    embeds: [new EmbedBuilder()
      .setTitle('Team Removed')
      .setDescription(`Removed **${teamName}** from the league.`)
      .setColor(0x00CC66)
      .setFooter({ text: `By ${interaction.client.user.username}` })
    ],
    ephemeral: true
  });
}

// release command - coaches can release players
export const data3 = new SlashCommandBuilder()
  .setName('release')
  .setDescription('Release a player from your team')
  .addUserOption(opt => opt.setName('player').setDescription('The player to release').setRequired(true));

export async function execute3(interaction) {
  await interaction.deferReply({ ephemeral: true });
  
  const target = interaction.options.getUser('player');
  const result = await canManageTeam(interaction.guildId, interaction.user.id.toString(), interaction.member);
  
  if (!result.allowed || !result.team) {
    return interaction.followUp({
      embeds: [new EmbedBuilder().setDescription('❌ You must be at least a Head Coach to release players.').setColor(0xFF4444)],
      ephemeral: true
    });
  }
  
  const team = result.team;
  
  if (!(team.roster || []).includes(target.id.toString())) {
    return interaction.followUp({
      embeds: [new EmbedBuilder().setDescription(`❌ ${target} is not on your team.`).setColor(0xFF4444)],
      ephemeral: true
    });
  }
  
  const teamRole = interaction.guild.roles.cache.get(team.roleId);
  const teamEmoji = team.teamEmoji || '';
  const teamName = team.teamName || '';
  
  await Team.updateOne(team._id.toString(), { $pull: { roster: target.id.toString() } });
  
  if (teamRole) {
    try {
      const guildMember = await interaction.guild.members.fetch(target.id);
      if (guildMember) await guildMember.roles.remove(teamRole);
    } catch {}
  }
  
  const config = await GuildConfig.findOne(interaction.guildId);
  
  const txEmbed = new EmbedBuilder()
    .setTitle('Released')
    .setDescription(`${teamEmoji} ${teamName} has released ${target}`)
    .setColor(teamRole?.color || 0x5865F2);
  
  setGuildHeader(txEmbed, interaction.guild);
  const thumbUrl = getTeamThumbnail(teamEmoji);
  if (thumbUrl) txEmbed.setThumbnail(thumbUrl);
  txEmbed.setFooter({ text: `${interaction.user.displayName} • Today at ${new Date().toLocaleTimeString()}`, iconURL: interaction.user.displayAvatarURL() });
  
  const txId = config?.channels?.transactions;
  if (txId) {
    const ch = interaction.guild.channels.cache.get(txId);
    if (ch) await ch.send({ embeds: [txEmbed] });
  }
  
  return interaction.followUp({
    embeds: [new EmbedBuilder()
      .setTitle('✅ Released')
      .setDescription(`Released **${target}** from **${teamName}**.`)
      .setColor(0x00CC66)
      .setFooter({ text: `By ${interaction.client.user.username}` })
    ],
    ephemeral: true
  });
}