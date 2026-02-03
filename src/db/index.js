const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists (double check)
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

const dbPath = path.join(dataDir, 'socientic.db');
const db = new Database(dbPath); // , { verbose: console.log }

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

function init() {
    const initScript = `
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            telegram_id TEXT UNIQUE NOT NULL,
            username TEXT,
            first_name TEXT,
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
        );

        CREATE TABLE IF NOT EXISTS groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            telegram_id TEXT UNIQUE NOT NULL,
            title TEXT,
            type TEXT,
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
        );

        CREATE TABLE IF NOT EXISTS scans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT, -- telegram_id of user
            group_id TEXT, -- telegram_id of group
            ticker TEXT,
            ca TEXT,
            timestamp INTEGER DEFAULT (strftime('%s', 'now')),
            FOREIGN KEY (user_id) REFERENCES users(telegram_id),
            FOREIGN KEY (group_id) REFERENCES groups(telegram_id)
        );
    `;
    
    db.exec(initScript);
    console.log('Database initialized successfully.');
}

// Initialize on load
init();

module.exports = db;
