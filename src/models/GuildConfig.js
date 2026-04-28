import { getDB, formatRow } from '../config/database.js';

export const GuildConfig = {
    async findOne(guildId) {
        const db = getDB();
        const [rows] = await db.execute('SELECT * FROM guildconfigs WHERE guildId = ?', [guildId]);
        return formatRow(rows[0]);
    },

    async create(guildId, data = {}) {
        const db = getDB();
        const config = JSON.stringify(data);
        const [result] = await db.execute('INSERT INTO guildconfigs (guildId, config) VALUES (?, ?)', [guildId, config]);
        return { guildId, config: data, id: result.insertId, _id: result.insertId.toString() };
    },

    async updateOne(guildId, update, upsert = true) {
        const db = getDB();
        const [existing] = await db.execute('SELECT id FROM guildconfigs WHERE guildId = ?', [guildId]);
        if (existing.length > 0) {
            const setClauses = [];
            const params = [];
            for (const [key, value] of Object.entries(update)) {
                const field = key.replace('$set.', '');
                const val = field === 'config' ? JSON.stringify(value) : value;
                setClauses.push(`${field} = ?`);
                params.push(val);
            }
            params.push(guildId);
            return db.execute(`UPDATE guildconfigs SET ${setClauses.join(', ')} WHERE guildId = ?`, params);
        } else if (upsert) {
            const config = update['$set'] ? JSON.stringify(update['$set']) : JSON.stringify(update);
            return db.execute('INSERT INTO guildconfigs (guildId, config) VALUES (?, ?)', [guildId, config]);
        }
    },

    async findOneAndUpdate(guildId, query, update, upsert = true) {
        const db = getDB();
        await this.updateOne(guildId, update, upsert);
        return this.findOne(guildId);
    },
};
