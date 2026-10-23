import cron from 'node-cron';
import { FastifyInstance } from 'fastify';
import { Task, VIDEO_MEDIA_TTL_MS, PHOTO_MEDIA_TTL_MS } from '@lokeye/shared';
import { TaskService } from './task.js';
import { GeoService } from './geo.js';
import { NotificationService } from './notification.js';
import { extractStoragePath } from '../utils/storage.js';

export function startTaskExpiryCron(fastify: FastifyInstance): void {
  const taskService = new TaskService(fastify);

  // Check for expired tasks every minute
  cron.schedule('* * * * *', async () => {
    try {
      const expired = await taskService.expireOverdueTasks();
      if (expired > 0) {
        fastify.log.info({ count: expired }, 'Expired overdue tasks');
      }
    } catch (err) {
      fastify.log.error({ err }, 'Task expiry cron failed');
    }

    // Auto-approve stale submissions
    try {
      const approved = await taskService.autoApproveStaleSubmissions();
      if (approved > 0) {
        fastify.log.info({ count: approved }, 'Auto-approved stale submissions');
      }
    } catch (err) {
      fastify.log.error({ err }, 'Auto-approve stale submissions cron failed');
    }

    // Auto-abandon tasks accepted but not submitted within timeout
    try {
      const abandoned = await taskService.autoAbandonStaleAcceptances();
      if (abandoned > 0) {
        fastify.log.info({ count: abandoned }, 'Auto-abandoned stale accepted tasks');
      }
    } catch (err) {
      fastify.log.error({ err }, 'Auto-abandon stale acceptances cron failed');
    }

    // Auto-delete expired media from Supabase Storage
    try {
      const videoTtl = `${Math.floor(VIDEO_MEDIA_TTL_MS / 1000)} seconds`;
      const photoTtl = `${Math.floor(PHOTO_MEDIA_TTL_MS / 1000)} seconds`;
      const { rows: staleMedia } = await fastify.db.query(
        `SELECT tr.id, tr.media_urls FROM task_responses tr
         JOIN tasks t ON t.id = tr.task_id
         WHERE tr.media_urls != '{}'
           AND (
             (t.type = 'video' AND tr.created_at < NOW() - $1::interval)
             OR (t.type != 'video' AND tr.created_at < NOW() - $2::interval)
           )
         LIMIT 50`,
        [videoTtl, photoTtl],
      );

      for (const row of staleMedia) {
        const paths: { bucket: string; path: string }[] = [];
        for (const url of row.media_urls) {
          const parsed = extractStoragePath(url);
          if (parsed) paths.push(parsed);
        }

        if (paths.length === 0) {
          // URLs don't match expected pattern — clear them anyway
          await fastify.db.query(
            `UPDATE task_responses SET media_urls = '{}' WHERE id = $1`,
            [row.id],
          );
          continue;
        }

        // Group by bucket (should all be 'task-media' but be safe)
        const byBucket = new Map<string, string[]>();
        for (const p of paths) {
          const arr = byBucket.get(p.bucket) || [];
          arr.push(p.path);
          byBucket.set(p.bucket, arr);
        }

        let allDeleted = true;
        for (const [bucket, filePaths] of byBucket) {
          const { error } = await fastify.supabase.storage.from(bucket).remove(filePaths);
          if (error) {
            fastify.log.warn({ err: error, responseId: row.id }, 'Failed to delete media from storage');
            allDeleted = false;
          }
        }

        // Only clear DB URLs if storage delete succeeded
        if (allDeleted) {
          await fastify.db.query(
            `UPDATE task_responses SET media_urls = '{}' WHERE id = $1`,
            [row.id],
          );
        }
      }

      if (staleMedia.length > 0) {
        fastify.log.info({ count: staleMedia.length }, 'Cleaned up expired media');
      }
    } catch (err) {
      fastify.log.error({ err }, 'Media cleanup cron failed');
    }
  });

  // Re-notify humans nearby to task location about pending tasks every 30 minutes
  const geoService = new GeoService(fastify);
  const notificationService = new NotificationService(fastify);

  cron.schedule('*/30 * * * *', async () => {
    try {
      // Find pending tasks older than 30 minutes that haven't been re-notified in 30 minutes (capped)
      const { rows: staleTasks } = await fastify.db.query(
        `SELECT * FROM tasks
         WHERE status = 'pending'
           AND created_at < NOW() - INTERVAL '30 minutes'
           AND (last_notified_at IS NULL OR last_notified_at < NOW() - INTERVAL '30 minutes')
         LIMIT 50`
      );

      for (const row of staleTasks) {
        const task = row as Task;
        const humans = await geoService.findNearbyHumans(task.id);
        if (humans.length > 0) {
          await notificationService.notifyHumansOfNewTask(humans, task);
        }
        await fastify.db.query(
          'UPDATE tasks SET last_notified_at = NOW() WHERE id = $1',
          [task.id]
        );
      }

      if (staleTasks.length > 0) {
        fastify.log.info({ count: staleTasks.length }, 'Re-notified humans for stale pending tasks');
      }
    } catch (err) {
      fastify.log.error({ err }, 'Task re-notification cron failed');
    }
  });

  fastify.log.info('Task cron jobs started');
}

