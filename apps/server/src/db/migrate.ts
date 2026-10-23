import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

async function migrate() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });

  // Create migrations tracking table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Get already applied migrations
  const { rows: applied } = await pool.query('SELECT name FROM _migrations ORDER BY name');
  const appliedSet = new Set(applied.map(r => r.name));

  // Get migration files
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`  Skipping ${file} (already applied)`);
      continue;
    }

    console.log(`  Applying ${file}...`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

    try {
      await pool.query('BEGIN');
      await pool.query(sql);
      await pool.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
      await pool.query('COMMIT');
      console.log(`  Applied ${file}`);
    } catch (err) {
      await pool.query('ROLLBACK');
      console.error(`  Failed to apply ${file}:`, err);
      process.exit(1);
    }
  }

  console.log('All migrations applied.');
  await pool.end();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
