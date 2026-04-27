import { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import { Team, GuildConfig } from '../models/index.js';
import { canManageTeam } from '../utils/permissions.js';

export const data = new SlashCommandBuilder()
  .setName('gametime')
  .setDescription('Post game time')
  .addStringOption(opt => opt.setName('oppteam').setDescription('Opponent team name').setRequired(true))
  .addStringOption(opt => opt.setName('time').setDescription('Game time (e.g., 8pm, 5:30pm)').setRequired(true))
  .addStringOption(opt => opt.setName('timezone').setDescription('Timezone (e.g., EST, PST)').setRequired(true));

export async function execute(interaction) {
  const result = await canManageTeam(interaction.guildId, interaction.user.id.toString(), interaction.member);
  if (!result.allowed || !result.team) {
    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setDescription('❌ You must be at least a General Manager to use this command.')
        .setColor(0xFF4444)
      ],
      ephemeral: true
    });
  }

  const oppTeamName = interaction.options.getString('oppteam');
  const timeStr = interaction.options.getString('time');
  const timezone = interaction.options.getString('timezone');

  const timeMatch = timeStr.toLowerCase().trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!timeMatch) {
    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setDescription('❌ Invalid time format. Use something like 8pm, 5:30pm, 12pm, 3am')
        .setColor(0xFF4444)
      ]
    });
  }

  let hours = parseInt(timeMatch[1]);
  const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
  const meridiem = timeMatch[3];

  if (meridiem === 'pm' && hours !== 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;

  // Timezone offset map (fix: timezone was collected but completely ignored before)
  const TZ_OFFSETS = {
    EST: -5, EDT: -4, CST: -6, CDT: -5,
    MST: -7, MDT: -6, PST: -8, PDT: -7,
    GMT: 0,  UTC: 0,  BST: 1,  CET: 1,
  };
  const tzUpper = timezone.toUpperCase();
  const tzOffset = TZ_OFFSETS[tzUpper];

  if (tzOffset === undefined) {
    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setDescription(`❌ Unknown timezone **${timezone}**. Use a standard abbreviation like EST, PST, CST, UTC.`)
        .setColor(0xFF4444)
      ],
      ephemeral: true
    });
  }

  // Build the Unix timestamp relative to the given timezone
  const nowUtc = Date.now();
  // Game time in UTC = provided local time - timezone offset
  const gameUtcMs = (() => {
    const base = new Date();
    base.setUTCHours(hours - tzOffset, minutes, 0, 0);
    if (base.getTime() < nowUtc) base.setUTCDate(base.getUTCDate() + 1);
    return base.getTime();
  })();

  const unixTimestamp = Math.floor(gameUtcMs / 1000);

  const userTeam = result.team;
  const oppTeamData = await Team.findOne(interaction.guildId, { teamName: oppTeamName });

  const oppEmoji = oppTeamData?.teamEmoji || '';
  const oppPing = oppTeamData?.roleId ? `<@&${oppTeamData.roleId}>` : oppTeamName;
  const homePing = userTeam.roleId ? `<@&${userTeam.roleId}>` : userTeam.teamName;

  const embed = new EmbedBuilder()
    .setTitle(interaction.guild.name)
    .setDescription(`⏰ <t:${unixTimestamp}:f>\n${userTeam.teamEmoji || ''} ${homePing} vs ${oppEmoji} ${oppPing} <t:${unixTimestamp}:R>`)
    .setColor(0x0099FF)
    .addFields(
      { name: '> 📹 Streamer', value: '`none`' },
      { name: '> 🏁 Referee', value: '`none`' }
    )
    .setFooter({ text: `Posted by ${interaction.user.displayName}` });

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder().setLabel('📹 Streamer').setStyle(ButtonStyle.Secondary).setCustomId('gametime_streamer'),
      new ButtonBuilder().setLabel('🏁 Referee').setStyle(ButtonStyle.Secondary).setCustomId('gametime_referee'),
      new ButtonBuilder().setLabel('❌ Cancel').setStyle(ButtonStyle.Danger).setCustomId('gametime_cancel')
    );

  const config = await GuildConfig.findOne(interaction.guildId);
  const gametimeChannelId = config?.channels?.gametime;

  if (gametimeChannelId) {
    const channel = interaction.guild.channels.cache.get(gametimeChannelId);
    if (channel) {
      await channel.send({ embeds: [embed], components: [row] });
      return interaction.reply({ content: `✅ Game time posted to <#${gametimeChannelId}>`, ephemeral: true });
    }
  }

  return interaction.reply({ embeds: [embed], components: [row] });
}

export async function handleButton(interaction) {
  const customId = interaction.customId;
  if (customId === 'gametime_streamer') {
    await interaction.reply({ content: 'Streamer slot filled! Contact the streamer.', ephemeral: true });
  } else if (customId === 'gametime_referee') {
    await interaction.reply({ content: 'Referee slot filled! Contact the referee.', ephemeral: true });
  } else if (customId === 'gametime_cancel') {
    if (interaction.message) {
      await interaction.message.delete();
      await interaction.reply({ content: 'Game time post cancelled.', ephemeral: true });
    }
  }
}