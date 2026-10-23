import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { sendCreditTopupRequest } from '../services/telegram.js';

const LedgerQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const CreditRequestSchema = z.object({
  amount_rupees: z.number().int().min(100).max(10000),
});

export async function agentCreditsRoutes(fastify: FastifyInstance) {
  // Get credit balance
  fastify.get('/credits/balance', async (request: FastifyRequest) => {
    const { rows } = await fastify.db.query(
      'SELECT credits_balance FROM agents WHERE id = $1',
      [request.agent.id]
    );

    const balance = rows[0].credits_balance;
    return {
      success: true,
      data: {
        balance,
        currency: 'INR',
        balance_display: `INR ${balance.toFixed(0)}`,
      },
    };
  });

  // Get credit transaction ledger
  fastify.get('/credits/ledger', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = LedgerQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.badRequest(parsed.error.issues.map(i => i.message).join(', '));
    }

    const { page, limit } = parsed.data;
    const offset = (page - 1) * limit;

    const { rows } = await fastify.db.query(
      `SELECT id, txn_type, amount_rupees, balance_after, task_id, created_at
       FROM agent_credit_ledger
       WHERE agent_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [request.agent.id, limit, offset]
    );

    const { rows: countRows } = await fastify.db.query(
      'SELECT COUNT(*) FROM agent_credit_ledger WHERE agent_id = $1',
      [request.agent.id]
    );

    return {
      success: true,
      data: rows,
      total: parseInt(countRows[0].count),
      page,
      limit,
    };
  });

  // Request credit top-up
  fastify.post('/credits/request', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = CreditRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.badRequest(parsed.error.issues.map(i => i.message).join(', '));
    }

    const { amount_rupees } = parsed.data;

    const { rows } = await fastify.db.query(
      'SELECT name, email FROM agents WHERE id = $1',
      [request.agent.id]
    );

    sendCreditTopupRequest({
      name: rows[0].name,
      email: rows[0].email,
      amount_rupees,
    }).catch(() => {});

    return {
      success: true,
      message: `Top-up request for INR ${amount_rupees} received. You will be contacted at ${rows[0].email} with payment details.`,
      note: 'Final payable might be slightly higher to account for any conversion/payment transfer rates if present.',
    };
  });
}
