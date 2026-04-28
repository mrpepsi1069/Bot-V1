import { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, Collection, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import dotenv from 'dotenv';
import { connectDB, ensureDB } from './src/config/database.js';
import { Team, GuildConfig, GameThread } from './src/models/index.js';

dotenv.config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const commands = [];
const commandMap = new Map();

// Load commands
const cmdModules = [
  './src/commands/teams.js',
  './src/commands/coaches.js',
  './src/commands/players.js',
  './src/commands/gamereport.js',
  './src/commands/scorereport.js',
  './src/commands/roster.js',
  './src/commands/lfp.js',
  './src/commands/gametime.js',
  './src/commands/panel.js',
  './src/commands/deletethread.js',
  './src/commands/forfeit.js',
  './src/commands/record.js',
  './src/commands/stat.js',
  './src/commands/threadcreate.js',
  './src/commands/setstarrankings.js',
  './src/commands/setbloxlinkapi.js',
  './src/commands/testreminder.js',
  './src/commands/setfranchiselist.js',
];

for (const modPath of cmdModules) {
  try {
    const mod = await import(modPath);
    // Main data/execute
    if (mod.data) {
      commands.push(mod.data);
      commandMap.set(mod.data.name, mod);
    }
    // Additional commands (data2, data3, etc. OR data_qb, data_wr, etc.)
    const patterns = [];
    for (let i = 2; i <= 10; i++) patterns.push(`data${i}`, `execute${i}`);
    patterns.push('data_qb', 'execute_qb', 'data_wr', 'execute_wr', 'data_cb', 'execute_cb', 'data_de', 'execute_de', 'data_k', 'execute_k', 'data_lb', 'execute_lb', 'data_win', 'execute_win', 'data_loss', 'execute_loss', 'data_pd', 'execute_pd', 'data_promote', 'execute_promote', 'data_demote', 'execute_demote');
    
    for (let i = 0; i < patterns.length; i += 2) {
      const dataKey = patterns[i];
      const execKey = patterns[i + 1];
      if (mod[dataKey]) {
        commands.push(mod[dataKey]);
        commandMap.set(mod[dataKey].name, { execute: mod[execKey] });
      }
    }
  } catch(e) {
    console.log(`Failed to load ${modPath}: ${e.message}`);
  }
}

client.once('ready', async () => {
  console.log(`${client.user.username} online as ${client.user.tag}`);
  
  const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
  const clientId = client.user.id;
  
  for (const guild of client.guilds.cache.values()) {
    try {
      await rest.put(Routes.applicationGuildCommands(clientId, guild.id), { body: commands.map(c => c.toJSON()) });
      console.log(`Synced ${commands.length} commands to ${guild.name}`);
    } catch(e) {
      console.error(`Error syncing to ${guild.name}:`, e);
    }
  }
  
  startDailyReminder();
});

function startDailyReminder() {
  setInterval(async () => {
    const now = new Date();
    if (now.getHours() === 17 && now.getMinutes() === 0) {
      try {
        const threads = await GameThread.find(null, true);
        for (const gt of threads) {
          if (!gt.deadline) continue;
          const deadlineDate = new Date(gt.deadline);
          if (deadlineDate <= now) continue;
          if (gt.lastRemind && new Date(gt.lastRemind).toDateString() === now.toDateString()) continue;
          
          const guild = client.guilds.cache.get(gt.guildId);
          if (!guild) continue;
          const channel = guild.channels.cache.get(gt.channelId);
          if (!channel) continue;
          const thread = channel.threads?.cache.get(gt.threadId);
          if (!thread) continue;
          
          const config = await GuildConfig.findOne(gt.guildId);
          const serverName = config?.server_name || guild.name;
          const week = gt.week || '';
          const deadlineTs = Math.floor(deadlineDate.getTime() / 1000);
          
          const team1Role = guild.roles.cache.get(gt.team1Id);
          const team2Role = guild.roles.cache.get(gt.team2Id);
          
          const embed = new EmbedBuilder()
            .setDescription(`**${serverName} Week ${week} is ending <t:${deadlineTs}:R>, please find a time to schedule a game.**`)
            .setColor(0x5865F2)
            .addFields({ name: '\u200b', value: `${team1Role?.toString() || 'Team 1'} vs ${team2Role?.toString() || 'Team 2'}` });
          
          try {
            await thread.send({ content: `${team1Role?.toString() || ''} ${team2Role?.toString() || ''}`, embeds: [embed] });
            await GameThread.updateOne(gt._id.toString(), { $set: { lastRemind: now } });
          } catch(e) { console.error('[Daily Reminder Error]', e); }
        }
      } catch(e) { console.error('[Daily Reminder Error]', e); }
    }
  }, 60000);
}

client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const cmd = commandMap.get(interaction.commandName);
    if (cmd?.execute) await cmd.execute(interaction);
    return;
  }
  
  if (interaction.isButton()) {
    await handleButtonInteraction(interaction);
  }

  if (interaction.isModalSubmit()) {
    const customId = interaction.customId;
    if (customId === 'panel_roster_cap_input') {
      try {
        const mod = await import('./src/commands/panel.js');
        if (mod.handleButton) await mod.handleButton(interaction);
      } catch (e) { console.log('Panel modal error:', e.message); }
    }
    return;
  }
  
  // Panel role/channel select menus (fix: these were never dispatched)
  if (interaction.isRoleSelectMenu() || interaction.isChannelSelectMenu()) {
    const customId = interaction.customId;
    if (customId.startsWith('panel_')) {
      try {
        const mod = await import('./src/commands/panel.js');
        if (mod.handleButton) await mod.handleButton(interaction);
      } catch (e) { console.log('Panel select error:', e.message); }
    }
    return;
  }

  if (interaction.isStringSelectMenu()) {
    const customId = interaction.customId;

    if (customId === 'panel_roster_cap_select') {
      try {
        const mod = await import('./src/commands/panel.js');
        if (mod.handleButton) await mod.handleButton(interaction);
      } catch (e) { console.log('Panel select error:', e.message); }
      return;
    }

    // Stat leaderboard select (fix: was using regex on JSON.stringify, now uses correct stat key)
    if (customId === 'stat_lb_select') {
      const position = interaction.values[0];
      const { PlayerStats } = await import('./src/models/index.js');
      const stats = await PlayerStats.find(position, interaction.guildId);

      if (!stats || stats.length === 0) {
        return interaction.reply({ content: 'No stats found for this position!', ephemeral: true });
      }

      const STAT_KEY = { qb: 'touchdowns', wr: 'receptions', cb: 'interceptions', de: 'sacks', k: 'fieldGoals' };
      const statKey = STAT_KEY[position] || null;

      const lines = stats
        .sort((a, b) => (b[statKey] ?? 0) - (a[statKey] ?? 0))
        .slice(0, 10)
        .map((s, i) => `${i + 1}. ${s.robloxUser} — ${statKey ? (s[statKey] ?? 0) : 'N/A'}`);

      return interaction.reply({
        embeds: [new EmbedBuilder().setTitle(`${position.toUpperCase()} Leaderboard`).setDescription(lines.join('\n')).setColor(0x5865F2)],
        ephemeral: true
      });
    }
  }
});

async function handleButtonInteraction(interaction) {
  const customId = interaction.customId;

  // ── Finalize report (score or forfeit) ───────────────────────────────────
  if (customId.startsWith('finalize_report:')) {
    const pendingId = customId.split(':')[1];
    try {
      const { PendingReport, Team, GameReport } = await import('./src/models/index.js');
      const { buildScoreEmbed } = await import('./src/commands/gamereport.js');

      const pending = await PendingReport.findOne(pendingId);
      if (!pending) {
        return interaction.reply({ content: '❌ This report has already been finalized or does not exist.', ephemeral: true });
      }

      // Require Administrator or ManageMessages to finalize
      if (!interaction.member.permissions.has('ManageMessages') && !interaction.member.permissions.has('Administrator')) {
        return interaction.reply({ content: '❌ You need the **Manage Messages** permission to finalize reports.', ephemeral: true });
      }

      const nowUnix = Math.floor(Date.now() / 1000);

      // Build the finalized embed
      const finalEmbed = buildScoreEmbed({
        title:      pending.type === 'forfeit' ? 'Forfeit Report' : 'Score Report',
        yourEmoji:  pending.yourEmoji,
        yourTeamRole: { id: pending.yourTeamRoleId },
        yourScore:  pending.yourScore,
        oppEmoji:   pending.oppEmoji,
        oppTeamRole:  { id: pending.oppTeamRoleId },
        oppScore:   pending.oppScore,
        coachMention: pending.coachMention,
        userId:     pending.userId,
        discordName: pending.discordName,
        nowUnix,
        nowDisplay: pending.nowDisplay,
        teamColor:  pending.teamColor,
        thumbnailUrl: pending.thumbnailUrl,
        finalized:  true,
        isForfeit:  pending.type === 'forfeit',
      });

      // Post to scores channel
      const scoresChannel = pending.scoresChannelId
        ? interaction.guild.channels.cache.get(pending.scoresChannelId)
        : null;

      if (scoresChannel) {
        await scoresChannel.send({ embeds: [finalEmbed] });
      }

      // Update wins/losses for forfeit
      if (pending.type === 'forfeit') {
        const winTeam  = await Team.findOne(pending.guildId, { roleId: pending.yourTeamRoleId });
        const lossTeam = await Team.findOne(pending.guildId, { roleId: pending.oppTeamRoleId });
        if (winTeam)  await Team.updateOne(winTeam._id.toString(),  { $inc: { wins: 1 } });
        if (lossTeam) await Team.updateOne(lossTeam._id.toString(), { $inc: { losses: 1 } });
      } else {
        // Score report: update wins/losses based on winner
        const yourTeam = await Team.findOne(pending.guildId, { roleId: pending.yourTeamRoleId });
        const oppTeam  = await Team.findOne(pending.guildId, { roleId: pending.oppTeamRoleId });
        if (pending.winner === pending.yourTeamName) {
          if (yourTeam) await Team.updateOne(yourTeam._id.toString(), { $inc: { wins: 1 } });
          if (oppTeam)  await Team.updateOne(oppTeam._id.toString(),  { $inc: { losses: 1 } });
        } else if (pending.winner === pending.oppTeamName) {
          if (yourTeam) await Team.updateOne(yourTeam._id.toString(), { $inc: { losses: 1 } });
          if (oppTeam)  await Team.updateOne(oppTeam._id.toString(),  { $inc: { wins: 1 } });
        }
        // Save game report to history
        await GameReport.create(
          pending.guildId, pending.yourTeamName, pending.oppTeamName,
          pending.yourScore, pending.oppScore, pending.winner,
          pending.jsonData, pending.userId
        );
      }

      // Delete pending record
      await PendingReport.deleteOne(pendingId);

      // Edit staff channel message — remove button, mark as finalized
      try {
        await interaction.update({
          embeds: [finalEmbed],
          components: [],
        });
      } catch {}

      if (scoresChannel) {
        await interaction.followUp({ content: `✅ Report finalized and posted to <#${pending.scoresChannelId}>.`, ephemeral: true });
      } else {
        await interaction.followUp({ content: '✅ Report finalized. (No scores channel set — configure one in `/panel`.)', ephemeral: true });
      }

    } catch (err) {
      console.error('[Finalize Error]', err);
      try { await interaction.reply({ content: `❌ Finalization failed: ${err.message}`, ephemeral: true }); } catch {}
    }
    return;
  }

  // ── Reject report ────────────────────────────────────────────────────────
  if (customId.startsWith('reject_report:')) {
    const pendingId = customId.split(':')[1];
    try {
      if (!interaction.member.permissions.has('ManageMessages') && !interaction.member.permissions.has('Administrator')) {
        return interaction.reply({ content: '❌ You need the **Manage Messages** permission to reject reports.', ephemeral: true });
      }

      const { PendingReport } = await import('./src/models/index.js');
      await PendingReport.deleteOne(pendingId);

      const rejectedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
        .spliceFields(3, 1, { name: 'Status:', value: '> ❌ Rejected', inline: false });

      await interaction.update({ embeds: [rejectedEmbed], components: [] });
      await interaction.followUp({ content: '❌ Report rejected and removed from queue.', ephemeral: true });
    } catch (err) {
      console.error('[Reject Error]', err);
      try { await interaction.reply({ content: `❌ Rejection failed: ${err.message}`, ephemeral: true }); } catch {}
    }
    return;
  }

  // ── Delete threads buttons ───────────────────────────────────────────────
  if (customId === 'delete_threads_yes') {
    for (const thread of interaction.channel.threads.cache.values()) {
      try { await thread.delete(); } catch {}
    }
    await interaction.reply({ content: '✅ All threads deleted.', ephemeral: true });
    return;
  }
  
  if (customId === 'delete_threads_no') {
    await interaction.reply({ content: '❌ Cancelled.', ephemeral: true });
    return;
  }
  
  // Panel, gametime, lfp, franchise_list, star buttons
  if (customId.startsWith('panel_') || customId.startsWith('gametime_') || customId.startsWith('lfp_') || customId === 'franchise_list_update' || customId.startsWith('star_')) {
    try {
      const modPath = customId.startsWith('panel_') ? './src/commands/panel.js' :
                   customId.startsWith('gametime_') ? './src/commands/gametime.js' :
                   customId.startsWith('lfp_') ? './src/commands/lfp.js' :
                   customId === 'franchise_list_update' ? './src/commands/setfranchiselist.js' :
                   './src/commands/setstarrankings.js';
      const mod = await import(modPath);
      if (mod.handleButton) await mod.handleButton(interaction);
    } catch(e) { console.log('Button error:', e.message); }
    return;
  }
  
  // Offer buttons
  if (customId.startsWith('offer_')) {
    if (customId === 'offer_accept') {
      await interaction.reply({ content: '✅ Offer accepted! Contact the franchise owner for next steps.', ephemeral: true });
    } else if (customId === 'offer_decline') {
      await interaction.reply({ content: '❌ Offer declined.', ephemeral: true });
    }
    return;
  }
  
  console.log(`Unhandled button: ${customId}`);
}

async function startBot() {
  console.log('Connecting to MySQL...');
  await ensureDB();
  console.log('Database connected successfully');
  
  console.log('Logging in to Discord...');
  await client.login(process.env.BOT_TOKEN);
}

startBot();