import dotenv from 'dotenv';
import path from 'path';
import { Pool } from 'pg';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const { rows } = await pool.query(
    `SELECT id, display_name, phone,
            ST_Y(last_location::geometry) as lat,
            ST_X(last_location::geometry) as lng,
            last_location_at
     FROM humans`
  );
  console.log(JSON.stringify(rows, null, 2));
  await pool.end();
}

main().catch(console.error);
