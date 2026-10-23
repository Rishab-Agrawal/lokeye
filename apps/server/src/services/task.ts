import { FastifyInstance } from 'fastify';
import { PoolClient } from 'pg';
import {
  CreateTaskRequest,
  SubmitTaskRequest,
  Task,
  AUTO_APPROVE_DELAY_MS,
  TASK_ACCEPT_TIMEOUT_MS,
  TASK_RADIUS_METERS,
  MAX_SUBMISSION_DISTANCE_METERS,
  AGENT_REJECTION_FLAG_PERCENT,
} from '@lokeye/shared';
import { GeoService } from './geo.js';
import { NotificationService } from './notification.js';
import { sendAgentRejectionThresholdAlert } from './telegram.js';

interface TaskResult {
  success: boolean;
  task?: Task;
  error?: string;
}

export class TaskService {
  private fastify: FastifyInstance;
  private geoService: GeoService;
  private notificationService: NotificationService;

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
    this.geoService = new GeoService(fastify);
    this.notificationService = new NotificationService(fastify);
  }

  /** Helper to run a callback inside a transaction. Handles BEGIN/COMMIT/ROLLBACK and client release. */
  private async withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.fastify.db.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async createTask(agentId: string, data: CreateTaskRequest): Promise<Task> {
    const task = await this.withTransaction(async (client) => {
      // Check agent has sufficient credits (FOR UPDATE locks the row within this transaction)
      const { rows: agentRows } = await client.query(
        'SELECT credits_balance FROM agents WHERE id = $1 FOR UPDATE',
        [agentId]
      );

      if (agentRows[0].credits_balance < data.bounty_rupees) {
        throw new Error('Insufficient credits');
      }

      // Create task
      const { rows: taskRows } = await client.query(
        `INSERT INTO tasks (agent_id, type, title, description, instructions, location, radius_meters, bounty_rupees, deadline)
         VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography, $8, $9, $10)
         RETURNING *`,
        [agentId, data.type, data.title, data.description, data.instructions || null,
         data.longitude, data.latitude, TASK_RADIUS_METERS, data.bounty_rupees, data.deadline]
      );

      const createdTask = taskRows[0] as Task;

      // Hold credits
      await client.query(
        'UPDATE agents SET credits_balance = credits_balance - $1 WHERE id = $2',
        [data.bounty_rupees, agentId]
      );

      await client.query(
        `INSERT INTO agent_credit_ledger (agent_id, txn_type, amount_rupees, balance_after, task_id)
         VALUES ($1, 'task_hold', $2, (SELECT credits_balance FROM agents WHERE id = $1), $3)`,
        [agentId, -data.bounty_rupees, createdTask.id]
      );

      return createdTask;
    });

    // Notifications happen outside the transaction (best-effort, non-critical)
    const humans = await this.geoService.findNearbyHumans(task.id);
    if (humans.length > 0) {
      await this.notificationService.notifyHumansOfNewTask(humans, task);
    }

    return task;
  }

  async acceptTask(taskId: string, humanId: string): Promise<TaskResult> {
    return this.withTransaction(async (client) => {
      // Optimistic locking: try to claim the task first
      const { rows } = await client.query(
        `UPDATE tasks
         SET status = 'assigned', human_id = $1, assigned_at = NOW()
         WHERE id = $2 AND status = 'pending'
         RETURNING *`,
        [humanId, taskId]
      );

      if (rows.length === 0) {
        return { success: false, error: 'Task is no longer available' };
      }

      // Atomically set human's current task only if they don't already have one
      const { rowCount } = await client.query(
        'UPDATE humans SET current_task_id = $1 WHERE id = $2 AND current_task_id IS NULL',
        [taskId, humanId]
      );

      if (rowCount === 0) {
        // Human already has an active task -- roll back the task claim
        await client.query(
          `UPDATE tasks SET status = 'pending', human_id = NULL, assigned_at = NULL WHERE id = $1`,
          [taskId]
        );
        return { success: false, error: 'You already have an active task' };
      }

      // Cron handles auto-abandon -- no setTimeout needed
      return { success: true, task: rows[0] as Task };
    });
  }

  async startTask(taskId: string, humanId: string): Promise<TaskResult> {
    const { rows } = await this.fastify.db.query(
      `UPDATE tasks
       SET status = 'in_progress', started_at = NOW()
       WHERE id = $1 AND human_id = $2 AND status = 'assigned'
       RETURNING *`,
      [taskId, humanId]
    );

    if (rows.length === 0) {
      return { success: false, error: 'Task not found or not in assigned state' };
    }

    return { success: true, task: rows[0] as Task };
  }

  async submitTask(taskId: string, humanId: string, data: SubmitTaskRequest): Promise<TaskResult> {
    const task = await this.withTransaction(async (client) => {
      // Verify task ownership and state
      const { rows: taskRows } = await client.query(
        `SELECT * FROM tasks WHERE id = $1 AND human_id = $2 AND status IN ('assigned', 'in_progress')`,
        [taskId, humanId]
      );

      if (taskRows.length === 0) {
        return null;
      }

      // Validate capture location is within reasonable distance of task location
      // Allows 2x the task radius to account for GPS drift
      if (data.capture_latitude != null && data.capture_longitude != null && taskRows[0].location) {
        const { rows: distRows } = await client.query(
          `SELECT ST_Distance(
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
            location
          ) AS distance_meters FROM tasks WHERE id = $3`,
          [data.capture_longitude, data.capture_latitude, taskId],
        );
        const distance = distRows[0]?.distance_meters ?? 0;
        if (distance > MAX_SUBMISSION_DISTANCE_METERS) {
          return 'too_far';
        }
      }

      // Create response (upsert: delete old response if resubmitting after rejection)
      await client.query('DELETE FROM task_responses WHERE task_id = $1', [taskId]);

      // Parameterized capture location (fix SQL injection)
      if (data.capture_latitude != null && data.capture_longitude != null) {
        await client.query(
          `INSERT INTO task_responses (task_id, human_id, text_response, media_urls, capture_location, capture_metadata)
           VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography, $7)`,
          [taskId, humanId, data.text_response || null, data.media_urls || [],
           data.capture_longitude, data.capture_latitude, data.capture_metadata || null]
        );
      } else {
        await client.query(
          `INSERT INTO task_responses (task_id, human_id, text_response, media_urls, capture_location, capture_metadata)
           VALUES ($1, $2, $3, $4, NULL, $5)`,
          [taskId, humanId, data.text_response || null, data.media_urls || [], data.capture_metadata || null]
        );
      }

      // Update task status
      const { rows } = await client.query(
        `UPDATE tasks SET status = 'submitted', submitted_at = NOW()
         WHERE id = $1 RETURNING *`,
        [taskId]
      );

      // Record in human task history
      await client.query(
        `INSERT INTO human_task_history (human_id, task_id, outcome, bounty_rupees)
         VALUES ($1, $2, 'submitted', $3)`,
        [humanId, taskId, taskRows[0].bounty_rupees]
      );

      // Free the human to accept new tasks while this one is under review
      await client.query(
        'UPDATE humans SET current_task_id = NULL WHERE id = $1',
        [humanId]
      );

      return rows[0] as Task;
    });

    if (task === 'too_far') {
      return { success: false, error: 'You are too far from the task location. Please move closer and try again.' };
    }

    if (!task) {
      return { success: false, error: 'Task not found or not in correct state' };
    }

    // Notifications outside transaction (best-effort)
    await this.notificationService.fireAgentWebhook(task, 'task.submitted');

    // Cron handles auto-approve -- no setTimeout needed
    return { success: true, task };
  }

  async approveTask(taskId: string, agentId: string): Promise<TaskResult> {
    const task = await this.withTransaction(async (client) => {
      // Verify task ownership and submitted state
      const { rows } = await client.query(
        `UPDATE tasks SET status = 'completed', completed_at = NOW()
         WHERE id = $1 AND agent_id = $2 AND status = 'submitted'
         RETURNING *`,
        [taskId, agentId]
      );

      if (rows.length === 0) return null;

      const approvedTask = rows[0] as Task;

      // Track agent review stats
      await client.query(
        'UPDATE agents SET total_reviews = total_reviews + 1 WHERE id = $1',
        [agentId]
      );

      // Complete the task within the same transaction
      await this.completeTaskInTxn(client, approvedTask);

      return approvedTask;
    });

    if (!task) {
      return { success: false, error: 'Task not found or not in submitted state' };
    }

    // Notifications outside transaction
    await this.notificationService.fireAgentWebhook(task, 'task.completed');
    await this.notificationService.notifyHumanOfCompletion(task.human_id!, task);

    return { success: true, task };
  }

  async rejectTask(taskId: string, agentId: string, reason: string): Promise<TaskResult> {
    let thresholdAlert:
      | {
          name: string | null;
          email: string;
          rejection_rate_percent: number;
          threshold_percent: number;
          total_reviews: number;
          total_rejections: number;
          credits_balance: number;
        }
      | null = null;

    const result = await this.withTransaction(async (client) => {
      // Verify task ownership and submitted state
      const { rows: taskRows } = await client.query(
        `SELECT * FROM tasks WHERE id = $1 AND agent_id = $2 AND status = 'submitted'`,
        [taskId, agentId]
      );

      if (taskRows.length === 0) return null;

      const task = taskRows[0] as Task;
      const newRejectionCount = task.rejection_count + 1;

      // Track agent review stats
      const { rows: agentRows } = await client.query(
        `UPDATE agents
         SET total_reviews = total_reviews + 1, total_rejections = total_rejections + 1
         WHERE id = $1
         RETURNING name, email, credits_balance, total_reviews, total_rejections`,
        [agentId]
      );
      const agent = agentRows[0];
      const prevReviews = Math.max(agent.total_reviews - 1, 0);
      const prevRejections = Math.max(agent.total_rejections - 1, 0);
      const prevRate = (prevRejections / Math.max(prevReviews, 10)) * 100;
      const rejectionRate = (agent.total_rejections / Math.max(agent.total_reviews, 10)) * 100;
      if (rejectionRate > AGENT_REJECTION_FLAG_PERCENT) {
        this.fastify.log.warn(
          { agentId, rejectionRate: rejectionRate.toFixed(1), total_reviews: agent.total_reviews },
          'Agent rejection rate exceeds threshold'
        );

        if (prevRate <= AGENT_REJECTION_FLAG_PERCENT) {
          thresholdAlert = {
            name: agent.name ?? null,
            email: agent.email,
            rejection_rate_percent: rejectionRate,
            threshold_percent: AGENT_REJECTION_FLAG_PERCENT,
            total_reviews: agent.total_reviews,
            total_rejections: agent.total_rejections,
            credits_balance: agent.credits_balance,
          };
        }
      }

      // Update the latest human task history entry to rejected
      await client.query(
        `UPDATE human_task_history SET outcome = 'rejected', updated_at = NOW()
         WHERE id = (
           SELECT id FROM human_task_history
           WHERE human_id = $1 AND task_id = $2
           ORDER BY created_at DESC LIMIT 1
         )`,
        [task.human_id, taskId]
      );

      // Delete media from storage, then delete the response row
      const { rows: responseRows } = await client.query(
        'SELECT media_urls FROM task_responses WHERE task_id = $1',
        [taskId]
      );
      if (responseRows.length > 0 && responseRows[0].media_urls?.length > 0) {
        const paths: string[] = [];
        for (const url of responseRows[0].media_urls) {
          const match = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
          if (match) paths.push(match[2]);
        }
        if (paths.length > 0) {
          const { error } = await this.fastify.supabase.storage.from('task-media').remove(paths);
          if (error) {
            this.fastify.log.warn({ err: error, taskId }, 'Failed to delete media on rejection');
          }
        }
      }
      await client.query('DELETE FROM task_responses WHERE task_id = $1', [taskId]);

      // Return task to pool immediately
      const { rows } = await client.query(
        `UPDATE tasks
         SET status = 'pending', human_id = NULL, assigned_at = NULL, started_at = NULL,
             submitted_at = NULL, rejection_reason = $2, rejection_count = $3
         WHERE id = $1
         RETURNING *`,
        [taskId, reason, newRejectionCount]
      );

      // Human's current_task_id was already cleared on submit, but clear defensively
      await client.query(
        'UPDATE humans SET current_task_id = NULL WHERE id = $1 AND current_task_id = $2',
        [task.human_id, taskId]
      );

      return { task: rows[0] as Task, humanId: task.human_id! };
    });

    if (!result) {
      return { success: false, error: 'Task not found or not in submitted state' };
    }

    // Notifications outside transaction
    await this.notificationService.notifyHumanOfRejection(result.humanId, result.task, reason);

    const humans = await this.geoService.findNearbyHumans(taskId);
    if (humans.length > 0) {
      await this.notificationService.notifyHumansOfNewTask(humans, result.task);
    }

    if (thresholdAlert) {
      sendAgentRejectionThresholdAlert(thresholdAlert).catch((err) => {
        this.fastify.log.error({ err, agentId }, 'Failed to send agent threshold alert to Telegram');
      });
    }

    return { success: true, task: result.task };
  }

  async autoApproveTask(taskId: string): Promise<void> {
    const task = await this.withTransaction(async (client) => {
      // Only complete if still in submitted state (agent hasn't reviewed yet)
      const { rows } = await client.query(
        `UPDATE tasks SET status = 'completed', completed_at = NOW()
         WHERE id = $1 AND status = 'submitted'
         RETURNING *`,
        [taskId]
      );

      if (rows.length === 0) return null;

      const approvedTask = rows[0] as Task;
      this.fastify.log.info({ taskId }, 'Task auto-approved after review timeout');

      // Track as a review (auto-approve counts as approval)
      await client.query(
        'UPDATE agents SET total_reviews = total_reviews + 1 WHERE id = $1',
        [approvedTask.agent_id]
      );

      await this.completeTaskInTxn(client, approvedTask);

      return approvedTask;
    });

    if (task) {
      await this.notificationService.fireAgentWebhook(task, 'task.completed');
      await this.notificationService.notifyHumanOfCompletion(task.human_id!, task);
    }
  }

  /**
   * Auto-approve submitted tasks that have been waiting longer than the review window.
   * Called by cron every minute.
   */
  async autoApproveStaleSubmissions(): Promise<number> {
    const db = this.fastify.db;

    const { rows } = await db.query(
      `UPDATE tasks SET status = 'completed', completed_at = NOW()
       WHERE id IN (
         SELECT id FROM tasks
         WHERE status = 'submitted'
         AND submitted_at < NOW() - INTERVAL '${AUTO_APPROVE_DELAY_MS / 1000} seconds'
         LIMIT 50
       )
       RETURNING *`
    );

    for (const row of rows) {
      const task = row as Task;
      this.fastify.log.info({ taskId: task.id }, 'Stale submission auto-approved by cron');

      try {
        await this.withTransaction(async (client) => {
          await client.query(
            'UPDATE agents SET total_reviews = total_reviews + 1 WHERE id = $1',
            [task.agent_id]
          );
          await this.completeTaskInTxn(client, task);
        });
        await this.notificationService.fireAgentWebhook(task, 'task.completed');
        await this.notificationService.notifyHumanOfCompletion(task.human_id!, task);
      } catch (err) {
        this.fastify.log.error({ err, taskId: task.id }, 'Failed to complete stale auto-approved task');
      }
    }

    return rows.length;
  }

  /**
   * Auto-abandon a task if the human hasn't submitted within the timeout.
   */
  async autoAbandonTask(taskId: string, humanId: string): Promise<void> {
    const db = this.fastify.db;

    // Only abandon if still assigned/in_progress by the same human
    const { rows } = await db.query(
      `UPDATE tasks
       SET status = 'pending', human_id = NULL, assigned_at = NULL, started_at = NULL
       WHERE id = $1 AND human_id = $2 AND status IN ('assigned', 'in_progress')
       RETURNING *`,
      [taskId, humanId]
    );

    if (rows.length === 0) return;

    const task = rows[0] as Task;
    this.fastify.log.info({ taskId, humanId }, 'Task auto-abandoned after acceptance timeout');

    // Clear human's current task
    await db.query(
      'UPDATE humans SET current_task_id = NULL WHERE id = $1 AND current_task_id = $2',
      [humanId, taskId]
    );

    // Re-notify humans nearby to task location
    const humans = await this.geoService.findNearbyHumans(taskId);
    if (humans.length > 0) {
      await this.notificationService.notifyHumansOfNewTask(humans, task);
    }
  }

  /**
   * Auto-abandon tasks that have been accepted but not submitted within the timeout.
   * Called by cron every minute.
   */
  async autoAbandonStaleAcceptances(): Promise<number> {
    const db = this.fastify.db;
    const timeoutSeconds = TASK_ACCEPT_TIMEOUT_MS / 1000;

    const { rows } = await db.query(
      `SELECT id, human_id FROM tasks
       WHERE status IN ('assigned', 'in_progress')
       AND assigned_at < NOW() - INTERVAL '${timeoutSeconds} seconds'
       LIMIT 50`
    );

    for (const task of rows) {
      await this.autoAbandonTask(task.id, task.human_id);
    }

    return rows.length;
  }

  /** Complete a task within an existing transaction (update human stats, history, ledger). */
  private async completeTaskInTxn(client: PoolClient, task: Task): Promise<void> {
    // Update human stats
    await client.query(
      'UPDATE humans SET tasks_completed = tasks_completed + 1, wallet_rupees = wallet_rupees + $1 WHERE id = $2',
      [task.bounty_rupees, task.human_id]
    );

    // Update the latest human task history entry to completed
    await client.query(
      `UPDATE human_task_history SET outcome = 'completed', updated_at = NOW()
       WHERE id = (
         SELECT id FROM human_task_history
         WHERE human_id = $1 AND task_id = $2
         ORDER BY created_at DESC LIMIT 1
       )`,
      [task.human_id, task.id]
    );

    // Charge agent credits (already held, so just record the ledger entry)
    await client.query(
      `INSERT INTO agent_credit_ledger (agent_id, txn_type, amount_rupees, balance_after, task_id)
       VALUES ($1, 'task_charge', $2, (SELECT credits_balance FROM agents WHERE id = $1), $3)`,
      [task.agent_id, -task.bounty_rupees, task.id]
    );
  }

  async abandonTask(taskId: string, humanId: string): Promise<TaskResult> {
    const db = this.fastify.db;

    const { rows } = await db.query(
      `UPDATE tasks SET status = 'pending', human_id = NULL, assigned_at = NULL, started_at = NULL,
              rejection_reason = NULL, rejection_count = 0
       WHERE id = $1 AND human_id = $2 AND status IN ('assigned', 'in_progress')
       RETURNING *`,
      [taskId, humanId]
    );

    if (rows.length === 0) {
      return { success: false, error: 'Task not found or cannot be abandoned' };
    }

    const task = rows[0] as Task;

    // Clear human's current task
    await db.query(
      'UPDATE humans SET current_task_id = NULL WHERE id = $1',
      [humanId]
    );

    // Re-notify humans nearby to task location
    const humans = await this.geoService.findNearbyHumans(taskId);
    if (humans.length > 0) {
      await this.notificationService.notifyHumansOfNewTask(humans, task);
    }

    return { success: true, task };
  }

  async cancelTask(taskId: string, agentId: string): Promise<Task | null> {
    return this.withTransaction(async (client) => {
      const { rows } = await client.query(
        `UPDATE tasks SET status = 'cancelled'
         WHERE id = $1 AND agent_id = $2 AND status IN ('pending', 'assigned')
         RETURNING *`,
        [taskId, agentId]
      );

      if (rows.length === 0) return null;

      const task = rows[0] as Task;

      // Release held credits
      await client.query(
        'UPDATE agents SET credits_balance = credits_balance + $1 WHERE id = $2',
        [task.bounty_rupees, agentId]
      );

      await client.query(
        `INSERT INTO agent_credit_ledger (agent_id, txn_type, amount_rupees, balance_after, task_id)
         VALUES ($1, 'task_release', $2, (SELECT credits_balance FROM agents WHERE id = $1), $3)`,
        [agentId, task.bounty_rupees, taskId]
      );

      // Clear human's current task if assigned
      if (task.human_id) {
        await client.query(
          'UPDATE humans SET current_task_id = NULL WHERE id = $1',
          [task.human_id]
        );
      }

      return task;
    });
  }

  async expireOverdueTasks(): Promise<number> {
    const db = this.fastify.db;

    const { rows } = await db.query(
      `UPDATE tasks SET status = 'expired'
       WHERE id IN (
         SELECT id FROM tasks
         WHERE status IN ('pending', 'assigned', 'in_progress')
         AND deadline < NOW()
         LIMIT 50
       )
       RETURNING id, agent_id, human_id, bounty_rupees`
    );

    for (const row of rows) {
      try {
        await this.withTransaction(async (client) => {
          // Release held credits
          await client.query(
            'UPDATE agents SET credits_balance = credits_balance + $1 WHERE id = $2',
            [row.bounty_rupees, row.agent_id]
          );

          await client.query(
            `INSERT INTO agent_credit_ledger (agent_id, txn_type, amount_rupees, balance_after, task_id)
             VALUES ($1, 'task_release', $2, (SELECT credits_balance FROM agents WHERE id = $1), $3)`,
            [row.agent_id, row.bounty_rupees, row.id]
          );

          // Clear human's current task if assigned
          if (row.human_id) {
            await client.query(
              'UPDATE humans SET current_task_id = NULL WHERE id = $1',
              [row.human_id]
            );
          }
        });
      } catch (err) {
        this.fastify.log.error({ err, taskId: row.id }, 'Failed to process expired task');
      }
    }

    return rows.length;
  }
}


