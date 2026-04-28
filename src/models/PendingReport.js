import { getDB, formatRow } from '../config/database.js';

export const PendingReport = {
    async create(data) {
        const db = getDB();
        const doc = { data: JSON.stringify({ ...data, createdAt: new Date() }), createdAt: new Date() };
        const [result] = await db.execute('INSERT INTO pendingreports (data, createdAt) VALUES (?, ?)', [doc.data, doc.createdAt]);
        return { ...JSON.parse(doc.data), id: result.insertId, _id: result.insertId.toString() };
    },

    async findOne(id) {
        const db = getDB();
        const [rows] = await db.execute('SELECT * FROM pendingreports WHERE id = ?', [id]);
        if (!rows[0]) return null;
        const parsed = JSON.parse(rows[0].data);
        return { ...parsed, id: rows[0].id, _id: rows[0].id.toString() };
    },

    async deleteOne(id) {
        const db = getDB();
        return db.execute('DELETE FROM pendingreports WHERE id = ?', [id]);
    },
};
