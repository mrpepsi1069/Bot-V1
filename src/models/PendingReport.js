import { ObjectId } from 'mongodb';
import { collections, ensureDB } from '../config/database.js';

export const PendingReport = {
  async create(data) {
    await ensureDB();
    const doc = { ...data, createdAt: new Date() };
    const result = await collections.pendingreports().insertOne(doc);
    doc._id = result.insertedId;
    return doc;
  },

  async findOne(id) {
    await ensureDB();
    return collections.pendingreports().findOne({ _id: new ObjectId(id) });
  },

  async deleteOne(id) {
    await ensureDB();
    return collections.pendingreports().deleteOne({ _id: new ObjectId(id) });
  },
};
