import { getDB, formatRow, formatRows } from '../config/database.js';

export const GameReport = {
    async create(guildId, team, oppTeam, yourScore, oppScore, winner, stats = null, reportedBy = null) {
        const db = getDB();
        const doc = {
            guildId,
            team,
            oppTeam,
            yourScore,
            oppScore,
            winner,
            stats: JSON.stringify(stats || {}),
            reportedBy,
            createdAt: new Date(),
        };
        const [result] = await db.execute(
            'INSERT INTO gamereports (guildId, team, oppTeam, yourScore, oppScore, winner, stats, reportedBy, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [doc.guildId, doc.team, doc.oppTeam, doc.yourScore, doc.oppScore, doc.winner, doc.stats, doc.reportedBy, doc.createdAt]
        );
        return { ...doc, id: result.insertId, _id: result.insertId.toString() };
    },

    async find(guildId = null) {
        const db = getDB();
        let sql = 'SELECT * FROM gamereports';
        const params = [];
        if (guildId) { sql += ' WHERE guildId = ?'; params.push(guildId); }
        sql += ' ORDER BY createdAt DESC';
        const [rows] = await db.execute(sql, params);
        return formatRows(rows);
    },

    async findOne(guildId, team = null) {
        const db = getDB();
        let sql = 'SELECT * FROM gamereports WHERE guildId = ?';
        const params = [guildId];
        if (team) { sql += ' AND team = ?'; params.push(team); }
        const [rows] = await db.execute(sql, params);
        return formatRow(rows[0]);
    },
};
