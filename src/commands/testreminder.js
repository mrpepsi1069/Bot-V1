import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { GuildConfig } from '../models/index.js';

export const data = new SlashCommandBuilder()
  .setName('testreminder')
  .setDescription('Test the game reminder system');

export async function execute(interaction) {
  if (!interaction.member.permissions.has('Administrator')) {
    return interaction.reply({ content: '❌ Admin only.', ephemeral: true });
  }

  const config = await GuildConfig.findOne(interaction.guildId);
  if (!config?.channels?.gametime) {
    return interaction.reply({ content: 'Gametime channel not configured. Run /panel first.', ephemeral: true });
  }

  const channel = interaction.guild.channels.cache.get(config.channels.gametime);
  if (!channel) {
    return interaction.reply({ content: 'Gametime channel not found.', ephemeral: true });
  }

  const embed = new EmbedBuilder()
    .setDescription(`**Test Reminder**\nThis is a test message.`)
    .setColor(0x5865F2);

  await channel.send({ embeds: [embed] });
  await interaction.reply({ content: '✅ Test reminder sent.', ephemeral: true });
}