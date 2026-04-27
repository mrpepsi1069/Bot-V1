import pkg from 'discord.js';
const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, RoleSelectMenuBuilder, ChannelSelectMenuBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = pkg;
import { GuildConfig } from '../models/index.js';

const COLOR = 0x101012;
const TOTAL_PAGES = 8;

const panelState = {};

const POSITIONS = ['QB', 'WR', 'CB', 'DE', 'KC'];
const TIER_LEVELS = ['5star', '4star', '3star', '2star', '1star'];

export function getPanelState(userId) {
  const starDefaults = {};
  for (const pos of POSITIONS) {
    for (const tier of TIER_LEVELS) {
      starDefaults[`star_${pos}_${tier}`] = null;
    }
  }
  for (const tier of TIER_LEVELS) {
    starDefaults[`star_role_${tier}`] = null;
  }

  if (!panelState[userId]) {
    panelState[userId] = {
      page: 1,
      total_pages: TOTAL_PAGES,
      franchise_owner: null,
      general_manager: null,
      head_coach: null,
      assistant_coach: null,
      streamer: null,
      referee: null,
      suspended: null,
      candidate: null,
      statistician: null,
      verified: null,
      justice: null,
      transactions: null,
      demands: null,
      lfp: null,
      decisions: null,
      gametime: null,
      alerts: null,
      scores: null,
      stat_dump: null,
      staff_channel: null,
      staff_team: null,
      star_enabled: null,
      signing_enabled: null,
      signing_mode: null,
      roster_cap: null,
      signing_sub: null,
      ...starDefaults,
    };
  }
  return panelState[userId];
}

async function autoSave(guildId, state) {
  const starRanges = {};
  const starRoles = {};
  for (const pos of POSITIONS) {
    for (const tier of TIER_LEVELS) {
      const val = state[`star_${pos}_${tier}`];
      if (val) starRanges[`${pos.toLowerCase()}.${tier}`] = val;
    }
  }
  for (const tier of TIER_LEVELS) {
    const role = state[`star_role_${tier}`];
    if (role) starRoles[tier] = role;
  }

  await GuildConfig.updateOne(guildId, {
    $set: {
      'franchise_roles.franchise_owner': state.franchise_owner,
      'franchise_roles.general_manager': state.general_manager,
      'franchise_roles.head_coach': state.head_coach,
      'franchise_roles.assistant_coach': state.assistant_coach,
      'server_roles.streamer': state.streamer,
      'server_roles.referee': state.referee,
      'server_roles.suspended': state.suspended,
      'server_roles.candidate': state.candidate,
      'server_roles.statistician': state.statistician,
      'server_roles.verified': state.verified,
      'server_roles.justice': state.justice,
      'channels.transactions': state.transactions,
      'channels.demands': state.demands,
      'channels.lfp': state.lfp,
      'channels.decisions': state.decisions,
      'channels.gametime': state.gametime,
      'channels.alerts': state.alerts,
      'channels.scores': state.scores,
      'channels.stat_dump': state.stat_dump,
      'channels.staff_channel': state.staff_channel,
      'channels.staff_team': state.staff_team,
      'starRankings.enabled': state.star_enabled,
      'starRankings.ranges': starRanges,
      'starRankings.roles': starRoles,
      'signings.enabled': state.signing_enabled ?? true,
      'signings.mode': state.signing_mode ?? 'offer',
      'signings.rosterCap': state.roster_cap ?? 25,
    }
  });
}

function buildPanelEmbed(page, userId) {
  const state = panelState[userId] || {};
  let fields = [];
  let title, desc;

  if (page === 1) {
    fields = [
      { name: 'Franchise Owner', value: state.franchise_owner },
      { name: 'General Manager', value: state.general_manager },
      { name: 'Head Coach', value: state.head_coach },
      { name: 'Assistant Coach', value: state.assistant_coach },
    ];
    title = `Panel 1/${TOTAL_PAGES}`;
    desc = '**🏈 Franchise Roles**\nSelect the Discord roles for each coaching position on your team.';
  } else if (page === 2) {
    fields = [
      { name: 'Streamer', value: state.streamer },
      { name: 'Referee', value: state.referee },
      { name: 'Suspended', value: state.suspended },
      { name: 'Candidate', value: state.candidate },
    ];
    title = `Panel 2/${TOTAL_PAGES}`;
    desc = '**⚙️ Server Roles (1/2)**\nSelect the Discord roles for staff positions.';
  } else if (page === 3) {
    fields = [
      { name: 'Statistician', value: state.statistician },
      { name: 'Verified', value: state.verified },
      { name: 'Justice', value: state.justice },
    ];
    title = `Panel 3/${TOTAL_PAGES}`;
    desc = '**⚙️ Server Roles (2/2)**\nSelect the Discord roles for staff positions.';
  } else if (page === 4) {
    fields = [
      { name: 'Transactions', value: state.transactions },
      { name: 'Demands', value: state.demands },
      { name: 'LFP', value: state.lfp },
      { name: 'Decisions', value: state.decisions },
    ];
    title = `Panel 4/${TOTAL_PAGES}`;
    desc = '**📋 Server Channels (1/3)**\nSelect the Discord channels.';
  } else if (page === 5) {
    fields = [
      { name: 'Gametime', value: state.gametime },
      { name: 'Alerts', value: state.alerts },
      { name: 'Scores', value: state.scores },
      { name: 'Stats', value: state.stat_dump },
    ];
    title = `Panel 5/${TOTAL_PAGES}`;
    desc = '**📋 Server Channels (2/3)**\nSelect the Discord channels.';
  } else if (page === 6) {
    fields = [
      { name: 'Staff Channel', value: state.staff_channel },
      { name: 'Staff Team', value: state.staff_team },
    ];
    title = `Panel 6/${TOTAL_PAGES}`;
    desc = '**🛡️ Staff Settings (3/3)**\nSelect the private staff channel and staff team role.';
  } else if (page === 7) {
    const enabled = state.star_enabled;
    fields = [{ name: 'Star Rankings', value: enabled ? 'Enabled' : 'Disabled' }];
    for (const pos of POSITIONS) {
      const cutoff = state[`star_${pos}_5star`];
      fields.push({ name: `${pos} 5★ Cutoff`, value: cutoff ? cutoff.toString() : 'Not set' });
    }
    title = `Panel 7/${TOTAL_PAGES}`;
    desc = '**⭐ Star Rankings**\nConfigure star rankings and cutoffs.';
  } else if (page === 8) {
    const sub = state.signing_sub;
    if (sub === 'on_off') {
      title = `Panel 8/${TOTAL_PAGES}`;
      desc = '**✏️ Franchise Signings**\nSelect Signings to `On` or `Off` *(automatically set to On)*';
      fields = [{ name: 'Franchise Signings', value: state.signing_enabled === false ? 'Off' : 'On' }];
    } else if (sub === 'choice') {
      title = `Panel 8/${TOTAL_PAGES}`;
      desc = '**✏️ Signing Choice**\nSelect Signings to `Sign` or `Offer`\n\n- Sign uses `/sign` and Offer uses `/offer`';
      fields = [{ name: 'Signing Mode', value: state.signing_mode === 'sign' ? 'Sign' : 'Offer' }];
    } else if (sub === 'roster_cap') {
      title = `Panel 8/${TOTAL_PAGES}`;
      desc = '**✏️ Roster Cap**\nSelect the maximum roster size for franchises.';
      fields = [{ name: 'Roster Cap', value: state.roster_cap ? state.roster_cap.toString() : '25' }];
    } else {
      title = `Panel 8/${TOTAL_PAGES}`;
      desc = '**✏️ Server Signings**\nChoose which signing option to select\n\n- **Franchise Signings** — *turns signings on/off*\n- **Signing Choice** — *select between sign or offer (set to offer default)*\n- **Roster Cap** — *select roster cap amount*';
      fields = [
        { name: 'Franchise Signings', value: state.signing_enabled === false ? 'Off' : 'On' },
        { name: 'Signing Mode', value: state.signing_mode === 'sign' ? 'Sign' : 'Offer' },
        { name: 'Roster Cap', value: state.roster_cap ? state.roster_cap.toString() : '25' },
      ];
    }
  }

  const embed = new EmbedBuilder().setTitle(title).setDescription(desc).setColor(COLOR);
  for (const { name, value } of fields) {
    const filled = value ? 1 : 0;
    const bar = '`' + '▓'.repeat(filled) + '░'.repeat(1 - filled) + '`';
    embed.addFields({ name: '\u200b', value: `> ${name}: ${bar} ${filled}/1`, inline: false });
  }
  return embed;
}

function buildPanelComponents(page, userId, guild) {
  const state = panelState[userId] || {};
  const rows = [];

  if (page === 1) {
    for (const { id, label } of [
      { id: 'panel_franchise_owner', label: 'Franchise Owner' },
      { id: 'panel_general_manager', label: 'General Manager' },
      { id: 'panel_head_coach', label: 'Head Coach' },
      { id: 'panel_assistant_coach', label: 'Assistant Coach' },
    ]) {
      rows.push(new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder().setCustomId(id).setPlaceholder(`Select ${label}`).setMinValues(1).setMaxValues(1)
      ));
    }
  } else if (page === 2) {
    for (const { id, label } of [
      { id: 'panel_streamer', label: 'Streamer' },
      { id: 'panel_referee', label: 'Referee' },
      { id: 'panel_suspended', label: 'Suspended' },
      { id: 'panel_candidate', label: 'Candidate' },
    ]) {
      rows.push(new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder().setCustomId(id).setPlaceholder(`Select ${label}`).setMinValues(1).setMaxValues(1)
      ));
    }
  } else if (page === 3) {
    for (const { id, label } of [
      { id: 'panel_statistician', label: 'Statistician' },
      { id: 'panel_verified', label: 'Verified' },
      { id: 'panel_justice', label: 'Justice' },
    ]) {
      rows.push(new ActionRowBuilder().addComponents(
        new RoleSelectMenuBuilder().setCustomId(id).setPlaceholder(`Select ${label}`).setMinValues(1).setMaxValues(1)
      ));
    }
  } else if (page === 4) {
    for (const { id, label } of [
      { id: 'panel_transactions', label: 'Transactions' },
      { id: 'panel_demands', label: 'Demands' },
      { id: 'panel_lfp', label: 'LFP' },
      { id: 'panel_decisions', label: 'Decisions' },
    ]) {
      rows.push(new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder().setCustomId(id).setPlaceholder(`Select ${label}`).setMinValues(1).setMaxValues(1)
      ));
    }
  } else if (page === 5) {
    for (const { id, label } of [
      { id: 'panel_gametime', label: 'Gametime' },
      { id: 'panel_alerts', label: 'Alerts' },
      { id: 'panel_scores', label: 'Scores' },
      { id: 'panel_stat_dump', label: 'Stats' },
    ]) {
      rows.push(new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder().setCustomId(id).setPlaceholder(`Select ${label}`).setMinValues(1).setMaxValues(1)
      ));
    }
  } else if (page === 6) {
    rows.push(new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('panel_staff_channel')
        .setPlaceholder('Select Staff Channel')
        .setMinValues(1)
        .setMaxValues(1)
    ));
    rows.push(new ActionRowBuilder().addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId('panel_staff_team')
        .setPlaceholder('Select Staff Team Role')
        .setMinValues(1)
        .setMaxValues(1)
    ));
  } else if (page === 7) {
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel(state.star_enabled ? '⭐ Star Rankings: ON' : '⭐ Star Rankings: OFF')
        .setStyle(state.star_enabled ? ButtonStyle.Success : ButtonStyle.Danger)
        .setCustomId('panel_star_toggle')
    ));
  } else if (page === 8) {
    const sub = state.signing_sub;

    if (sub === 'on_off') {
      rows.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('✅ On').setStyle(state.signing_enabled !== false ? ButtonStyle.Success : ButtonStyle.Secondary).setCustomId('panel_signing_on'),
        new ButtonBuilder().setLabel('❌ Off').setStyle(state.signing_enabled === false ? ButtonStyle.Danger : ButtonStyle.Secondary).setCustomId('panel_signing_off'),
      ));
      rows.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('🔙 Main Page').setStyle(ButtonStyle.Primary).setCustomId('panel_signing_main'),
      ));
    } else if (sub === 'choice') {
      rows.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('✏️ Sign').setStyle(state.signing_mode === 'sign' ? ButtonStyle.Success : ButtonStyle.Secondary).setCustomId('panel_signing_sign'),
        new ButtonBuilder().setLabel('✏️ Offer').setStyle(state.signing_mode !== 'sign' ? ButtonStyle.Success : ButtonStyle.Secondary).setCustomId('panel_signing_offer'),
      ));
      rows.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('🔙 Main Page').setStyle(ButtonStyle.Primary).setCustomId('panel_signing_main'),
      ));
    } else if (sub === 'roster_cap') {
      rows.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('📝 Set Roster Cap').setStyle(ButtonStyle.Primary).setCustomId('panel_roster_cap_modal')
      ));
      rows.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('🔙 Main Page').setStyle(ButtonStyle.Primary).setCustomId('panel_signing_main'),
      ));
    } else {
      rows.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('✏️ Franchise Signings').setStyle(ButtonStyle.Secondary).setCustomId('panel_signing_sub_on_off'),
        new ButtonBuilder().setLabel('✏️ Signing Choice').setStyle(ButtonStyle.Secondary).setCustomId('panel_signing_sub_choice'),
        new ButtonBuilder().setLabel('✏️ Roster Cap').setStyle(ButtonStyle.Secondary).setCustomId('panel_signing_sub_roster_cap'),
      ));
    }
  }

  const btnBack = new ButtonBuilder()
    .setLabel('← Back')
    .setStyle(ButtonStyle.Secondary)
    .setCustomId('panel_back')
    .setDisabled(page === 1);

  const btnNext = page < TOTAL_PAGES
    ? new ButtonBuilder().setLabel('Next →').setStyle(ButtonStyle.Primary).setCustomId('panel_next')
    : new ButtonBuilder().setLabel('✅ Done').setStyle(ButtonStyle.Success).setCustomId('panel_done');

  rows.push(new ActionRowBuilder().addComponents(btnBack, btnNext));
  return rows;
}

export const data = new SlashCommandBuilder()
  .setName('panel')
  .setDescription('Open the bot configuration panel');

export async function execute(interaction) {
  const userId = interaction.user.id.toString();
  const guild = interaction.guild;
  const config = await GuildConfig.findOne(interaction.guildId);
  const state = getPanelState(userId);

  if (config) {
    const fr = config.franchise_roles || {};
    const sr = config.server_roles || {};
    const ch = config.channels || {};

    state.franchise_owner = fr.franchise_owner?.toString() || null;
    state.general_manager = fr.general_manager?.toString() || null;
    state.head_coach = fr.head_coach?.toString() || null;
    state.assistant_coach = fr.assistant_coach?.toString() || null;
    state.streamer = sr.streamer?.toString() || null;
    state.referee = sr.referee?.toString() || null;
    state.suspended = sr.suspended?.toString() || null;
    state.candidate = sr.candidate?.toString() || null;
    state.statistician = sr.statistician?.toString() || null;
    state.verified = sr.verified?.toString() || null;
    state.justice = sr.justice?.toString() || null;
    state.transactions = ch.transactions?.toString() || null;
    state.demands = ch.demands?.toString() || null;
    state.lfp = ch.lfp?.toString() || null;
    state.decisions = ch.decisions?.toString() || null;
    state.gametime = ch.gametime?.toString() || null;
    state.alerts = ch.alerts?.toString() || null;
    state.scores = ch.scores?.toString() || null;
    state.stat_dump = ch.stat_dump?.toString() || null;
    state.staff_channel = ch.staff_channel?.toString() || null;
    state.staff_team = ch.staff_team?.toString() || null;

    const sr_config = config.starRankings || {};
    state.star_enabled = sr_config.enabled || false;

    const sg = config.signings || {};
    state.signing_enabled = sg.enabled ?? true;
    state.signing_mode = sg.mode ?? 'offer';
    state.roster_cap = sg.rosterCap ?? 25;
    const ranges = sr_config.ranges || {};
    const roles = sr_config.roles || {};
    for (const pos of POSITIONS) {
      for (const tier of TIER_LEVELS) {
        state[`star_${pos}_${tier}`] = ranges[`${pos.toLowerCase()}.${tier}`] || null;
      }
    }
    for (const tier of TIER_LEVELS) {
      state[`star_role_${tier}`] = roles[tier] || null;
    }
  }

  return interaction.reply({
    embeds: [buildPanelEmbed(1, userId)],
    components: buildPanelComponents(1, userId, guild),
    ephemeral: true,
  });
}

export async function handleButton(interaction) {
  const userId = interaction.user.id.toString();
  const customId = interaction.customId;
  const guild = interaction.guild;
  const state = getPanelState(userId);

  if (customId === 'panel_back') {
    state.page = Math.max(1, state.page - 1);
    return interaction.update({
      embeds: [buildPanelEmbed(state.page, userId)],
      components: buildPanelComponents(state.page, userId, guild),
    });
  }

  if (customId === 'panel_next') {
    state.page = Math.min(TOTAL_PAGES, state.page + 1);
    return interaction.update({
      embeds: [buildPanelEmbed(state.page, userId)],
      components: buildPanelComponents(state.page, userId, guild),
    });
  }

  if (customId === 'panel_star_toggle') {
    state.star_enabled = !state.star_enabled;
    return interaction.update({
      embeds: [buildPanelEmbed(state.page, userId)],
      components: buildPanelComponents(state.page, userId, guild),
    });
  }

  if (customId === 'panel_done') {
    await autoSave(interaction.guildId, state);
    delete panelState[userId];
    return interaction.update({
      embeds: [new EmbedBuilder()
        .setTitle('✅ Settings Saved')
        .setDescription('All panel settings have been saved successfully.')
        .setColor(0x00CC66)
      ],
      components: [],
    });
  }

  if (customId === 'panel_signing_sub_on_off') {
    state.signing_sub = 'on_off';
    return interaction.update({ embeds: [buildPanelEmbed(8, userId)], components: buildPanelComponents(8, userId, guild) });
  }
  if (customId === 'panel_signing_sub_choice') {
    state.signing_sub = 'choice';
    return interaction.update({ embeds: [buildPanelEmbed(8, userId)], components: buildPanelComponents(8, userId, guild) });
  }
  if (customId === 'panel_signing_sub_roster_cap') {
    state.signing_sub = 'roster_cap';
    return interaction.update({ embeds: [buildPanelEmbed(8, userId)], components: buildPanelComponents(8, userId, guild) });
  }
  if (customId === 'panel_signing_main') {
    state.signing_sub = null;
    return interaction.update({ embeds: [buildPanelEmbed(8, userId)], components: buildPanelComponents(8, userId, guild) });
  }
  if (customId === 'panel_signing_on') {
    state.signing_enabled = true;
    await autoSave(interaction.guildId, state);
    return interaction.update({ embeds: [buildPanelEmbed(8, userId)], components: buildPanelComponents(8, userId, guild) });
  }
  if (customId === 'panel_signing_off') {
    state.signing_enabled = false;
    await autoSave(interaction.guildId, state);
    return interaction.update({ embeds: [buildPanelEmbed(8, userId)], components: buildPanelComponents(8, userId, guild) });
  }
  if (customId === 'panel_signing_sign') {
    state.signing_mode = 'sign';
    await autoSave(interaction.guildId, state);
    return interaction.update({ embeds: [buildPanelEmbed(8, userId)], components: buildPanelComponents(8, userId, guild) });
  }
  if (customId === 'panel_signing_offer') {
    state.signing_mode = 'offer';
    await autoSave(interaction.guildId, state);
    return interaction.update({ embeds: [buildPanelEmbed(8, userId)], components: buildPanelComponents(8, userId, guild) });
  }
  if (customId === 'panel_roster_cap_modal') {
    const modal = new ModalBuilder()
      .setCustomId('panel_roster_cap_input')
      .setTitle('Set Roster Cap')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('roster_cap_value')
            .setLabel('Roster Cap')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter roster cap number')
            .setValue(state.roster_cap?.toString() || '25')
            .setMinLength(1)
            .setMaxLength(3)
        )
      );
    return interaction.showModal(modal);
  }

  if (customId === 'panel_roster_cap_input') {
    const rosterCapValue = interaction.fields.getTextInputValue('roster_cap_value');
    const rosterCap = parseInt(rosterCapValue);
    if (isNaN(rosterCap) || rosterCap < 1) {
      return interaction.reply({ content: 'Please enter a valid number.', ephemeral: true });
    }
    state.roster_cap = rosterCap;
    state.signing_sub = 'roster_cap';
    await autoSave(interaction.guildId, state);
    return interaction.update({ embeds: [buildPanelEmbed(8, userId)], components: buildPanelComponents(8, userId, guild) });
  }

  if (customId.startsWith('panel_')) {
    const key = customId.replace('panel_', '');
    const values = interaction.values;
    if (values && values[0]) {
      state[key] = values[0];
      await autoSave(interaction.guildId, state);
    }
    return interaction.update({
      embeds: [buildPanelEmbed(state.page, userId)],
      components: buildPanelComponents(state.page, userId, guild),
    });
  }
}