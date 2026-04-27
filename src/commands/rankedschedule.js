import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } from 'discord.js';
import { Team, GuildConfig, GameThread } from '../models/index.js';

const INSTRUCTIONS = 'Use `/gametime` to announce your gametime. Then use `/gamereport` to report stats';

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generateRankedMatchups(sorted) {
  const matchups = [];
  const half = Math.floor(sorted.length / 2);
  const used = new Set();

  for (let i = 0; i < half; i++) {
    const top = sorted[i];
    const options = [];

    for (let j = sorted.length - 1; j >= half; j--) {
      if (!used.has(sorted[j]._id.toString())) {
        const pos = sorted.length - 1 - j;
        if (pos === 1 || pos === 2) {
          options.push({ team: sorted[j], distance: pos });
        }
      }
    }

    let opponent;
    if (options.length > 0 && Math.random() < 0.5) {
      opponent = options[Math.floor(Math.random() * options.length)].team;
    } else {
      for (let j = sorted.length - 1; j >= half; j--) {
        if (!used.has(sorted[j]._id.toString())) {
          opponent = sorted[j];
          break;
        }
      }
    }

    if (!opponent) {
      for (let j = sorted.length - 1; j >= half; j--) {
        if (!used.has(sorted[j]._id.toString())) {
          opponent = sorted[j];
          break;
        }
      }
    }

    if (opponent) {
      used.add(opponent._id.toString());
      used.add(top._id.toString());
      matchups.push({ home: top, away: opponent, homeRank: i + 1, awayRank: sorted.indexOf(opponent) + 1 });
    }
  }

  return matchups;
}

function generateRandomMatchups(teams) {
  const shuffled = shuffleArray(teams);
  const matchups = [];
  const half = Math.floor(shuffled.length / 2);

  for (let i = 0; i < half; i++) {
    matchups.push({
      home: shuffled[i],
      away: shuffled[i + half],
      homeRank: i + 1,
      awayRank: i + half + 1
    });
  }

  return matchups;
}

export const data = new SlashCommandBuilder()
  .setName('rankedschedule')
  .setDescription('Post a ranked schedule embed for a week')
  .addStringOption(opt => opt.setName('week').setDescription('Week number (e.g., Week 9)').setRequired(true));

export const data2 = new SlashCommandBuilder()
  .setName('randomschedule')
  .setDescription('Post a random schedule embed for a week')
  .addStringOption(opt => opt.setName('week').setDescription('Week number (e.g., Week 9)').setRequired(true));

export async function execute(interaction) {
  if (!interaction.member.permissions.has('Administrator')) {
    return interaction.reply({ content: '❌ Admin only.', flags: 64 });
  }

  await interaction.deferReply({ flags: 64 });

  const week = interaction.options.getString('week');

  const teams = await Team.find(interaction.guildId);
  const activeTeams = teams.filter(t => t.coaches?.franchise_owner);

  const sorted = [...activeTeams].sort((a, b) => {
    const aWins = a.wins || 0;
    const bWins = b.wins || 0;
    if (bWins !== aWins) return bWins - aWins;
    return (b.pointDiff || 0) - (a.pointDiff || 0);
  });

  const matchups = generateRankedMatchups(sorted);

  const lines = matchups.map(m => {
    const homeRecord = `(${m.home.wins || 0}-${m.home.losses || 0})`;
    const awayRecord = `(${m.away.wins || 0}-${m.away.losses || 0})`;
    const homeEmoji = m.home.teamEmoji || '🏈';
    const awayEmoji = m.away.teamEmoji || '🏈';
    return `**#${m.homeRank}** ${homeEmoji} <@&${m.home.roleId}> ${homeRecord} vs **#${m.awayRank}** ${awayEmoji} <@&${m.away.roleId}> ${awayRecord}`;
  });

  const embed = new EmbedBuilder()
    .setTitle(`${interaction.guild.name} ${week}`)
    .setDescription(`**${week} Schedule**\n\n${lines.join('\n\n')}`)
    .setColor(0x111111);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ranked_deadline`)
      .setLabel('Set Deadline')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`ranked_create_threads:${week}`)
      .setLabel('Create Threads')
      .setStyle(ButtonStyle.Primary)
  );

  await interaction.editReply({ embeds: [embed], components: [row] });
}

export async function execute2(interaction) {
  if (!interaction.member.permissions.has('Administrator')) {
    return interaction.reply({ content: '❌ Admin only.', flags: 64 });
  }

  await interaction.deferReply({ flags: 64 });

  const week = interaction.options.getString('week');

  const teams = await Team.find(interaction.guildId);
  const activeTeams = teams.filter(t => t.coaches?.franchise_owner);

  const matchups = generateRandomMatchups(activeTeams);

  const lines = matchups.map(m => {
    const homeEmoji = m.home.teamEmoji || '🏈';
    const awayEmoji = m.away.teamEmoji || '🏈';
    return `**#${m.homeRank}** ${homeEmoji} <@&${m.home.roleId}> vs **#${m.awayRank}** ${awayEmoji} <@&${m.away.roleId}>`;
  });

  const embed = new EmbedBuilder()
    .setTitle(`${interaction.guild.name} ${week}`)
    .setDescription(`**${week} Random Schedule**\n\n${lines.join('\n\n')}`)
    .setColor(0x111111);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`random_deadline`)
      .setLabel('Set Deadline')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`random_reroll:${week}`)
      .setLabel('Reroll')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`random_create_threads:${week}`)
      .setLabel('Create Threads')
      .setStyle(ButtonStyle.Success)
  );

  await interaction.editReply({ embeds: [embed], components: [row] });
}

export async function handleButton(interaction) {
  if (!interaction.member.permissions.has('Administrator')) {
    return interaction.reply({ content: '❌ Admin only.', flags: 64 });
  }

  await interaction.deferReply({ flags: 64 });

  const customId = interaction.customId;
  const week = customId.split(':')[1] || '1';
  const channel = interaction.channel;

  const teams = await Team.find(interaction.guildId);
  const activeTeams = teams.filter(t => t.coaches?.franchise_owner);

  const config = await GuildConfig.findOne(interaction.guildId);
  const staffTeamId = config?.channels?.staff_team;

  let matchups;

  if (customId.startsWith('ranked_create_threads:') || customId === 'ranked_deadline') {
    const sorted = [...activeTeams].sort((a, b) => {
      const aWins = a.wins || 0;
      const bWins = b.wins || 0;
      if (bWins !== aWins) return bWins - aWins;
      return (b.pointDiff || 0) - (a.pointDiff || 0);
    });
    matchups = generateRankedMatchups(sorted);
  } else if (customId.startsWith('random_create_threads:') || customId.startsWith('random_reroll:') || customId === 'random_deadline') {
    matchups = generateRandomMatchups(activeTeams);
  }

  if (customId === 'ranked_deadline' || customId === 'random_deadline') {
    const isRandom = customId === 'random_deadline';

    const deadlineRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${isRandom ? 'random_deadline_1day' : 'ranked_deadline_1day'}`)
        .setLabel('1 Day')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`${isRandom ? 'random_deadline_2day' : 'ranked_deadline_2day'}`)
        .setLabel('2 Days')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`${isRandom ? 'random_deadline_3day' : 'ranked_deadline_3day'}`)
        .setLabel('3 Days')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`${isRandom ? 'random_deadline_4day' : 'ranked_deadline_4day'}`)
        .setLabel('4 Days')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`${isRandom ? 'random_deadline_5day' : 'ranked_deadline_5day'}`)
        .setLabel('5 Days')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`${isRandom ? 'random_deadline_6day' : 'ranked_deadline_6day'}`)
        .setLabel('6 Days')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`${isRandom ? 'random_deadline_7day' : 'ranked_deadline_7day'}`)
        .setLabel('7 Days')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.message.edit({ components: [deadlineRow] });
    return interaction.editReply({ content: '✅ Select a deadline using the buttons above.', flags: 64 });
  }

  if (customId.includes('_deadline_')) {
    const days = parseInt(customId.split('_')[2]);
    const deadline = `${days} Day${days > 1 ? 's' : ''}`;

    const isRandom = customId.startsWith('random');

    if (!matchups) {
      if (isRandom) {
        matchups = generateRandomMatchups(activeTeams);
      } else {
        const sorted = [...activeTeams].sort((a, b) => {
          const aWins = a.wins || 0;
          const bWins = b.wins || 0;
          if (bWins !== aWins) return bWins - aWins;
          return (b.pointDiff || 0) - (a.pointDiff || 0);
        });
        matchups = generateRankedMatchups(sorted);
      }
    }

    const lines = matchups.map(m => {
      const homeEmoji = m.home.teamEmoji || '🏈';
      const awayEmoji = m.away.teamEmoji || '🏈';
      return `**#${m.homeRank}** ${homeEmoji} <@&${m.home.roleId}> vs **#${m.awayRank}** ${awayEmoji} <@&${m.away.roleId}>`;
    });

    const embed = new EmbedBuilder()
      .setTitle(`${interaction.guild.name} ${week}`)
      .setDescription(`**${week} ${isRandom ? 'Random ' : ''}Schedule**\n\n${lines.join('\n\n')}`)
      .setColor(0x111111)
      .setFooter({ text: `Deadline: ${deadline}` });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${isRandom ? 'random_deadline' : 'ranked_deadline'}`)
        .setLabel('Change Deadline')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`${isRandom ? 'random_create_threads' : 'ranked_create_threads'}:${week}`)
        .setLabel('Create Threads')
        .setStyle(ButtonStyle.Primary)
    );

    if (isRandom) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`random_reroll:${week}`)
          .setLabel('Reroll')
          .setStyle(ButtonStyle.Primary)
      );
    }

    await interaction.message.edit({ embeds: [embed], components: [row] });
    return interaction.editReply({ content: `✅ Deadline set to ${deadline}.`, flags: 64 });
  }

  if (customId.startsWith('random_reroll:')) {
    const newmatchups = generateRandomMatchups(activeTeams);
    const lines = newmatchups.map(m => {
      const homeEmoji = m.home.teamEmoji || '🏈';
      const awayEmoji = m.away.teamEmoji || '🏈';
      return `**#${m.homeRank}** ${homeEmoji} <@&${m.home.roleId}> vs **#${m.awayRank}** ${awayEmoji} <@&${m.away.roleId}>`;
    });

    const embed = new EmbedBuilder()
      .setTitle(`${interaction.guild.name} ${week}`)
      .setDescription(`**${week} Random Schedule**\n\n${lines.join('\n\n')}`)
      .setColor(0x111111);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('random_deadline')
        .setLabel('Set Deadline')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`random_reroll:${week}`)
        .setLabel('Reroll')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`random_create_threads:${week}`)
        .setLabel('Create Threads')
        .setStyle(ButtonStyle.Success)
    );

    await interaction.message.edit({ embeds: [embed], components: [row] });
    return interaction.editReply({ content: `✅ Rerolled ${week} schedule.`, flags: 64 });
  }

  const created = [];

  for (const m of matchups) {
    try {
      const thread = await channel.threads.create({
        name: `${week}: ${m.away.teamName} @ ${m.home.teamName}`,
        type: ChannelType.PublicThread,
        reason: `${week} game thread`,
      });
      await GameThread.create(interaction.guildId, channel.id, thread.id, null, null, week, '');

      const homeRole = interaction.guild.roles.cache.get(m.home.roleId);
      const teamColor = homeRole?.color || 0x5865F2;

      const pingMessage = `<@&${m.home.roleId}> <@&${m.away.roleId}>${staffTeamId ? ` <@&${staffTeamId}>` : ''}`;

      const embed = new EmbedBuilder()
        .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() })
        .setTitle('Game Schedule')
        .setDescription(`${m.home.teamEmoji || ''} ${m.home.teamName} vs ${m.away.teamEmoji || ''} ${m.away.teamName}`)
        .setColor(teamColor)
        .setThumbnail(interaction.guild.iconURL())
        .addFields({ name: '\u200b', value: INSTRUCTIONS });

      await thread.send({ content: pingMessage, embeds: [embed] });

      created.push(thread.id);
    } catch (e) {
      console.error('[Thread create error]', e.message);
    }
  }

  await interaction.editReply({
    content: `✅ Created ${created.length} threads for ${week}.`,
    flags: 64,
  });
}