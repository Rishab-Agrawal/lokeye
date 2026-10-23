import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { z } from 'zod';
import { sendNewAgentRegistration } from '../services/telegram.js';

const RegisterAgentSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  country: z.string().min(2).max(100),
});

export async function agentRegisterRoutes(fastify: FastifyInstance) {
  // Register a new agent (public — no auth required)
  fastify.post('/agents/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = RegisterAgentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.badRequest(parsed.error.issues.map(i => i.message).join(', '));
    }

    const { name, email, country } = parsed.data;

    // Check if email already registered
    const { rows: existing } = await fastify.db.query(
      'SELECT id FROM agents WHERE email = $1',
      [email]
    );
    if (existing.length > 0) {
      return reply.badRequest('An agent with this email already exists');
    }

    // Generate API key
    const apiKey = 'lok_' + crypto.randomBytes(24).toString('hex');
    const prefix = apiKey.substring(0, 8);
    const hash = crypto.createHash('sha256').update(apiKey).digest('hex');

    // Create agent with 0 credits
    const { rows } = await fastify.db.query(
      `INSERT INTO agents (name, email, country, api_key_hash, api_key_prefix, credits_balance)
       VALUES ($1, $2, $3, $4, $5, 0)
       RETURNING name, email, country, credits_balance`,
      [name, email, country, hash, prefix]
    );

    // Notify admin via Telegram
    sendNewAgentRegistration({ name, email, country }).catch(() => {});

    return reply.code(201).send({
      success: true,
      data: {
        ...rows[0],
        api_key: apiKey,
      },
      message: 'Save your API key — it cannot be retrieved later. You currently have 0 credits. You will receive an email at ' + email + ' to discuss payment and credit top-up.',
      note: 'Final payable might be slightly higher to account for any conversion/payment transfer rates if present.',
    });
  });
}


