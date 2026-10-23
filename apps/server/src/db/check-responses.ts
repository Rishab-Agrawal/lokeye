import dotenv from 'dotenv';
import path from 'path';
import { Pool } from 'pg';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const { rows } = await pool.query(
    `SELECT id, task_id, human_id, text_response, media_urls, created_at FROM task_responses ORDER BY created_at DESC`
  );
  console.log('Task responses:', JSON.stringify(rows, null, 2));
  await pool.end();
}

main().catch(console.error);
