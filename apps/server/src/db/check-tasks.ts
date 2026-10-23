import dotenv from 'dotenv';
import path from 'path';
import { Pool } from 'pg';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const { rows } = await pool.query(
    `SELECT id, title, status, human_id, assigned_at FROM tasks ORDER BY created_at DESC`
  );
  console.log(JSON.stringify(rows, null, 2));

  const { rows: humans } = await pool.query(
    `SELECT id, current_task_id FROM humans`
  );
  console.log('\nHumans:', JSON.stringify(humans, null, 2));
  await pool.end();
}

main().catch(console.error);
