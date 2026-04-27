import { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import { Team, GuildConfig } from '../models/index.js';
import { canManageTeam, getTeamThumbnail } from '../utils/permissions.js';

export const data = new SlashCommandBuilder()
  .setName('lfp')
  .setDescription('Post a looking for players announcement')
  .addStringOption(opt => opt.setName('positions').setDescription('Positions needed (e.g., WR, QB)').setRequired(true))
  .addStringOption(opt => opt.setName('information').setDescription('Additional information about the opportunity').setRequired(true));

export async function execute(interaction) {
  const result = await canManageTeam(interaction.guildId, interaction.user.id.toString(), interaction.member);
  if (!result.allowed || !result.team) {
    return interaction.reply({
      content: 'You must be at least a Head Coach to use this command.',
      ephemeral: true
    });
  }

  const config = await GuildConfig.findOne(interaction.guildId);
  const lfpId = config?.channels?.lfp;
  if (!lfpId) {
    return interaction.reply({
      content: 'LFP channel not configured. Use /panel to set it up.',
      ephemeral: true
    });
  }

  const lfpChannel = interaction.guild.channels.cache.get(lfpId);
  if (!lfpChannel) {
    return interaction.reply({
      content: 'LFP channel not found.',
      ephemeral: true
    });
  }

  const team = result.team;
  const teamRole = interaction.guild.roles.cache.get(team.roleId);
  const teamColor = teamRole?.color || 0x5865F2;

  const positions = interaction.options.getString('positions');
  const information = interaction.options.getString('information');

  const embed = new EmbedBuilder()
    .setTitle('**Looking For Players**')
    .setDescription(`${team.teamEmoji || ''} ${team.teamName || ''} are looking for players!`)
    .addFields(
      { name: 'Positions Needed', value: `> ${positions}` },
      { name: 'Information', value: `> ${information}` },
      { name: 'Coach', value: `> ${teamRole || ''} ${interaction.user}` }
    )
    .setThumbnail(getTeamThumbnail(team.teamEmoji || ''))
    .setColor(teamColor)
    .setFooter({ text: `By ${interaction.client.user.username}` });

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder().setLabel('Contact').setStyle(ButtonStyle.Success).setCustomId(`lfp_contact_${team._id}`).setEmoji('📞'),
      new ButtonBuilder().setLabel('Delete').setStyle(ButtonStyle.Danger).setCustomId(`lfp_delete_${team._id}`).setEmoji('🗑️')
    );

  await lfpChannel.send({ embeds: [embed], components: [row] });
  return interaction.reply({ content: `✅ LFP posted to ${lfpChannel}.`, ephemeral: true });
}

export async function handleButton(interaction) {
  const customId = interaction.customId;

  if (customId.startsWith('lfp_contact_')) {
    await interaction.reply({ content: 'Contact the team coach for more information!', ephemeral: true });
  } else if (customId.startsWith('lfp_delete_')) {
    if (interaction.message) {
      await interaction.message.delete();
      await interaction.reply({ content: 'LFP post deleted.', ephemeral: true });
    }
  }
}