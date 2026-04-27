import { ObjectId } from 'mongodb';
import { collections, ensureDB } from '../config/database.js';

export const Team = {
  async create(guildId, roleId, teamName, teamEmoji = '') {
    await ensureDB();
    const doc = {
      guildId,
      roleId,
      teamName,
      teamEmoji,
      roster: [],
      wins: 0,
      losses: 0,
      pointDiff: 0,
      coaches: {
        franchise_owner: null,
        general_manager: null,
        head_coach: null,
        assistant_coach: null,
      },
    };
    const result = await collections.teams().insertOne(doc);
    doc._id = result.insertedId;
    return doc;
  },

  async findOne(guildId, query = {}) {
    await ensureDB();
    const fullQuery = { guildId, ...query };
    return collections.teams().findOne(fullQuery);
  },

  async findById(teamId) {
    await ensureDB();
    return collections.teams().findOne({ _id: new ObjectId(teamId) });
  },

  async find(guildId) {
    await ensureDB();
    return collections.teams().find({ guildId }).toArray();
  },

  async deleteOne(teamId) {
    await ensureDB();
    return collections.teams().deleteOne({ _id: new ObjectId(teamId) });
  },

  async updateOne(teamId, update) {
    await ensureDB();
    return collections.teams().updateOne({ _id: new ObjectId(teamId) }, update);
  },
};