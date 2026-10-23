import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import Expo, { ExpoPushMessage } from 'expo-server-sdk';
import { Task } from '@lokeye/shared';

const WEBHOOK_TIMEOUT_MS = 5_000;

interface NotifiableHuman {
  id: string;
  expo_push_token: string | null;
}

export class NotificationService {
  private fastify: FastifyInstance;
  private expo: Expo;

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
    this.expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });
  }

  async notifyHumansOfNewTask(
    humans: NotifiableHuman[],
    task: Task,
  ): Promise<void> {
    const messages: ExpoPushMessage[] = [];

    for (const human of humans) {
      if (!human.expo_push_token || !Expo.isExpoPushToken(human.expo_push_token)) {
        continue;
      }

      messages.push({
        to: human.expo_push_token,
        sound: 'default',
        channelId: 'default',
        title: 'New task nearby!',
        body: `${task.title} - ₹${task.bounty_rupees.toFixed(0)}`,
        data: { taskId: task.id, type: 'new_task' },
        priority: 'high',
      });
    }

    if (messages.length === 0) return;

    const chunks = this.expo.chunkPushNotifications(messages);

    for (const chunk of chunks) {
      try {
        await this.expo.sendPushNotificationsAsync(chunk);
      } catch (err) {
        this.fastify.log.error({ err }, 'Failed to send push notifications');
      }
    }
  }

  async notifyHumanOfCompletion(
    humanId: string,
    task: Task,
  ): Promise<void> {
    const { rows } = await this.fastify.db.query(
      'SELECT expo_push_token FROM humans WHERE id = $1',
      [humanId]
    );

    const token = rows[0]?.expo_push_token;
    if (!token || !Expo.isExpoPushToken(token)) return;

    try {
      await this.expo.sendPushNotificationsAsync([{
        to: token,
        sound: 'default',
        channelId: 'default',
        title: 'Task approved!',
        body: `₹${task.bounty_rupees.toFixed(0)} earned for "${task.title}"`,
        data: {
          taskId: task.id,
          type: 'task_completed',
        },
        priority: 'high',
      }]);
    } catch (err) {
      this.fastify.log.error({ err, humanId }, 'Failed to send completion notification');
    }
  }

  async notifyHumanOfRejection(
    humanId: string,
    task: Task,
    reason: string,
  ): Promise<void> {
    const { rows } = await this.fastify.db.query(
      'SELECT expo_push_token FROM humans WHERE id = $1',
      [humanId]
    );

    const token = rows[0]?.expo_push_token;
    if (!token || !Expo.isExpoPushToken(token)) return;

    try {
      await this.expo.sendPushNotificationsAsync([{
        to: token,
        sound: 'default',
        channelId: 'default',
        title: 'Task rejected',
        body: `Your submission for "${task.title}" was rejected. Reason: ${reason}`,
        data: {
          taskId: task.id,
          type: 'task_rejected',
          reason,
        },
        priority: 'high',
      }]);
    } catch (err) {
      this.fastify.log.error({ err, humanId }, 'Failed to send rejection notification');
    }
  }

  /** Send a push notification to a single human by their token. Used by telegram-webhook and others. */
  async sendPushToHuman(
    expoToken: string | null | undefined,
    title: string,
    body: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    if (!expoToken || !Expo.isExpoPushToken(expoToken)) return;

    try {
      await this.expo.sendPushNotificationsAsync([{
        to: expoToken,
        sound: 'default',
        channelId: 'default',
        title,
        body,
        data,
        priority: 'high',
      }]);
    } catch (err) {
      this.fastify.log.error({ err }, 'Failed to send push notification to human');
    }
  }

  async fireAgentWebhook(task: Task, event: string = 'task.completed'): Promise<void> {
    const { rows } = await this.fastify.db.query(
      'SELECT webhook_url, api_key_hash FROM agents WHERE id = $1',
      [task.agent_id]
    );

    const webhookUrl = rows[0]?.webhook_url;
    if (!webhookUrl) return;

    // Fetch full task with response
    const { rows: taskRows } = await this.fastify.db.query(
      `SELECT t.*,
              json_build_object(
                'text_response', tr.text_response,
                'media_urls', tr.media_urls,
                'capture_metadata', tr.capture_metadata
              ) AS response
       FROM tasks t
       LEFT JOIN task_responses tr ON tr.task_id = t.id
       WHERE t.id = $1`,
      [task.id]
    );

    const payload = JSON.stringify({ event, data: taskRows[0] });

    // HMAC signature using agent's API key hash as the shared secret
    const signature = crypto
      .createHmac('sha256', rows[0].api_key_hash)
      .update(payload)
      .digest('hex');

    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Lokeye-Signature': signature,
        },
        body: payload,
        signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
      });
    } catch (err) {
      this.fastify.log.error({ err, webhookUrl }, 'Failed to fire agent webhook');
    }
  }
}

