import { SlashCommandBuilder } from 'discord.js';
import { GuildConfig } from '../models/index.js';

export const data = new SlashCommandBuilder()
  .setName('setbloxlinkapi')
  .setDescription('Set the Bloxlink API key')
  .addStringOption(opt => opt.setName('api_key').setDescription('Bloxlink API key').setRequired(true));

export async function execute(interaction) {
  const apiKey = interaction.options.getString('api_key');
  
  if (!interaction.member.permissions.has('Administrator')) {
    return interaction.reply({ content: '❌ Admin only.', ephemeral: true });
  }

  await GuildConfig.updateOne(interaction.guildId, { $set: { bloxlinkApi: apiKey } });
  
  await interaction.reply({ content: '✅ Bloxlink API key saved.', ephemeral: true });
}