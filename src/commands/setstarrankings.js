import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { GuildConfig } from '../models/index.js';

const POSITIONS = ['QB', 'WR', 'CB', 'DE', 'KC'];
const TIERS = ['5star', '4star', '3star', '2star', '1star'];

export const data = new SlashCommandBuilder()
  .setName('setstarrankings')
  .setDescription('Configure star rankings for your franchise');

export async function execute(interaction) {
  const config = await GuildConfig.findOne(interaction.guildId);
  const starConfig = config?.starRankings || {};
  
  const embed = new EmbedBuilder()
    .setTitle('Star Rankings Configuration')
    .setDescription('Select a position to configure star cutoffs')
    .setColor(0x101012);

  const menu = new StringSelectMenuBuilder()
    .setCustomId('star_position_select')
    .setPlaceholder('Select Position');
  
  for (const pos of POSITIONS) {
    menu.addOption({ label: pos, value: pos });
  }

  await interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
}

export async function handleButton(interaction) {
  await execute(interaction);
}