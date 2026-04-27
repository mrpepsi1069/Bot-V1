import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Team, GuildConfig, PendingReport } from '../models/index.js';
import { canManageTeam, getMemberRank, getTeamThumbnail, Rank, RANK_DISPLAY } from '../utils/permissions.js';
import { buildScoreEmbed } from './gamereport.js';

const RANK_TO_COACH_KEY = {
  [Rank.FRANCHISE_OWNER]: 'franchise_owner',
  [Rank.GENERAL_MANAGER]: 'general_manager',
  [Rank.HEAD_COACH]:      'head_coach',
  [Rank.ASSISTANT_COACH]: 'assistant_coach',
};

// Standard forfeit score
const FORFEIT_WIN_SCORE  = 14;
const FORFEIT_LOSS_SCORE = 0;

// ─── /forfeit ─────────────────────────────────────────────────────────────────

export const data = new SlashCommandBuilder()
  .setName('forfeit')
  .setDescription('Report a forfeit win — the opponent forfeited against your team')
  .addRoleOption(opt       => opt.setName('oppteam').setDescription('Team that forfeited').setRequired(true))
  .addAttachmentOption(opt => opt.setName('forfeit_proof').setDescription('Screenshot or proof of forfeit'));

export async function execute(interaction) {
  try {
    const { allowed, team: yourTeam } = await canManageTeam(
      interaction.guildId,
      interaction.user.id.toString(),
      interaction.member
    );

    if (!allowed || !yourTeam) {
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setDescription('❌ You must be a General Manager or higher to submit a forfeit report.')
          .setColor(0xFF4444)
        ],
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const oppTeamRole  = interaction.options.getRole('oppteam');
    const forfeitProof = interaction.options.getAttachment('forfeit_proof');

    const yourTeamRole = interaction.guild.roles.cache.get(yourTeam.roleId);
    if (!yourTeamRole) {
      return interaction.followUp({ content: '❌ Could not find your team role. Make sure the team role still exists.', ephemeral: true });
    }

    const oppTeamData = await Team.findOne(interaction.guildId, { roleId: oppTeamRole.id.toString() });
    const config      = await GuildConfig.findOne(interaction.guildId);

    const yourEmoji = yourTeam.teamEmoji  || '';
    const oppEmoji  = oppTeamData?.teamEmoji || '';

    // Reporter's coach role mention
    const { rank }     = await getMemberRank(interaction.guildId, interaction.user.id.toString(), interaction.member);
    const coachKey     = RANK_TO_COACH_KEY[rank];
    const coachRoleId  = coachKey ? config?.franchise_roles?.[coachKey] : null;
    const coachMention = coachRoleId ? `<@&${coachRoleId}>` : (RANK_DISPLAY[rank] || 'Coach');
    const discordName  = interaction.user.username;

    const teamColor    = yourTeamRole.color || 0x5865F2;
    const thumbnailUrl = getTeamThumbnail(yourEmoji);
    const nowUnix      = Math.floor(Date.now() / 1000);
    const nowDisplay   = new Date().toLocaleString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

    // Build the pending embed
    const embed = buildScoreEmbed({
      title:      'Forfeit Report',
      yourEmoji,  yourTeamRole,  yourScore: FORFEIT_WIN_SCORE,
      oppEmoji,   oppTeamRole,   oppScore:  FORFEIT_LOSS_SCORE,
      coachMention,
      userId:     interaction.user.id,
      discordName,
      nowUnix,
      nowDisplay,
      teamColor,
      thumbnailUrl,
      finalized:  false,
      isForfeit:  true,
    });

    // Store pending report
    const pending = await PendingReport.create({
      guildId:         interaction.guildId,
      type:            'forfeit',
      yourTeamName:    yourTeam.teamName || yourTeamRole.name,
      oppTeamName:     oppTeamData?.teamName || oppTeamRole.name,
      yourScore:       FORFEIT_WIN_SCORE,
      oppScore:        FORFEIT_LOSS_SCORE,
      winner:          yourTeam.teamName || yourTeamRole.name,
      yourEmoji,
      oppEmoji,
      yourTeamRoleId:  yourTeamRole.id,
      oppTeamRoleId:   oppTeamRole.id,
      coachMention,
      userId:          interaction.user.id,
      discordName,
      nowDisplay,
      teamColor,
      thumbnailUrl,
      scoresChannelId: config?.channels?.scores,
    });

    const files = forfeitProof ? [{ attachment: forfeitProof.url, name: forfeitProof.name }] : [];

    const finalizeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`finalize_report:${pending._id.toString()}`)
        .setLabel('✅ Finalize Forfeit')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`reject_report:${pending._id.toString()}`)
        .setLabel('❌ Reject')
        .setStyle(ButtonStyle.Danger)
    );

    const staffChannelId = config?.channels?.staff_channel;

    if (staffChannelId) {
      const staffChannel = interaction.guild.channels.cache.get(staffChannelId);
      if (staffChannel) {
        await staffChannel.send({ embeds: [embed], components: [finalizeRow], files });
        return interaction.followUp({ content: `✅ Forfeit report sent to <#${staffChannelId}> for review.`, ephemeral: true });
      }
    }

    await interaction.channel.send({ embeds: [embed], components: [finalizeRow], files });
    return interaction.followUp({ content: '✅ Forfeit report submitted. (Tip: set a Staff Channel in `/panel` for a private review flow.)', ephemeral: true });

  } catch (err) {
    console.error('[Forfeit Error]', err);
    try {
      await interaction.followUp({ content: `❌ An error occurred: ${err.message}`, ephemeral: true });
    } catch {}
  }
}

// ─── Manual win/loss/PD admin overrides ──────────────────────────────────────

export const data_win = new SlashCommandBuilder()
  .setName('setwin')
  .setDescription('Manually add a win to a team')
  .addRoleOption(opt => opt.setName('team').setDescription('Team role').setRequired(true));

export async function execute_win(interaction) {
  const teamRole = interaction.options.getRole('team');
  const teamData = await Team.findOne(interaction.guildId, { roleId: teamRole.id.toString() });
  if (!teamData) return interaction.reply({ content: 'Team not found.', ephemeral: true });

  const newWins = (teamData.wins || 0) + 1;
  await Team.updateOne(teamData._id.toString(), { $set: { wins: newWins } });
  return interaction.reply({ content: `✅ ${teamData.teamName} wins: **${newWins}**`, ephemeral: true });
}

export const data_loss = new SlashCommandBuilder()
  .setName('setloss')
  .setDescription('Manually add a loss to a team')
  .addRoleOption(opt => opt.setName('team').setDescription('Team role').setRequired(true));

export async function execute_loss(interaction) {
  const teamRole = interaction.options.getRole('team');
  const teamData = await Team.findOne(interaction.guildId, { roleId: teamRole.id.toString() });
  if (!teamData) return interaction.reply({ content: 'Team not found.', ephemeral: true });

  const newLosses = (teamData.losses || 0) + 1;
  await Team.updateOne(teamData._id.toString(), { $set: { losses: newLosses } });
  return interaction.reply({ content: `✅ ${teamData.teamName} losses: **${newLosses}**`, ephemeral: true });
}

export const data_pd = new SlashCommandBuilder()
  .setName('setpd')
  .setDescription('Set team point differential')
  .addRoleOption(opt    => opt.setName('team').setDescription('Team role').setRequired(true))
  .addIntegerOption(opt => opt.setName('points').setDescription('Point differential').setRequired(true));

export async function execute_pd(interaction) {
  const teamRole = interaction.options.getRole('team');
  const points   = interaction.options.getInteger('points');
  const teamData = await Team.findOne(interaction.guildId, { roleId: teamRole.id.toString() });
  if (!teamData) return interaction.reply({ content: 'Team not found.', ephemeral: true });

  await Team.updateOne(teamData._id.toString(), { $set: { pointDiff: points } });
  return interaction.reply({ content: `✅ ${teamData.teamName} point differential: **${points}**`, ephemeral: true });
}
