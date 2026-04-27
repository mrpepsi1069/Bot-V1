import { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import { Team, GuildConfig } from '../models/index.js';
import { canManageTeam, getMemberRank, Rank, getTeamThumbnail, setGuildHeader } from '../utils/permissions.js';

export const data = new SlashCommandBuilder()
  .setName('sign')
  .setDescription('Force sign a player')
  .addUserOption(opt => opt.setName('target').setDescription('The player to sign').setRequired(true));

export const data_offer = new SlashCommandBuilder()
  .setName('offer')
  .setDescription('Send an offer to another player')
  .addUserOption(opt => opt.setName('target').setDescription('The player to offer').setRequired(true));

export const data_demand = new SlashCommandBuilder()
  .setName('demand')
  .setDescription('Demand a release from your current team');

function getThumbnail(teamEmoji) {
  if (!teamEmoji) return null;
  const match = teamEmoji.match(/<:(.+):(\d+)>/);
  if (match) return `https://cdn.discordapp.com/emojis/${match[2]}.png`;
  return null;
}

export async function execute(interaction) {
  const config = await GuildConfig.findOne(interaction.guildId);
  const signingMode = config?.signings?.mode || 'offer';

  if (signingMode === 'sign') {
    return signExecute(interaction);
  }

  return interaction.reply({ content: '❌ Signing mode is set to Offer. Use /offer instead.', flags: 64 });
}

export async function execute_offer(interaction) {
  return offerExecute(interaction);
}

export async function execute_demand(interaction) {
  return demandExecute(interaction);
}

async function signExecute(interaction) {
  try {
    const target = interaction.options.getUser('target');

    if (target.bot) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setDescription('❌ You cannot sign a bot.').setColor(0xFF4444)],
        flags: 64
      });
    }

    const config = await GuildConfig.findOne(interaction.guildId);
    const verifiedRoleId = config?.server_roles?.verified;
    if (verifiedRoleId) {
      const guildMember = await interaction.guild.members.fetch(target.id);
      if (!guildMember?.roles.cache.has(verifiedRoleId)) {
        return interaction.reply({
          embeds: [new EmbedBuilder().setDescription('❌ Target player must have the Verified role to be signed.').setColor(0xFF4444)],
          flags: 64
        });
      }
    }

    const result = await canManageTeam(interaction.guildId, interaction.user.id.toString(), interaction.member);
    if (!result.allowed || !result.team) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setDescription('❌ You must be at least a Head Coach to sign players.').setColor(0xFF4444)],
        flags: 64
      });
    }

    const team = result.team;

    if (config?.signings?.enabled === false) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setDescription('❌ Signings are currently disabled.').setColor(0xFF4444)],
        flags: 64
      });
    }

    const cap = config?.signings?.rosterCap || 0;
    if (cap && (team.roster || []).length >= cap) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setDescription(`❌ Your roster is full (${cap} players max).`).setColor(0xFF4444)],
        flags: 64
      });
    }

    await Team.updateOne(team._id.toString(), { $addToSet: { roster: target.id.toString() } });

    const teamRole = interaction.guild.roles.cache.get(team.roleId);
    if (teamRole) {
      try {
        const guildMember = await interaction.guild.members.fetch(target.id);
        if (guildMember) await guildMember.roles.add(teamRole);
      } catch {}
    }

    const teamColor = teamRole?.color || 0x5865F2;

    const signEmbed = new EmbedBuilder()
      .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() })
      .setTitle('**You have been Signed!**')
      .setDescription(`You've been signed in **${interaction.guild.name}** by the ${team.teamEmoji || ''} ${team.teamName || ''}. If you believe this was done in error, use /demand to leave the team.`)
      .addFields({ name: '\u200b', value: `> • **Coach** - ${interaction.user} ${interaction.user.displayName}` })
      .setThumbnail(getThumbnail(team.teamEmoji || ''))
      .setFooter({ text: `By ${interaction.client.user.username}` });

    try {
      const dm = await target.createDM();
      await dm.send({ embeds: [signEmbed] });
    } catch (err) {
      console.error('[Sign] Failed to DM target:', err.message);
    }

    const capDisplay = config?.signings?.rosterCap || '∞';
    const updatedTeam = await Team.findOne(interaction.guildId, { _id: team._id });

    const txEmbed = new EmbedBuilder()
      .setTitle('Signed')
      .setDescription(`${team.teamEmoji || ''} ${team.teamName || ''} has signed ${target}`)
      .setColor(teamColor);

    setGuildHeader(txEmbed, interaction.guild);

    const thumbUrl = getThumbnail(team.teamEmoji || '');
    if (thumbUrl) txEmbed.setThumbnail(thumbUrl);

    txEmbed.addFields({
      name: '\u200b',
      value: `> **Coach:** ${interaction.user} ${interaction.user.displayName}\n> **Roster:** ${(updatedTeam?.roster || []).length}/${capDisplay}`,
      inline: false
    });
    txEmbed.setFooter({ text: `${interaction.user.displayName} • Today at ${new Date().toLocaleTimeString()}`, iconURL: interaction.user.displayAvatarURL() });

    const txId = config?.channels?.transactions;
    if (txId) {
      const ch = interaction.guild.channels.cache.get(txId);
      if (ch) await ch.send({ embeds: [txEmbed] });
    }

    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setTitle('✅ Signed')
        .setDescription(`You have signed ${target} to **${team.teamName || ''}**.`)
        .setColor(teamColor)
        .setFooter({ text: `By ${interaction.client.user.username}` })
      ],
      flags: 64
    });
} catch (err) {
    console.error('[Sign] Error:', err.message);
    try {
      await interaction.reply({ content: `❌ An error occurred: ${err}`, flags: 64 });
    } catch {}
  }
}

async function offerExecute(interaction) {
  try {
    const target = interaction.options.getUser('target');
    if (target.bot) {
      return interaction.reply({ content: '❌ You cannot offer a bot.', flags: 64 });
    }

    const config = await GuildConfig.findOne(interaction.guildId);
    const signingMode = config?.signings?.mode;
    if (signingMode === 'sign') {
      return interaction.reply({ content: '❌ Signing mode is set to Sign. Use /sign instead.', flags: 64 });
    }

    const verifiedRoleId = config?.server_roles?.verified;
    if (verifiedRoleId) {
      const guildMember = await interaction.guild.members.fetch(target.id);
      if (!guildMember?.roles.cache.has(verifiedRoleId)) {
        return interaction.reply({ content: '❌ Target player must have the Verified role to receive an offer.', flags: 64 });
      }
    }

    const result = await canManageTeam(interaction.guildId, interaction.user.id.toString(), interaction.member);
    if (!result.allowed || !result.team) {
      return interaction.reply({ content: '❌ You must be at least a Head Coach to send offers.', flags: 64 });
    }

    const team = result.team;

    if (config?.signings?.enabled === false) {
      return interaction.reply({ content: '❌ Signings are currently disabled.', flags: 64 });
    }

    const cap = config?.signings?.rosterCap || 0;
    if (cap && (team.roster || []).length >= cap) {
      return interaction.reply({ content: `❌ Your roster is full (${cap} players max).`, flags: 64 });
    }

    const teamRole = interaction.guild.roles.cache.get(team.roleId);
    const teamColor = teamRole?.color || 0x5865F2;

    const embed = new EmbedBuilder()
      .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() })
      .setTitle('**You have Received an Offer!**')
      .setDescription(`${team.teamEmoji || ''} **${team.teamName || ''}** wants to sign you!\n\nReact below to accept or decline.`)
      .addFields({ name: '\u200b', value: `> **Coach:** ${interaction.user}` })
      .setThumbnail(getThumbnail(team.teamEmoji || ''))
      .setFooter({ text: `By ${interaction.client.user.username}` });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`offer_accept:${team._id}:${interaction.user.id}:${interaction.guildId}`)
        .setLabel('✅ Accept')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`offer_decline:${team._id}:${interaction.user.id}:${interaction.guildId}`)
        .setLabel('❌ Decline')
        .setStyle(ButtonStyle.Danger)
    );

    try {
      const dm = await target.createDM();
      await dm.send({ embeds: [embed], components: [row] });
    } catch (err) {
      console.error('[Offer] Failed to DM target:', err.message);
    }

    await interaction.reply({ content: `✅ Offer sent to ${target}.`, flags: 64 });
  } catch (err) {
    console.error('[Offer] Error:', err.message);
    try {
      await interaction.reply({ content: `❌ An error occurred: ${err}`, flags: 64 });
    } catch {}
  }
}

async function demandExecute(interaction) {
  try {
    const target = interaction.user;
    const teams = await Team.find(interaction.guildId);

    let currentTeam = null;
    let currentTeamData = null;
    for (const t of teams) {
      if ((t.roster || []).includes(target.id.toString())) {
        currentTeam = interaction.guild.roles.cache.get(t.roleId);
        currentTeamData = t;
        break;
      }
    }

    if (!currentTeam || !currentTeamData) {
      return interaction.reply({ content: '❌ You are not on any team.', flags: 64 });
    }

    const teamEmoji = currentTeamData.teamEmoji || '';
    const teamName = currentTeamData.teamName || '';
    const teamColor = currentTeam?.color || 0x5865F2;

    await Team.updateOne(currentTeamData._id.toString(), { $pull: { roster: target.id.toString() } });

    if (currentTeam) {
      try {
        await interaction.member.roles.remove(currentTeam);
      } catch {}
    }

    const config = await GuildConfig.findOne(interaction.guildId);
    
    const txEmbed = new EmbedBuilder()
      .setTitle('Released')
      .setDescription(`${teamEmoji} ${teamName} has released ${target}`)
      .setColor(teamColor);
    
    setGuildHeader(txEmbed, interaction.guild);
    const thumbUrl = getThumbnail(teamEmoji);
    if (thumbUrl) txEmbed.setThumbnail(thumbUrl);
    txEmbed.setFooter({ text: `${interaction.user.displayName} • Today at ${new Date().toLocaleTimeString()}`, iconURL: interaction.user.displayAvatarURL() });

    const txId = config?.channels?.transactions;
    if (txId) {
      const ch = interaction.guild.channels.cache.get(txId);
      if (ch) await ch.send({ embeds: [txEmbed] });
    }

    const embed = new EmbedBuilder()
      .setTitle('**Released**')
      .setDescription(`You have left ${teamName}.`)
      .setColor(0x00CC66);

    return interaction.reply({ embeds: [embed], flags: 64 });
  } catch (err) {
    console.error('[Demand] Error:', err.message);
    try {
      await interaction.reply({ content: `❌ An error occurred: ${err}`, flags: 64 });
    } catch {}
  }
}