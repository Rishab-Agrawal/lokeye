import fp from 'fastify-plugin';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
import { FastifyInstance } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    supabase: SupabaseClient;
    db: Pool;
  }
}

export const supabasePlugin = fp(async (fastify: FastifyInstance) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const databaseUrl = process.env.DATABASE_URL;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  // Supabase client with service role (bypasses RLS)
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Direct PostgreSQL pool for complex queries (PostGIS etc.)
  const db = new Pool({
    connectionString: databaseUrl,
    max: 10,
  });

  fastify.decorate('supabase', supabase);
  fastify.decorate('db', db);

  fastify.addHook('onClose', async () => {
    await db.end();
  });
});
