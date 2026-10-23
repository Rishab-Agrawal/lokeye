import fp from 'fastify-plugin';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    human: { id: string; phone: string };
  }
}

interface CachedHuman {
  id: string;
  phone: string;
  cachedAt: number;
}

const CACHE_TTL_MS = 30_000; // 30 seconds
const humanCache = new Map<string, CachedHuman>();

export function clearHumanAuthCache(humanId: string) {
  humanCache.delete(humanId);
}

export const humanAuthPlugin = fp(async (fastify: FastifyInstance) => {
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.unauthorized('Missing or invalid Authorization header');
    }

    const token = authHeader.substring(7);

    // Verify JWT with Supabase (always verify -- can't cache JWT validation)
    const { data: { user }, error } = await fastify.supabase.auth.getUser(token);

    if (error || !user) {
      return reply.unauthorized('Invalid or expired token');
    }

    // Check cache for the DB record
    const cached = humanCache.get(user.id);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      request.human = { id: cached.id, phone: cached.phone };
      return;
    }

    // Ensure human record exists (upsert on first login)
    const { rows } = await fastify.db.query(
      `INSERT INTO humans (id, phone)
       VALUES ($1, $2)
       ON CONFLICT (id) DO NOTHING
       RETURNING id, phone`,
      [user.id, user.phone]
    );

    let human: { id: string; phone: string };

    if (rows.length === 0) {
      // Already exists, fetch
      const { rows: existing } = await fastify.db.query(
        'SELECT id, phone, deleted_at FROM humans WHERE id = $1',
        [user.id]
      );
      if (existing[0]?.deleted_at) {
        clearHumanAuthCache(user.id);
        await fastify.supabase.auth.admin.signOut(user.id);
        return reply.unauthorized('Account has been deleted');
      }
      human = { id: existing[0].id, phone: existing[0].phone };
    } else {
      human = { id: rows[0].id, phone: rows[0].phone };
    }

    // Cache the result
    humanCache.set(user.id, { ...human, cachedAt: Date.now() });
    request.human = human;
  });
});
