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

        // Check if columns exist, if not add them
        // We use a safe approach: add column if not exists
        const queries = [
            `ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_sol_pub TEXT;`,
            `ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_sol_priv TEXT;`,
            `ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_base_pub TEXT;`,
            `ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_base_priv TEXT;`
        ];

        for (const query of queries) {
            await client.query(query);
            console.log(`Executed: ${query}`);
        }

        console.log('Migration (Add Wallets) completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await client.end();
    }
}

migrate();
