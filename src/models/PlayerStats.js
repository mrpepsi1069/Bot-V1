import { getDB, formatRow, formatRows } from '../config/database.js';

export const PlayerStats = {
    async findOne(guildId, robloxUser, position) {
        const db = getDB();
        const [rows] = await db.execute('SELECT * FROM playerstats WHERE guildId = ? AND robloxUser = ? AND position = ?', [guildId, robloxUser, position]);
        return formatRow(rows[0]);
    },

    async find(position = null, guildId = null) {
        const db = getDB();
        let sql = 'SELECT * FROM playerstats WHERE 1=1';
        const params = [];
        if (position) { sql += ' AND position = ?'; params.push(position); }
        if (guildId) { sql += ' AND guildId = ?'; params.push(guildId); }
        const [rows] = await db.execute(sql, params);
        return formatRows(rows);
    },

    async findOneAndUpdate(guildId, robloxUser, position, update, upsert = true) {
        const db = getDB();
        const existing = await this.findOne(guildId, robloxUser, position);
        if (existing) {
            const setClauses = [];
            const params = [];
            for (const [key, value] of Object.entries(update)) {
                const field = key.replace('$set.', '').replace('$inc.', '');
                const val = field === 'stats' ? JSON.stringify(value) : value;
                setClauses.push(`${field} = ?`);
                params.push(val);
            }
            params.push(guildId, robloxUser, position);
            await db.execute(`UPDATE playerstats SET ${setClauses.join(', ')} WHERE guildId = ? AND robloxUser = ? AND position = ?`, params);
            return this.findOne(guildId, robloxUser, position);
        } else if (upsert) {
            const stats = update['$set']?.stats || update.stats || JSON.stringify({});
            const [result] = await db.execute('INSERT INTO playerstats (guildId, robloxUser, position, stats) VALUES (?, ?, ?, ?)', [guildId, robloxUser, position, typeof stats === 'string' ? stats : JSON.stringify(stats)]);
            return { guildId, robloxUser, position, stats: typeof stats === 'string' ? JSON.parse(stats) : stats, id: result.insertId, _id: result.insertId.toString() };
        }
        return null;
    },
};
