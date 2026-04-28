import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'bsg_database',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

export async function connectDB() {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    console.log('MySQL connected!');
    return pool;
}

export async function ensureDB() {
    await createTables();
    return pool;
}

async function createTables() {
    await pool.execute(`
        CREATE TABLE IF NOT EXISTS teams (
            id INT AUTO_INCREMENT PRIMARY KEY,
            guildId VARCHAR(255) NOT NULL,
            roleId VARCHAR(255) NOT NULL,
            teamName VARCHAR(255),
            teamEmoji VARCHAR(255),
            roster JSON,
            wins INT DEFAULT 0,
            losses INT DEFAULT 0,
            pointDiff INT DEFAULT 0,
            coaches JSON,
            UNIQUE KEY unique_team (guildId, roleId)
        )
    `);

    await pool.execute(`
        CREATE TABLE IF NOT EXISTS guildconfigs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            guildId VARCHAR(255) NOT NULL UNIQUE,
            config JSON
        )
    `);

    await pool.execute(`
        CREATE TABLE IF NOT EXISTS gamereports (
            id INT AUTO_INCREMENT PRIMARY KEY,
            guildId VARCHAR(255) NOT NULL,
            team VARCHAR(255),
            oppTeam VARCHAR(255),
            yourScore INT,
            oppScore INT,
            winner VARCHAR(255),
            stats JSON,
            reportedBy VARCHAR(255),
            createdAt DATETIME
        )
    `);

    await pool.execute(`
        CREATE TABLE IF NOT EXISTS gamethreads (
            id INT AUTO_INCREMENT PRIMARY KEY,
            guildId VARCHAR(255) NOT NULL,
            channelId VARCHAR(255),
            threadId VARCHAR(255),
            team1Id VARCHAR(255),
            team2Id VARCHAR(255),
            week VARCHAR(255),
            deadline DATETIME,
            lastRemind DATETIME
        )
    `);

    await pool.execute(`
        CREATE TABLE IF NOT EXISTS playerstats (
            id INT AUTO_INCREMENT PRIMARY KEY,
            guildId VARCHAR(255) NOT NULL,
            robloxUser VARCHAR(255),
            position VARCHAR(255),
            stats JSON,
            UNIQUE KEY unique_player (guildId, robloxUser, position)
        )
    `);

    await pool.execute(`
        CREATE TABLE IF NOT EXISTS pendingreports (
            id INT AUTO_INCREMENT PRIMARY KEY,
            data JSON,
            createdAt DATETIME
        )
    `);
}

export function getDB() {
    return pool;
}

export function formatRow(row) {
    if (!row) return null;
    const formatted = { ...row, _id: row.id?.toString() };
    for (const key of ['roster', 'coaches', 'stats', 'config', 'data']) {
        if (formatted[key] && typeof formatted[key] === 'string') {
            try { formatted[key] = JSON.parse(formatted[key]); } catch {}
        }
    }
    return formatted;
}

export function formatRows(rows) {
    return rows.map(formatRow);
}
