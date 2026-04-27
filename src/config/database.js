import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || '';
const DATABASE_NAME = 'endracore';

let client = null;
let db = null;
let isConnecting = false;

async function connectInternal() {
  if (db) return db;
  if (isConnecting) {
    while (isConnecting) {
      await new Promise(r => setTimeout(r, 100));
    }
    return db;
  }
  
  isConnecting = true;
  
  try {
    if (!client) {
      client = new MongoClient(MONGO_URI, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
      });
    }
    
    console.log('Connecting to MongoDB...');
    await client.connect();
    db = client.db(DATABASE_NAME);
    
    await db.command({ ping: 1 });
    console.log('MongoDB connected!');
    
    return db;
  } catch(e) {
    console.log('MongoDB connection error:', e.message);
    client = null;
    db = null;
    throw e;
  } finally {
    isConnecting = false;
  }
}

export async function connectDB() {
  if (db) return db;
  return connectInternal();
}

export async function ensureDB() {
  if (db) return db;
  return connectInternal();
}

export function getDB() {
  return db;
}

export const collections = {
  teams: () => db.collection('teams'),
  guildconfigs: () => db.collection('guildconfigs'),
  gamereports: () => db.collection('gamereports'),
  gamethreads: () => db.collection('gamethreads'),
  playerstats: () => db.collection('playerstats'),
  pendingreports: () => db.collection('pendingreports'),
};

export async function closeDB() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}