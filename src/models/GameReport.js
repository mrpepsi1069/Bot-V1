import { collections, ensureDB } from '../config/database.js';

export const GameReport = {
  async create(guildId, team, oppTeam, yourScore, oppScore, winner, stats = null, reportedBy = null) {
    await ensureDB();
    const doc = {
      guildId,
      team,
      oppTeam,
      yourScore,
      oppScore,
      winner,
      stats: stats || {},
      reportedBy,
      createdAt: new Date(),
    };
    const result = await collections.gamereports().insertOne(doc);
    doc._id = result.insertedId;
    return doc;
  },

  async find(guildId = null) {
    await ensureDB();
    const query = guildId ? { guildId } : {};
    return collections.gamereports().find(query).sort({ createdAt: -1 }).toArray();
  },

  async findOne(guildId, team = null) {
    await ensureDB();
    const query = { guildId };
    if (team) query.team = team;
    return collections.gamereports().findOne(query);
  },
};