import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('deletethreads')
  .setDescription('Delete all threads in this channel');

export async function execute(interaction) {
  if (!interaction.member.permissions.has('Administrator')) {
    return interaction.reply({ content: '❌ Admin only.', ephemeral: true });
  }

  const channel = interaction.channel;
  const threads = [...channel.threads.cache.values()];

  if (threads.length === 0) {
    return interaction.reply({ content: 'No threads to delete in this channel.', ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setTitle('Delete Threads')
    .setDescription(`Are you sure you want to delete **${threads.length}** threads in this channel?\n\nThis will delete both active and archived threads.`)
    .setColor(0xFF4444);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('delete_threads_yes')
      .setLabel('Yes, Delete All')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('delete_threads_no')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}