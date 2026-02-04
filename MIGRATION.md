# Database Migration

The project has been migrated from SQLite to Supabase (PostgreSQL).

## Prerequisites

- Ensure `.env` contains valid `SUPABASE_URL` and `DATABASE_URL`.
- The `DATABASE_URL` should look like: `postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres`

## Running Migration

To create the necessary tables (`users`, `groups`, `scans`, `ledger`), run:

```bash
node src/db/migrate.js
```

**Note:** If running from an environment with restricted outbound ports (blocking 5432), you may need to run this script from a different machine or use the Supabase Dashboard SQL Editor with the SQL content found in `src/db/migrate.js`.

## Verifying

Check the Supabase Dashboard Table Editor to ensure tables are created.
