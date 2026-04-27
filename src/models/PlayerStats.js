import { collections, ensureDB } from '../config/database.js';

export const PlayerStats = {
  async findOne(guildId, robloxUser, position) {
    await ensureDB();
    return collections.playerstats().findOne({ guildId, robloxUser, position });
  },

  async find(position = null, guildId = null) {
    await ensureDB();
    const query = {};
    if (position) query.position = position;
    if (guildId) query.guildId = guildId;
    return collections.playerstats().find(query).toArray();
  },

  async findOneAndUpdate(guildId, robloxUser, position, update, upsert = true) {
    await ensureDB();
    return collections.playerstats().findOneAndUpdate(
      { guildId, robloxUser, position },
      update,
      { upsert, returnDocument: true }
    );
  },
};