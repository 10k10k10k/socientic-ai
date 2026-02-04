const { Client } = require('pg');
require('dotenv').config();

async function migrate() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        await client.connect();
        console.log('Connected to database.');

        const query = `
            ALTER TABLE scans
            ADD COLUMN IF NOT EXISTS mcap REAL,
            ADD COLUMN IF NOT EXISTS liquidity REAL,
            ADD COLUMN IF NOT EXISTS pair_age TEXT;
        `;

        await client.query(query);
        console.log('Migration completed successfully: Added onchain columns.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await client.end();
    }
}

migrate();
