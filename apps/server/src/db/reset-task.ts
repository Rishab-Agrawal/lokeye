import dotenv from 'dotenv';
import path from 'path';
import { Pool } from 'pg';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  await pool.query(
    `UPDATE tasks SET status = 'pending', human_id = NULL, assigned_at = NULL, started_at = NULL
     WHERE status IN ('assigned', 'in_progress')`
  );

  await pool.query(
    `UPDATE humans SET current_task_id = NULL`
  );

  console.log('All in-progress tasks reset to pending, humans cleared.');
  await pool.end();
}

main().catch(console.error);
