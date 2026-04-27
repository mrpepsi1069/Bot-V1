import { ObjectId } from 'mongodb';
import { collections, ensureDB } from '../config/database.js';

export const GameThread = {
  async create(guildId, channelId, threadId, team1Id, team2Id, week, deadline = null) {
    await ensureDB();
    const doc = {
      guildId,
      channelId,
      threadId,
      team1Id,
      team2Id,
      week,
      deadline,
      lastRemind: null,
    };
    const result = await collections.gamethreads().insertOne(doc);
    doc._id = result.insertedId;
    return doc;
  },

  async find(guildId = null, deadlineExists = false) {
    await ensureDB();
    const query = {};
    if (guildId) query.guildId = guildId;
    if (deadlineExists) query.deadline = { $exists: true };
    return collections.gamethreads().find(query).toArray();
  },

  async updateOne(threadId, update) {
    await ensureDB();
    return collections.gamethreads().updateOne({ _id: new ObjectId(threadId) }, update);
  },
};