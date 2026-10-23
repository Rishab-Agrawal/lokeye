import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { editMessageAfterAction, answerCallbackQuery, sendMessage } from '../services/telegram.js';
import { NotificationService } from '../services/notification.js';

interface TelegramUser {
  id?: number;
  username?: string;
}

interface TelegramChat {
  id?: number;
}

interface TelegramMessage {
  text?: string;
  from?: TelegramUser;
  chat?: TelegramChat;
}

interface TelegramCallbackQuery {
  id: string;
  data?: string;
  from?: TelegramUser;
  message?: {
    chat?: TelegramChat;
  };
}

interface TelegramWebhookBody {
  callback_query?: TelegramCallbackQuery;
  message?: TelegramMessage;
}

interface ParsedCreditCommand {
  email: string;
  amountRupees: number;
  reference: string;
}

interface ParsedSetPwCommand {
  humanId: string;
  newPassword: string;
}

interface ParsedAgentEmailCommand {
  email: string;
}

const CREDIT_USAGE =
  'Usage: /credit <agent_email> <amount_inr> <confirm_amount_inr> <reference>. Example: /credit agent@example.com 500 500 upi12345';
const SETPW_USAGE =
  'Usage: /setpw <human_id> <new_password> <confirm_password>. Example: /setpw 11111111-2222-3333-4444-555555555555 NewPass123 NewPass123';
const BLOCK_AGENT_USAGE =
  'Usage: /blockagent <agent_email>. Example: /blockagent agent@example.com';
const UNBLOCK_AGENT_USAGE =
  'Usage: /unblockagent <agent_email>. Example: /unblockagent agent@example.com';

function parseCreditCommand(text: string): ParsedCreditCommand | { error: string } {
  const tokens = text.trim().split(/\s+/);
  if (tokens.length !== 5) return { error: CREDIT_USAGE };

  const command = tokens[0].split('@')[0];
  if (command !== '/credit') return { error: CREDIT_USAGE };

  const email = tokens[1].trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Invalid email format.' };
  }

  const amountA = Number(tokens[2]);
  const amountB = Number(tokens[3]);
  if (!Number.isInteger(amountA) || !Number.isInteger(amountB) || amountA <= 0 || amountB <= 0) {
    return { error: 'Amount must be a positive integer in INR.' };
  }
  if (amountA !== amountB) {
    return { error: 'Amount confirmation mismatch. Re-enter the amount twice.' };
  }

  const reference = tokens[4].trim();
  if (!/^[A-Za-z0-9._:/-]{4,64}$/.test(reference)) {
    return { error: 'Reference must be 4-64 chars: letters, numbers, ., _, :, /, -' };
  }

  return {
    email,
    amountRupees: amountA,
    reference,
  };
}

function parseSetPwCommand(text: string): ParsedSetPwCommand | { error: string } {
  const tokens = text.trim().split(/\s+/);
  if (tokens.length !== 4) return { error: SETPW_USAGE };

  const command = tokens[0].split('@')[0];
  if (command !== '/setpw') return { error: SETPW_USAGE };

  const humanId = tokens[1].trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(humanId)) {
    return { error: 'Invalid human_id format.' };
  }

  const newPassword = tokens[2];
  const confirmPassword = tokens[3];
  if (newPassword !== confirmPassword) {
    return { error: 'Password confirmation mismatch. Re-enter the same password twice.' };
  }
  if (newPassword.length < 6 || newPassword.length > 72) {
    return { error: 'Password must be 6-72 characters.' };
  }

  return { humanId, newPassword };
}

function parseAgentEmailCommand(
  text: string,
  commandName: '/blockagent' | '/unblockagent',
  usage: string,
): ParsedAgentEmailCommand | { error: string } {
  const tokens = text.trim().split(/\s+/);
  if (tokens.length !== 2) return { error: usage };

  const command = tokens[0].split('@')[0];
  if (command !== commandName) return { error: usage };

  const email = tokens[1].trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Invalid email format.' };
  }

  return { email };
}

export async function telegramWebhookRoutes(fastify: FastifyInstance) {
  const notificationService = new NotificationService(fastify);
  const adminUserIds = new Set(
    (process.env.TELEGRAM_ADMIN_USER_IDS || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id))
  );

  fastify.post('/telegram', async (request: FastifyRequest, reply: FastifyReply) => {
    // Webhook secret must be configured and must match Telegram header.
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!expectedSecret) {
      fastify.log.error('TELEGRAM_WEBHOOK_SECRET is missing');
      return reply.code(503).send({ status: 'misconfigured' });
    }
    const receivedSecret = request.headers['x-telegram-bot-api-secret-token'] as string | undefined;
    if (receivedSecret !== expectedSecret) {
      return reply.code(403).send({ status: 'forbidden' });
    }

    const body = request.body as TelegramWebhookBody;

    // Handle admin commands sent as normal bot messages.
    const message = body?.message;
    const messageText = message?.text?.trim() || '';
    const messageChatId = message?.chat?.id;
    const messageActorId = message?.from?.id;
    const messageActorUsername = message?.from?.username ?? null;

    if (messageText.startsWith('/')) {
      if (!messageActorId || !adminUserIds.has(messageActorId)) {
        if (messageChatId) {
          await sendMessage(messageChatId, 'Unauthorized');
        }
        return { status: 'ok' };
      }

      const command = messageText.split(/\s+/)[0].split('@')[0];

      if (command === '/credit') {
        const parsed = parseCreditCommand(messageText);
        if ('error' in parsed) {
          if (messageChatId) {
            await sendMessage(messageChatId, parsed.error);
          }
          return { status: 'ok' };
        }

        const { email, amountRupees, reference } = parsed;

        const client = await fastify.db.connect();
        try {
          await client.query('BEGIN');

          const dupRef = await client.query(
            `SELECT id FROM agent_credit_ledger WHERE topup_reference = $1 LIMIT 1`,
            [reference]
          );
          if (dupRef.rows.length > 0) {
            await client.query('ROLLBACK');
            if (messageChatId) {
              await sendMessage(
                messageChatId,
                `Reference already used: ${reference}. No credits added.`
              );
            }
            return { status: 'ok' };
          }

          const { rows: agentRows } = await client.query(
            `SELECT id, email, name
             FROM agents
             WHERE LOWER(email) = LOWER($1)
             FOR UPDATE`,
            [email]
          );

          if (agentRows.length === 0) {
            await client.query('ROLLBACK');
            if (messageChatId) {
              await sendMessage(messageChatId, `No agent found for email: ${email}`);
            }
            return { status: 'ok' };
          }

          const agent = agentRows[0];
          const { rows: updatedRows } = await client.query(
            `UPDATE agents
             SET credits_balance = credits_balance + $1
             WHERE id = $2
             RETURNING credits_balance`,
            [amountRupees, agent.id]
          );
          const newBalance = updatedRows[0].credits_balance as number;

          await client.query(
            `INSERT INTO agent_credit_ledger (
               agent_id, txn_type, amount_rupees, balance_after, task_id,
               handled_at, handled_by_telegram_user_id, handled_by_telegram_username,
               handled_in_chat_id, handled_via, topup_reference
             )
             VALUES (
               $1, 'topup', $2, $3, NULL,
               NOW(), $4, $5, $6, 'telegram_admin_command', $7
             )`,
            [agent.id, amountRupees, newBalance, messageActorId, messageActorUsername, messageChatId || null, reference]
          );

          await client.query('COMMIT');

          if (messageChatId) {
            await sendMessage(
              messageChatId,
              `Credited INR ${amountRupees} to ${agent.email} (${agent.name || 'Agent'}).\nReference: ${reference}\nNew balance: INR ${newBalance.toFixed(0)}`
            );
          }
        } catch (err) {
          await client.query('ROLLBACK');
          fastify.log.error({ err }, 'Failed to process /credit command');
          if (messageChatId) {
            await sendMessage(messageChatId, 'Credit command failed. Nothing was changed.');
          }
        } finally {
          client.release();
        }

        return { status: 'ok' };
      }

      if (command === '/setpw') {
        const parsed = parseSetPwCommand(messageText);
        if ('error' in parsed) {
          if (messageChatId) {
            await sendMessage(messageChatId, parsed.error);
          }
          return { status: 'ok' };
        }

        const { humanId, newPassword } = parsed;

        const { rows: humanRows } = await fastify.db.query(
          `SELECT id, display_name, phone FROM humans WHERE id = $1 LIMIT 1`,
          [humanId]
        );
        if (humanRows.length === 0) {
          if (messageChatId) {
            await sendMessage(messageChatId, `No human found for id: ${humanId}`);
          }
          return { status: 'ok' };
        }

        const { error } = await fastify.supabase.auth.admin.updateUserById(humanId, {
          password: newPassword,
        });
        if (error) {
          fastify.log.error({ err: error, humanId }, 'Failed to reset human password via Telegram command');
          if (messageChatId) {
            await sendMessage(messageChatId, `Password reset failed for ${humanId}.`);
          }
          return { status: 'ok' };
        }

        await fastify.db.query(
          `INSERT INTO human_password_reset_audit (
             human_id, reset_by_telegram_user_id, reset_by_telegram_username, reset_in_chat_id, reset_via
           )
           VALUES ($1, $2, $3, $4, 'telegram_admin_command')`,
          [humanId, messageActorId || null, messageActorUsername, messageChatId || null]
        );

        const human = humanRows[0];
        if (messageChatId) {
          await sendMessage(
            messageChatId,
            `Password reset completed.\nHuman: ${human.display_name || 'Unknown'}\nPhone: ${human.phone}\nID: ${human.id}`
          );
        }
        return { status: 'ok' };
      }

      if (command === '/blockagent') {
        const parsed = parseAgentEmailCommand(messageText, '/blockagent', BLOCK_AGENT_USAGE);
        if ('error' in parsed) {
          if (messageChatId) {
            await sendMessage(messageChatId, parsed.error);
          }
          return { status: 'ok' };
        }

        const { email } = parsed;
        const { rows } = await fastify.db.query(
          `UPDATE agents
           SET is_active = false
           WHERE LOWER(email) = LOWER($1)
           RETURNING id, name, email, is_active, credits_balance`,
          [email]
        );

        if (rows.length === 0) {
          if (messageChatId) {
            await sendMessage(messageChatId, `No agent found for email: ${email}`);
          }
          return { status: 'ok' };
        }

        const agent = rows[0];
        if (messageChatId) {
          await sendMessage(
            messageChatId,
            `Blocked agent.\nName: ${agent.name || 'Unknown'}\nEmail: ${agent.email}\nCredits: INR ${Number(agent.credits_balance).toFixed(0)}\nStatus: blocked`
          );
        }
        return { status: 'ok' };
      }

      if (command === '/unblockagent') {
        const parsed = parseAgentEmailCommand(messageText, '/unblockagent', UNBLOCK_AGENT_USAGE);
        if ('error' in parsed) {
          if (messageChatId) {
            await sendMessage(messageChatId, parsed.error);
          }
          return { status: 'ok' };
        }

        const { email } = parsed;
        const { rows } = await fastify.db.query(
          `UPDATE agents
           SET is_active = true
           WHERE LOWER(email) = LOWER($1)
           RETURNING id, name, email, is_active, credits_balance`,
          [email]
        );

        if (rows.length === 0) {
          if (messageChatId) {
            await sendMessage(messageChatId, `No agent found for email: ${email}`);
          }
          return { status: 'ok' };
        }

        const agent = rows[0];
        if (messageChatId) {
          await sendMessage(
            messageChatId,
            `Unblocked agent.\nName: ${agent.name || 'Unknown'}\nEmail: ${agent.email}\nCredits: INR ${Number(agent.credits_balance).toFixed(0)}\nStatus: active`
          );
        }
        return { status: 'ok' };
      }

      if (messageChatId) {
        await sendMessage(
          messageChatId,
          `Unknown command.\n${CREDIT_USAGE}\n${SETPW_USAGE}\n${BLOCK_AGENT_USAGE}\n${UNBLOCK_AGENT_USAGE}`
        );
      }
      return { status: 'ok' };
    }

    // Handle inline-button callbacks for withdrawal approval/rejection.
    const callbackQuery = body?.callback_query;
    if (!callbackQuery) return { status: 'ok' };

    const data = callbackQuery.data;
    const callbackId = callbackQuery.id;

    if (!data) {
      await answerCallbackQuery(callbackId);
      return { status: 'ok' };
    }

    const actorUserId = callbackQuery.from?.id;
    if (!actorUserId || !adminUserIds.has(actorUserId)) {
      await answerCallbackQuery(callbackId, 'Unauthorized');
      return { status: 'ok' };
    }

    let action: 'paid' | 'reject';
    let withdrawalId: string;

    if (data.startsWith('withdraw_paid:')) {
      action = 'paid';
      withdrawalId = data.replace('withdraw_paid:', '');
    } else if (data.startsWith('withdraw_reject:')) {
      action = 'reject';
      withdrawalId = data.replace('withdraw_reject:', '');
    } else {
      await answerCallbackQuery(callbackId);
      return { status: 'ok' };
    }

    // Validate UUID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(withdrawalId)) {
      await answerCallbackQuery(callbackId, 'Invalid withdrawal ID');
      return { status: 'ok' };
    }

    // Fetch withdrawal
    const { rows } = await fastify.db.query(
      `SELECT wr.*, h.display_name as human_name, h.expo_push_token
       FROM withdrawal_requests wr
       JOIN humans h ON h.id = wr.human_id
       WHERE wr.id = $1`,
      [withdrawalId]
    );

    if (rows.length === 0) {
      await answerCallbackQuery(callbackId, 'Withdrawal not found');
      return { status: 'ok' };
    }

    const withdrawal = rows[0];

    if (withdrawal.status !== 'pending') {
      await answerCallbackQuery(callbackId, `Already ${withdrawal.status}`);
      return { status: 'ok' };
    }

    const actorId = actorUserId ?? null;
    const actorUsername = callbackQuery.from?.username ?? null;
    const actorChatId = callbackQuery.message?.chat?.id ?? null;

    if (action === 'paid') {
      // Deduct balance from human
      await fastify.db.query(
        `UPDATE humans SET wallet_rupees = GREATEST(wallet_rupees - $1, 0) WHERE id = $2`,
        [withdrawal.amount_rupees, withdrawal.human_id]
      );

      // Mark withdrawal as completed
      await fastify.db.query(
        `UPDATE withdrawal_requests
         SET status = 'completed',
             completed_at = NOW(),
             handled_at = NOW(),
             handled_by_telegram_user_id = $2,
             handled_by_telegram_username = $3,
             handled_in_chat_id = $4,
             handled_via = 'telegram_callback',
             updated_at = NOW()
         WHERE id = $1`,
        [withdrawalId, actorId, actorUsername, actorChatId]
      );

      // Send push notification using the shared NotificationService
      await notificationService.sendPushToHuman(
        withdrawal.expo_push_token,
        'Payment received!',
        `INR ${withdrawal.amount_rupees.toFixed(0)} has been sent to your UPI.`,
        { type: 'withdrawal_update', withdrawalId: withdrawal.id },
      );

      // Edit Telegram message
      if (withdrawal.telegram_message_id) {
        await editMessageAfterAction(withdrawal.telegram_message_id, 'completed', {
          human_name: withdrawal.human_name || 'Unknown',
          amount_rupees: withdrawal.amount_rupees,
          upi_vpa: withdrawal.upi_vpa,
        });
      }

      await answerCallbackQuery(callbackId, 'Marked as paid');
    } else {
      // Mark withdrawal as rejected (balance untouched)
      await fastify.db.query(
        `UPDATE withdrawal_requests
         SET status = 'rejected',
             rejected_at = NOW(),
             handled_at = NOW(),
             handled_by_telegram_user_id = $2,
             handled_by_telegram_username = $3,
             handled_in_chat_id = $4,
             handled_via = 'telegram_callback',
             updated_at = NOW()
         WHERE id = $1`,
        [withdrawalId, actorId, actorUsername, actorChatId]
      );

      // Send push notification
      await notificationService.sendPushToHuman(
        withdrawal.expo_push_token,
        'Withdrawal rejected',
        `Your withdrawal of INR ${withdrawal.amount_rupees.toFixed(0)} was rejected.`,
        { type: 'withdrawal_update', withdrawalId: withdrawal.id },
      );

      // Edit Telegram message
      if (withdrawal.telegram_message_id) {
        await editMessageAfterAction(withdrawal.telegram_message_id, 'rejected', {
          human_name: withdrawal.human_name || 'Unknown',
          amount_rupees: withdrawal.amount_rupees,
          upi_vpa: withdrawal.upi_vpa,
        });
      }

      await answerCallbackQuery(callbackId, 'Rejected');
    }

    return { status: 'ok' };
  });
}
