import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Team, GuildConfig } from '../models/index.js';

const COLOR = 0x5865F2;

// ─── Build & send the franchise list embeds ───────────────────────────────────
async function buildAndSend(guild, channel, existingMessages = []) {
  const teams = await Team.find(guild.id);
  const config = await GuildConfig.findOne(guild.id);
  const rosterCap = config?.signings?.rosterCap || 24;

  // Separate franchised vs un-franchised
  const active   = teams.filter(t => t.coaches?.franchise_owner);
  const inactive = teams.filter(t => !t.coaches?.franchise_owner);

  const totalActive = active.length;

  // Split active teams: try 1 embed, max 8 per embed. If more, use 2 embeds with equal spread
  const MAX_TEAMS_PER_EMBED = 8;
  const embedCount = active.length > MAX_TEAMS_PER_EMBED ? 2 : 1;
  const teamsPerEmbed = Math.ceil(active.length / embedCount);

  const splits = [];
  for (let i = 0; i < embedCount; i++) {
    splits.push(active.slice(i * teamsPerEmbed, (i + 1) * teamsPerEmbed));
  }

  const ordinals = embedCount === 2 ? ['1st', '2nd'] : [''];

  const embeds = [];

  // One embed per split
  for (let i = 0; i < splits.length; i++) {
    const group = splits[i];
    const lines = group.map(t => {
      const role      = guild.roles.cache.get(t.roleId);
      const roleMention = role ? `<@&${t.roleId}>` : `**${t.teamName}**`;
      const rosterCount = (Array.isArray(t.roster) ? t.roster.length : 0) + (t.coaches?.franchise_owner ? 1 : 0);
      const foMention   = `<@${t.coaches.franchise_owner}>`;
      const emoji       = t.teamEmoji || '🏈';
      return `${emoji} ${roleMention} ${rosterCount}/${rosterCap} ${foMention}`;
    });

    embeds.push(
      new EmbedBuilder()
        .setTitle('Franchise Owner List')
        .setDescription(`Active FO's${ordinals[i] ? ` ${ordinals[i]} Half` : ''} - ${totalActive}\n\n${lines.join('\n')}`)
        .setColor(COLOR)
    );
  }

  // Un-franchise embed
  const inactiveLines = inactive.length > 0
    ? inactive.map(t => {
        const role = guild.roles.cache.get(t.roleId);
        const roleMention = role ? `<@&${t.roleId}>` : `**${t.teamName}**`;
        const rosterCount = (Array.isArray(t.roster) ? t.roster.length : 0) + (t.coaches?.franchise_owner ? 1 : 0);
        const emoji = t.teamEmoji || '🏈';
        return `${emoji} ${roleMention} ${rosterCount}/${rosterCap} — *Vacant*`;
      })
    : null;

  embeds.push(
    new EmbedBuilder()
      .setTitle('Un-Franchise Owner List')
      .setDescription(inactive.length > 0
        ? `Un-Active FO's - ${inactive.length}\n\n${inactiveLines.join('\n')}`
        : `Un-Active FO's - 0`)
      .setColor(COLOR)
  );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('franchise_list_update')
      .setLabel('Update')
      .setStyle(ButtonStyle.Primary)
  );

  // If we have existing messages to edit, edit them; otherwise send new ones
  if (existingMessages.length > 0) {
    for (let i = 0; i < embeds.length; i++) {
      try {
        const msg = existingMessages[i];
        const isLast = i === embeds.length - 1;
        if (msg) {
          await msg.edit({
            embeds: [embeds[i]],
            components: isLast ? [row] : [],
          });
        } else {
          // More embeds now than before — send extra
          await channel.send({
            embeds: [embeds[i]],
            components: isLast ? [row] : [],
          });
        }
      } catch (e) {
        console.error('[FranchiseList] Failed to edit message:', e.message);
      }
    }
    // Delete leftover messages if fewer embeds now
    for (let i = embeds.length; i < existingMessages.length; i++) {
      try { await existingMessages[i].delete(); } catch {}
    }
  } else {
    const sent = [];
    for (let i = 0; i < embeds.length; i++) {
      const isLast = i === embeds.length - 1;
      const msg = await channel.send({
        embeds: [embeds[i]],
        components: isLast ? [row] : [],
      });
      sent.push(msg.id);
    }
    return sent;
  }
}

// ─── Slash command ─────────────────────────────────────────────────────────────
export const data = new SlashCommandBuilder()
  .setName('setfranchiselist')
  .setDescription('Post the franchise owner list to a channel')
  .addChannelOption(opt =>
    opt.setName('channel')
      .setDescription('Channel to post the franchise list in')
      .setRequired(true)
  );

export async function execute(interaction) {
  if (!interaction.member.permissions.has('Administrator')) {
    return interaction.reply({ content: '❌ Admin only.', ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  const channel = interaction.options.getChannel('channel');

  try {
    const sentIds = await buildAndSend(interaction.guild, channel);

    // Save channel + message IDs to GuildConfig for the Update button
    await GuildConfig.updateOne(interaction.guildId, {
      $set: {
        'franchiseList.channelId': channel.id,
        'franchiseList.messageIds': sentIds,
      },
    });

    await interaction.editReply({ content: `✅ Franchise list posted in <#${channel.id}>.` });
  } catch (e) {
    console.error('[setfranchiselist]', e);
    await interaction.editReply({ content: `❌ Error: ${e.message}` });
  }
}

// ─── Update button handler ─────────────────────────────────────────────────────
export async function handleButton(interaction) {
  if (!interaction.member.permissions.has('Administrator') && !interaction.member.permissions.has('ManageGuild')) {
    return interaction.reply({ content: '❌ You need Manage Server permission to update the list.', ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const config = await GuildConfig.findOne(interaction.guildId);
    const fl = config?.franchiseList;

    if (!fl?.channelId || !fl?.messageIds?.length) {
      return interaction.editReply({ content: '❌ No franchise list found. Run `/setfranchiselist` first.' });
    }

    const channel = interaction.guild.channels.cache.get(fl.channelId);
    if (!channel) {
      return interaction.editReply({ content: '❌ Franchise list channel not found.' });
    }

    // Fetch existing messages
    const existingMessages = [];
    for (const msgId of fl.messageIds) {
      try {
        const msg = await channel.messages.fetch(msgId);
        existingMessages.push(msg);
      } catch {
        existingMessages.push(null);
      }
    }

    await buildAndSend(interaction.guild, channel, existingMessages);

    await interaction.editReply({ content: '✅ Franchise list updated!' });
  } catch (e) {
    console.error('[FranchiseList Update]', e);
    await interaction.editReply({ content: `❌ Error: ${e.message}` });
  }
}