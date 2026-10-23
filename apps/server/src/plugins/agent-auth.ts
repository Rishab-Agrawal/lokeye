import fp from 'fastify-plugin';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';

declare module 'fastify' {
  interface FastifyRequest {
    agent: { id: string; name: string };
  }
}

interface CachedAgent {
  id: string;
  name: string;
  cachedAt: number;
}

const CACHE_TTL_MS = 30_000; // 30 seconds
const agentCache = new Map<string, CachedAgent>();

export const agentAuthPlugin = fp(async (fastify: FastifyInstance) => {
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const apiKey = request.headers['x-api-key'] as string;
    if (!apiKey) {
      return reply.unauthorized('Missing X-API-Key header');
    }

    const hash = crypto.createHash('sha256').update(apiKey).digest('hex');

    // Check cache first
    const cached = agentCache.get(hash);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      request.agent = { id: cached.id, name: cached.name };
      return;
    }

    const prefix = apiKey.substring(0, 8);

    const { rows } = await fastify.db.query(
      'SELECT id, name FROM agents WHERE api_key_prefix = $1 AND api_key_hash = $2 AND is_active = true',
      [prefix, hash]
    );

    if (rows.length === 0) {
      agentCache.delete(hash); // Clear stale cache entry if any
      return reply.unauthorized('Invalid API key');
    }

    // Cache the result
    agentCache.set(hash, { id: rows[0].id, name: rows[0].name, cachedAt: Date.now() });
    request.agent = { id: rows[0].id, name: rows[0].name };
  });
});
