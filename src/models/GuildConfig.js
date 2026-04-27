import { collections, ensureDB } from '../config/database.js';

export const GuildConfig = {
  async findOne(guildId) {
    await ensureDB();
    return collections.guildconfigs().findOne({ guildId });
  },

  async create(guildId, data = {}) {
    await ensureDB();
    const doc = { guildId, ...data };
    const result = await collections.guildconfigs().insertOne(doc);
    doc._id = result.insertedId;
    return doc;
  },

  async updateOne(guildId, update, upsert = true) {
    await ensureDB();
    return collections.guildconfigs().updateOne({ guildId }, update, { upsert });
  },

  async findOneAndUpdate(guildId, query, update, upsert = true) {
    await ensureDB();
    const fullQuery = { guildId, ...query };
    return collections.guildconfigs().findOneAndUpdate(fullQuery, update, { upsert, returnDocument: true });
  },
};