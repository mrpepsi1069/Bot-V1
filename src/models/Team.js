import { getDB, formatRow, formatRows } from '../config/database.js';

export const Team = {
    async create(guildId, roleId, teamName, teamEmoji = '') {
        const db = getDB();
        const doc = {
            guildId,
            roleId,
            teamName,
            teamEmoji,
            roster: JSON.stringify([]),
            wins: 0,
            losses: 0,
            pointDiff: 0,
            coaches: JSON.stringify({
                franchise_owner: null,
                general_manager: null,
                head_coach: null,
                assistant_coach: null,
            }),
        };
        const [result] = await db.execute(
            'INSERT INTO teams (guildId, roleId, teamName, teamEmoji, roster, wins, losses, pointDiff, coaches) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [doc.guildId, doc.roleId, doc.teamName, doc.teamEmoji, doc.roster, doc.wins, doc.losses, doc.pointDiff, doc.coaches]
        );
        return { ...doc, id: result.insertId, _id: result.insertId.toString() };
    },

    async findOne(guildId, query = {}) {
        const db = getDB();
        let sql = 'SELECT * FROM teams WHERE guildId = ?';
        const params = [guildId];
        if (query.roleId) { sql += ' AND roleId = ?'; params.push(query.roleId); }
        if (query.teamName) { sql += ' AND teamName = ?'; params.push(query.teamName); }
        const [rows] = await db.execute(sql, params);
        return formatRow(rows[0]);
    },

    async findById(teamId) {
        const db = getDB();
        const [rows] = await db.execute('SELECT * FROM teams WHERE id = ?', [teamId]);
        return formatRow(rows[0]);
    },

    async find(guildId) {
        const db = getDB();
        const [rows] = await db.execute('SELECT * FROM teams WHERE guildId = ?', [guildId]);
        return formatRows(rows);
    },

    async deleteOne(teamId) {
        const db = getDB();
        return db.execute('DELETE FROM teams WHERE id = ?', [teamId]);
    },

    async updateOne(teamId, update) {
        const db = getDB();
        const setClauses = [];
        const params = [];
        for (const [key, value] of Object.entries(update)) {
            if (key === '$inc') {
                for (const [field, incValue] of Object.entries(value)) {
                    setClauses.push(`${field} = ${field} + ?`);
                    params.push(incValue);
                }
            } else if (key === '$set') {
                for (const [field, val] of Object.entries(value)) {
                    const finalVal = (field === 'roster' || field === 'coaches') ? JSON.stringify(val) : val;
                    setClauses.push(`${field} = ?`);
                    params.push(finalVal);
                }
            } else {
                const val = (key === 'roster' || key === 'coaches') ? JSON.stringify(value) : value;
                setClauses.push(`${key} = ?`);
                params.push(val);
            }
        }
        params.push(teamId);
        return db.execute(`UPDATE teams SET ${setClauses.join(', ')} WHERE id = ?`, params);
    },
};
