import { SlashCommandBuilder, ChannelType } from 'discord.js';
import { GameThread } from '../models/index.js';

export const data = new SlashCommandBuilder()
  .setName('threadcreate')
  .setDescription('Create a game thread for a week')
  .addStringOption(opt => opt.setName('week').setDescription('Week number (e.g., Week 1)').setRequired(true))
  .addStringOption(opt => opt.setName('deadline').setDescription('Deadline (e.g., Friday)').setRequired(false));

export async function execute(interaction) {
  const week = interaction.options.getString('week');
  const deadline = interaction.options.getString('deadline');
  const channel = interaction.channel;
  
  try {
    const thread = await channel.threads.create({
      name: `${week} Discussion`,
      type: ChannelType.PublicThread,
      reason: `Game thread for ${week}`,
    });

    await GameThread.create(interaction.guildId, channel.id, thread.id, null, null, week, deadline);
    
    await interaction.reply({ content: `✅ Created thread: <#${thread.id}>`, ephemeral: true });
  } catch(e) {
    await interaction.reply({ content: `Error: ${e.message}`, ephemeral: true });
  }
}