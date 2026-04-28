import { getDB, formatRow, formatRows } from '../config/database.js';

export const GameThread = {
    async create(guildId, channelId, threadId, team1Id, team2Id, week, deadline = null) {
        const db = getDB();
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
        const [result] = await db.execute(
            'INSERT INTO gamethreads (guildId, channelId, threadId, team1Id, team2Id, week, deadline, lastRemind) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [doc.guildId, doc.channelId, doc.threadId, doc.team1Id, doc.team2Id, doc.week, doc.deadline, doc.lastRemind]
        );
        return { ...doc, id: result.insertId, _id: result.insertId.toString() };
    },

    async find(guildId = null, deadlineExists = false) {
        const db = getDB();
        let sql = 'SELECT * FROM gamethreads WHERE 1=1';
        const params = [];
        if (guildId) { sql += ' AND guildId = ?'; params.push(guildId); }
        if (deadlineExists) { sql += ' AND deadline IS NOT NULL'; }
        const [rows] = await db.execute(sql, params);
        return formatRows(rows);
    },

    async updateOne(threadId, update) {
        const db = getDB();
        const setClauses = [];
        const params = [];
        for (const [key, value] of Object.entries(update)) {
            if (key === '$set') {
                for (const [field, val] of Object.entries(value)) {
                    setClauses.push(`${field} = ?`);
                    params.push(val);
                }
            } else {
                setClauses.push(`${key} = ?`);
                params.push(value);
            }
        }
        params.push(threadId);
        return db.execute(`UPDATE gamethreads SET ${setClauses.join(', ')} WHERE id = ?`, params);
    },
};
