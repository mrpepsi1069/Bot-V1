import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { Team, GuildConfig } from '../models/index.js';

export const data = new SlashCommandBuilder()
  .setName('record')
  .setDescription('View a team\'s win-loss record')
  .addStringOption(opt => opt.setName('team').setDescription('Team name').setRequired(false));

export async function execute(interaction) {
  const teamName = interaction.options.getString('team');
  
  if (teamName) {
    const team = await Team.findOne(interaction.guildId, { name: teamName });
    if (!team) {
      return interaction.reply({ content: 'Team not found.', ephemeral: true });
    }
    
    const embed = new EmbedBuilder()
      .setTitle(`${team.name} Record`)
      .setDescription(`${team.wins}W - ${team.losses}L`)
      .setColor(0x5865F2);
    
    return interaction.reply({ embeds: [embed] });
  }

  const teams = await Team.find(interaction.guildId);
  if (!teams || teams.length === 0) {
    return interaction.reply({ content: 'No teams found.', ephemeral: true });
  }

  const lines = teams.map(t => `**${t.name}**: ${t.wins}W-${t.losses}L`);
  
  const embed = new EmbedBuilder()
    .setTitle('League Standings')
    .setDescription(lines.join('\n'))
    .setColor(0x5865F2);

  await interaction.reply({ embeds: [embed] });
}