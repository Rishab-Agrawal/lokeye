import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { UpdateHumanProfileSchema, UpdateLocationSchema, UpdatePushTokenSchema, MIN_WITHDRAWAL_RUPEES } from '@lokeye/shared';
import { z } from 'zod';
import { sendHumanSupportMessage, sendWithdrawalRequest } from '../services/telegram.js';
import { clearHumanAuthCache } from '../plugins/human-auth.js';

const HumanSupportSchema = z.object({
  message: z.string().min(1).max(100),
});

async function createWithdrawalRequestForHuman(
  fastify: FastifyInstance,
  humanId: string,
  human: { display_name: string | null; phone: string; upi_vpa: string | null; wallet_rupees: number },
) {
  if (!human.upi_vpa) {
    return { ok: false as const, error: 'Please set your UPI ID in your profile first' };
  }

  if (human.wallet_rupees < MIN_WITHDRAWAL_RUPEES) {
    return { ok: false as const, error: `Minimum withdrawal is ₹${MIN_WITHDRAWAL_RUPEES}` };
  }

  const { rows: existing } = await fastify.db.query(
    `SELECT id FROM withdrawal_requests WHERE human_id = $1 AND status = 'pending'`,
    [humanId]
  );
  if (existing.length > 0) {
    return { ok: false as const, error: 'You already have a pending withdrawal' };
  }

  const amount = human.wallet_rupees;
  const { rows: inserted } = await fastify.db.query(
    `INSERT INTO withdrawal_requests (human_id, amount_rupees, upi_vpa)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [humanId, amount, human.upi_vpa]
  );

  const withdrawal = inserted[0];
  const messageId = await sendWithdrawalRequest({
    id: withdrawal.id,
    human_name: human.display_name || human.phone,
    human_phone: human.phone,
    upi_vpa: human.upi_vpa,
    amount_rupees: amount,
  });

  if (messageId) {
    await fastify.db.query(
      'UPDATE withdrawal_requests SET telegram_message_id = $1 WHERE id = $2',
      [messageId, withdrawal.id]
    );
    withdrawal.telegram_message_id = messageId;
  }

  return { ok: true as const, withdrawal };
}

export async function humanRoutes(fastify: FastifyInstance) {
  // Get human profile
  fastify.get('/profile', async (request: FastifyRequest) => {
    const { rows } = await fastify.db.query(
      `SELECT id, phone, display_name, upi_vpa, wallet_rupees, tasks_completed,
              ST_Y(last_location::geometry) as latitude,
              ST_X(last_location::geometry) as longitude,
              last_location_at, created_at
       FROM humans WHERE id = $1`,
      [request.human.id]
    );

    return { success: true, data: rows[0] };
  });

  // Update human profile
  fastify.put('/profile', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = UpdateHumanProfileSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.badRequest(parsed.error.issues.map(i => i.message).join(', '));
    }

    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (parsed.data.display_name) {
      updates.push(`display_name = $${paramIdx++}`);
      params.push(parsed.data.display_name);
    }
    if (parsed.data.upi_vpa) {
      updates.push(`upi_vpa = $${paramIdx++}`);
      params.push(parsed.data.upi_vpa);
    }

    params.push(request.human.id);
    const { rows } = await fastify.db.query(
      `UPDATE humans SET ${updates.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
      params
    );

    return { success: true, data: rows[0] };
  });

  // Update location
  fastify.put('/location', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = UpdateLocationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.badRequest(parsed.error.issues.map(i => i.message).join(', '));
    }

    const { latitude, longitude } = parsed.data;
    await fastify.db.query(
      `UPDATE humans
       SET last_location = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
           last_location_at = NOW()
       WHERE id = $3`,
      [longitude, latitude, request.human.id]
    );

    return { success: true };
  });

  // Update push token
  fastify.put('/push-token', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = UpdatePushTokenSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.badRequest(parsed.error.issues.map(i => i.message).join(', '));
    }

    await fastify.db.query(
      'UPDATE humans SET expo_push_token = $1 WHERE id = $2',
      [parsed.data.expo_push_token, request.human.id]
    );

    return { success: true };
  });

  // Submit support message (max 1 per 60 minutes)
  fastify.post('/support', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = HumanSupportSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.badRequest(parsed.error.issues.map(i => i.message).join(', '));
    }

    const humanId = request.human.id;

    // Sanitize and normalize user-provided text on server side.
    const normalized = parsed.data.message
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100);

    if (!normalized) {
      return reply.badRequest('Message cannot be empty');
    }

    // Rate limit: 1 support request per 60 minutes per human.
    const { rows: recentRows } = await fastify.db.query(
      `SELECT id
       FROM human_support_requests
       WHERE human_id = $1
         AND created_at > NOW() - INTERVAL '60 minutes'
       LIMIT 1`,
      [humanId]
    );
    if (recentRows.length > 0) {
      return reply.code(429).send({
        success: false,
        error: 'You can send one support request every 60 minutes.',
      });
    }

    const { rows: humanRows } = await fastify.db.query(
      `SELECT id, display_name, phone
       FROM humans
       WHERE id = $1
       LIMIT 1`,
      [humanId]
    );
    if (humanRows.length === 0) {
      return reply.notFound('Human profile not found');
    }
    const human = humanRows[0];

    await fastify.db.query(
      `INSERT INTO human_support_requests (human_id, message)
       VALUES ($1, $2)`,
      [humanId, normalized]
    );

    await sendHumanSupportMessage({
      id: human.id,
      phone: human.phone,
      display_name: human.display_name,
      message: normalized,
    });

    return { success: true };
  });

  // Get earnings
  fastify.get('/earnings', async (request: FastifyRequest) => {
    const { rows: humanRows } = await fastify.db.query(
      'SELECT wallet_rupees, tasks_completed FROM humans WHERE id = $1',
      [request.human.id]
    );

    // Task history from human_task_history (survives rejection/reassignment)
    const { rows: taskHistory } = await fastify.db.query(
      `SELECT h.id, t.title, h.bounty_rupees, h.outcome, h.updated_at
       FROM human_task_history h
       JOIN tasks t ON t.id = h.task_id
       WHERE h.human_id = $1
       ORDER BY h.updated_at DESC
       LIMIT 50`,
      [request.human.id]
    );

    // Lifetime earned = SUM of completed task history (never decreases)
    const { rows: lifetimeRows } = await fastify.db.query(
      `SELECT COALESCE(SUM(bounty_rupees), 0)::int AS lifetime_earned
       FROM human_task_history
       WHERE human_id = $1 AND outcome = 'completed'`,
      [request.human.id]
    );

    // Pending withdrawal (at most one)
    const { rows: withdrawalRows } = await fastify.db.query(
      `SELECT * FROM withdrawal_requests
       WHERE human_id = $1 AND status = 'pending'
       LIMIT 1`,
      [request.human.id]
    );

    return {
      success: true,
      data: {
        wallet_rupees: humanRows[0].wallet_rupees,
        lifetime_earned: lifetimeRows[0].lifetime_earned,
        tasks_completed: humanRows[0].tasks_completed,
        task_history: taskHistory,
        pending_withdrawal: withdrawalRows[0] || null,
      },
    };
  });

  // Request withdrawal
  fastify.post('/withdraw', async (request: FastifyRequest, reply: FastifyReply) => {
    const humanId = request.human.id;

    // Fetch human details
    const { rows: humanRows } = await fastify.db.query(
      'SELECT display_name, phone, upi_vpa, wallet_rupees FROM humans WHERE id = $1',
      [humanId]
    );
    const human = humanRows[0];
    const result = await createWithdrawalRequestForHuman(fastify, humanId, human);
    if (!result.ok) {
      return reply.badRequest(result.error);
    }

    return { success: true, data: result.withdrawal };
  });

  // Close account (soft-delete + retention)
  fastify.post('/close-account', async (request: FastifyRequest, reply: FastifyReply) => {
    const humanId = request.human.id;

    const { rows: humanRows } = await fastify.db.query(
      `SELECT id, phone, display_name, upi_vpa, wallet_rupees, current_task_id, deleted_at
       FROM humans
       WHERE id = $1
       LIMIT 1`,
      [humanId]
    );

    if (humanRows.length === 0) {
      return reply.notFound('Human profile not found');
    }

    const human = humanRows[0];

    if (human.deleted_at) {
      return {
        success: true,
        data: {
          action: 'deleted',
          message: 'Account has already been deleted.',
        },
      };
    }

    const { rows: pendingTaskRows } = await fastify.db.query(
      `SELECT status
       FROM tasks
       WHERE human_id = $1
         AND status IN ('assigned', 'in_progress', 'submitted')
       LIMIT 1`,
      [humanId]
    );

    if (pendingTaskRows.length > 0) {
      const status = pendingTaskRows[0].status as string;
      const message = status === 'submitted'
        ? 'Please wait for pending task approvals or rejections and try again.'
        : 'Please complete or cancel your active task and try again.';

      return {
        success: true,
        data: {
          action: 'pending_tasks',
          message,
        },
      };
    }

    const { rows: pendingWithdrawalRows } = await fastify.db.query(
      `SELECT id
       FROM withdrawal_requests
       WHERE human_id = $1 AND status = 'pending'
       LIMIT 1`,
      [humanId]
    );

    if (pendingWithdrawalRows.length > 0) {
      return {
        success: true,
        data: {
          action: 'pending_withdrawal',
          message: 'Withdrawal request is pending. Please wait and try again.',
        },
      };
    }

    if (human.wallet_rupees > 0) {
      const withdrawalResult = await createWithdrawalRequestForHuman(fastify, humanId, human);
      if (!withdrawalResult.ok) {
        return {
          success: true,
          data: {
            action: 'missing_upi',
            message: withdrawalResult.error,
          },
        };
      }

      return {
        success: true,
        data: {
          action: 'withdrawal_requested',
          message: 'Withdrawal request raised. Please wait to receive the amount and try again.',
        },
      };
    }

    const client = await fastify.db.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO human_account_retention (
           human_id, retained_display_name, retained_phone, retained_upi_vpa, retention_reason
         )
         VALUES ($1, $2, $3, $4, 'user_requested_account_closure')
         ON CONFLICT (human_id) DO UPDATE
         SET retained_display_name = EXCLUDED.retained_display_name,
             retained_phone = EXCLUDED.retained_phone,
             retained_upi_vpa = EXCLUDED.retained_upi_vpa,
             retention_reason = EXCLUDED.retention_reason,
             deleted_at = NOW()`,
        [human.id, human.display_name, human.phone, human.upi_vpa]
      );

      await client.query(
        `UPDATE humans
         SET phone = $2,
             display_name = NULL,
             upi_vpa = NULL,
             expo_push_token = NULL,
             last_location = NULL,
             last_location_at = NULL,
             current_task_id = NULL,
             is_active = false,
             deletion_requested_at = NOW(),
             deleted_at = NOW(),
             deletion_reason = 'user_requested_account_closure',
             updated_at = NOW()
         WHERE id = $1`,
        [human.id, `deleted:${human.id}`]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      fastify.log.error({ err, humanId }, 'Failed to close human account');
      return reply.internalServerError('Failed to delete account');
    } finally {
      client.release();
    }

    clearHumanAuthCache(humanId);

    const { error: deleteAuthError } = await fastify.supabase.auth.admin.deleteUser(humanId);
    if (deleteAuthError) {
      fastify.log.error({ err: deleteAuthError, humanId }, 'Failed to delete auth user during account closure');
      await fastify.supabase.auth.admin.signOut(humanId);
    }

    return {
      success: true,
      data: {
        action: 'deleted',
        message: 'Account deleted successfully.',
      },
    };
  });
}
