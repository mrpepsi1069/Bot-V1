import { SlashCommandBuilder, EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder } from 'discord.js';
import { PlayerStats, Team, GuildConfig } from '../models/index.js';

const POSITIONS = ['QB', 'WR', 'CB', 'DE', 'K'];
const POSITION_DISPLAY = { QB: 'QB', WR: 'WR', CB: 'CB', DE: 'DE', K: 'Kicker' };

export const data = new SlashCommandBuilder()
  .setName('stat')
  .setDescription('View player statistics')
  .addStringOption(opt => opt.setName('subcommand').setDescription('Choose a subcommand')
    .addChoices(
      { name: 'Leaderboard', value: 'leaderboard' },
      { name: 'Add QB Stats', value: 'addqb' },
      { name: 'Add WR Stats', value: 'addwr' },
      { name: 'Add CB Stats', value: 'addcb' },
      { name: 'Add DE Stats', value: 'addde' },
      { name: 'Add Kicker Stats', value: 'addk' }
    ));

// Set leaderboard command
export const data_lb = new SlashCommandBuilder()
  .setName('setleaderboard')
  .setDescription('Post leaderboards to a channel')
  .addChannelOption(opt => opt.setName('channel').setDescription('Channel to post to').setRequired(true));

export async function execute_lb(interaction) {
  if (!interaction.member.permissions.has('Administrator') && !interaction.member.permissions.has('ManageGuild')) {
    return interaction.reply({ content: '❌ You need Administrator or Manage Server permission to use this command.', ephemeral: true });
  }
  await interaction.deferReply({ ephemeral: true });
  
  const channel = interaction.options.getChannel('channel');
  const teams = await Team.find(interaction.guildId);
  
  if (!teams || teams.length === 0) {
    return interaction.editReply({ content: 'No teams found.' });
  }
  
  const config = await GuildConfig.findOne(interaction.guildId);
  const leagueName = config?.server_name || 'League';
  
  const sorted = [...teams].sort((a, b) => {
    const aw = a.wins || 0;
    const bw = b.wins || 0;
    if (aw !== bw) return bw - aw;
    return (b.pointDiff || 0) - (a.pointDiff || 0);
  });
  
  const lines = sorted.map((t, i) => {
    const wins = t.wins || 0;
    const losses = t.losses || 0;
    const pd = t.pointDiff || 0;
    const pdStr = pd >= 0 ? `+${pd}` : `${pd}`;
    const rank = (i + 1).toString().padStart(2, '0');
    const roleMention = t.roleId ? `<@&${t.roleId}>` : `**${t.teamName || t.name}**`;
    const emoji = t.teamEmoji || '';
    const space = emoji ? ' ' : '';
    return `${emoji}${space}\`${rank}\` | ${roleMention} | **${wins}-${losses}** | \`${pdStr}\``;
  });
  
  const embed = new EmbedBuilder()
    .setTitle(`${leagueName} Standings`)
    .setDescription(`**League Standings**\n\n${lines.join('\n')}\n_Stats pulled from /gamereport, /scorereport, and /forfeit_`)
    .setColor(0xFFD700)
    .setFooter({ text: 'Standings auto-update' })
    .setTimestamp();
  
  await channel.send({ embeds: [embed] });
  
  return interaction.editReply({ content: `✅ Standings posted to ${channel}!` });
}

export async function execute(interaction) {
  const subcommand = interaction.options.getString('subcommand');

  // Leaderboard - show position select
  if (subcommand === 'leaderboard' || !subcommand) {
    const select = new StringSelectMenuBuilder()
      .setCustomId('stat_lb_select')
      .setPlaceholder('Select a position')
      .addOptions(POSITIONS.map(p => ({ label: POSITION_DISPLAY[p], value: p.toLowerCase() })));

    return interaction.reply({ content: 'Select a position for the leaderboard:', components: [new ActionRowBuilder().addComponents(select)], ephemeral: true });
  }

  // Add stat commands - get roblox username and stat value
  if (subcommand?.startsWith('add')) {
    const position = subcommand.replace('add', '').toUpperCase();
    return interaction.reply({
      content: `Use /add${position.toLowerCase()}stat to add ${POSITION_DISPLAY[position]} stats.`,
      ephemeral: true
    });
  }
}

// Individual add stat commands
export const data_qb = new SlashCommandBuilder()
  .setName('addqbstat')
  .setDescription('Add QB statistics')
  .addStringOption(opt => opt.setName('roblox_user').setDescription('Roblox username').setRequired(true))
  .addIntegerOption(opt => opt.setName('touchdowns').setDescription('Touchdowns').setRequired(true));

export async function execute_qb(interaction) {
  const robloxUser = interaction.options.getString('roblox_user');
  const touchdowns = interaction.options.getInteger('touchdowns');

  await PlayerStats.findOneAndUpdate(interaction.guildId, robloxUser, 'qb', { $set: { touchdowns } });
  
  return interaction.reply({
    embeds: [new EmbedBuilder().setTitle('✅ QB Stats Added').setDescription(`${robloxUser}: ${touchdowns} TDs`).setColor(0x00CC66)],
    ephemeral: true
  });
}

export const data_wr = new SlashCommandBuilder()
  .setName('addwrstat')
  .setDescription('Add WR statistics')
  .addStringOption(opt => opt.setName('roblox_user').setDescription('Roblox username').setRequired(true))
  .addIntegerOption(opt => opt.setName('receptions').setDescription('Receptions').setRequired(true))
  .addIntegerOption(opt => opt.setName('receiving_yards').setDescription('Receiving Yards'));

export async function execute_wr(interaction) {
  const robloxUser = interaction.options.getString('roblox_user');
  const receptions = interaction.options.getInteger('receptions');
  const receivingYards = interaction.options.getInteger('receiving_yards') || 0;

  await PlayerStats.findOneAndUpdate(interaction.guildId, robloxUser, 'wr', { $set: { receptions, receivingYards } });
  
  return interaction.reply({
    embeds: [new EmbedBuilder().setTitle('✅ WR Stats Added').setDescription(`${robloxUser}: ${receptions} rec, ${receivingYards} yds`).setColor(0x00CC66)],
    ephemeral: true
  });
}

export const data_cb = new SlashCommandBuilder()
  .setName('addcbstat')
  .setDescription('Add CB statistics')
  .addStringOption(opt => opt.setName('roblox_user').setDescription('Roblox username').setRequired(true))
  .addIntegerOption(opt => opt.setName('interceptions').setDescription('Interceptions').setRequired(true));

export async function execute_cb(interaction) {
  const robloxUser = interaction.options.getString('roblox_user');
  const interceptions = interaction.options.getInteger('interceptions');

  await PlayerStats.findOneAndUpdate(interaction.guildId, robloxUser, 'cb', { $set: { interceptions } });
  
  return interaction.reply({
    embeds: [new EmbedBuilder().setTitle('✅ CB Stats Added').setDescription(`${robloxUser}: ${interceptions} INTs`).setColor(0x00CC66)],
    ephemeral: true
  });
}

export const data_de = new SlashCommandBuilder()
  .setName('adddestat')
  .setDescription('Add DE statistics')
  .addStringOption(opt => opt.setName('roblox_user').setDescription('Roblox username').setRequired(true))
  .addIntegerOption(opt => opt.setName('sacks').setDescription('Sacks').setRequired(true));

export async function execute_de(interaction) {
  const robloxUser = interaction.options.getString('roblox_user');
  const sacks = interaction.options.getInteger('sacks');

  await PlayerStats.findOneAndUpdate(interaction.guildId, robloxUser, 'de', { $set: { sacks } });
  
  return interaction.reply({
    embeds: [new EmbedBuilder().setTitle('✅ DE Stats Added').setDescription(`${robloxUser}: ${sacks} sacks`).setColor(0x00CC66)],
    ephemeral: true
  });
}

export const data_k = new SlashCommandBuilder()
  .setName('addkstat')
  .setDescription('Add Kicker statistics')
  .addStringOption(opt => opt.setName('roblox_user').setDescription('Roblox username').setRequired(true))
  .addIntegerOption(opt => opt.setName('field_goals').setDescription('Field Goals Made').setRequired(true))
  .addIntegerOption(opt => opt.setName('extra_points').setDescription('Extra Points'));

export async function execute_k(interaction) {
  const robloxUser = interaction.options.getString('roblox_user');
  const fieldGoals = interaction.options.getInteger('field_goals');
  const extraPoints = interaction.options.getInteger('extra_points') || 0;

  await PlayerStats.findOneAndUpdate(interaction.guildId, robloxUser, 'k', { $set: { fieldGoals, extraPoints } });
  
  return interaction.reply({
    embeds: [new EmbedBuilder().setTitle('✅ Kicker Stats Added').setDescription(`${robloxUser}: ${fieldGoals} FGs, ${extraPoints} XPs`).setColor(0x00CC66)],
    ephemeral: true
  });
}