import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import { Pool } from 'pg';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

async function seed() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // Generate API key
  const apiKey = 'lok_' + crypto.randomBytes(24).toString('hex');
  const prefix = apiKey.substring(0, 8);
  const hash = crypto.createHash('sha256').update(apiKey).digest('hex');

  // Create test agent with ₹1,00,000 credits (100000 rupees)
  const { rows } = await pool.query(
    `INSERT INTO agents (name, api_key_hash, api_key_prefix, credits_balance)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, credits_balance`,
    ['Test Agent', hash, prefix, 100000]
  );

  // Add credit ledger entry
  await pool.query(
    `INSERT INTO agent_credit_ledger (agent_id, txn_type, amount_rupees, balance_after)
     VALUES ($1, 'topup', $2, $2)`,
    [rows[0].id, 100000]
  );

  console.log('Agent created:', JSON.stringify(rows[0], null, 2));
  console.log('API Key (save this!):', apiKey);

  await pool.end();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});

