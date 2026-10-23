import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CreateTaskSchema, ListTasksQuerySchema, RejectTaskSchema, VIDEO_MEDIA_TTL_MS, PHOTO_MEDIA_TTL_MS, MIN_DISCOVERY_CREDITS_RUPEES } from '@lokeye/shared';
import { z } from 'zod';
import { TaskService } from '../services/task.js';
import { GeoService } from '../services/geo.js';
import { extractStoragePath } from '../utils/storage.js';
import { isValidUUID } from '../utils/validation.js';

const WebhookUrlSchema = z.object({
  webhook_url: z.string().url().nullable().optional(),
});

const AvailabilityQuerySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});

const MediaQuerySchema = z.object({
  format: z.enum(['urls', 'proxy']).default('urls'),
  index: z.coerce.number().int().min(0).optional(),
});

export async function agentRoutes(fastify: FastifyInstance) {
  const taskService = new TaskService(fastify);
  const geoService = new GeoService(fastify);
  const hasDiscoveryCredits = async (agentId: string): Promise<boolean> => {
    const { rows } = await fastify.db.query(
      'SELECT credits_balance FROM agents WHERE id = $1',
      [agentId]
    );
    return Number(rows[0]?.credits_balance ?? 0) >= MIN_DISCOVERY_CREDITS_RUPEES;
  };

  // Create a task
  fastify.post('/tasks', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = CreateTaskSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.badRequest(parsed.error.issues.map(i => i.message).join(', '));
    }

    const task = await taskService.createTask(request.agent.id, parsed.data);
    return reply.code(201).send({ success: true, data: task });
  });

  // List agent's tasks
  fastify.get('/tasks', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = ListTasksQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.badRequest(parsed.error.issues.map(i => i.message).join(', '));
    }

    const { status, page, limit } = parsed.data;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM tasks WHERE agent_id = $1';
    const params: unknown[] = [request.agent.id];

    if (status) {
      query += ' AND status = $2';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const { rows } = await fastify.db.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM tasks WHERE agent_id = $1';
    const countParams: unknown[] = [request.agent.id];
    if (status) {
      countQuery += ' AND status = $2';
      countParams.push(status);
    }
    const { rows: countRows } = await fastify.db.query(countQuery, countParams);

    return {
      success: true,
      data: rows,
      total: parseInt(countRows[0].count),
      page,
      limit,
    };
  });

  // Get task details with response
  fastify.get('/tasks/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!isValidUUID(request.params.id)) {
      return reply.badRequest('Invalid task ID format');
    }

    const { rows } = await fastify.db.query(
      `SELECT t.*,
              json_build_object(
                'id', tr.id,
                'text_response', tr.text_response,
                'media_urls', tr.media_urls,
                'capture_metadata', tr.capture_metadata,
                'created_at', tr.created_at
              ) AS response
       FROM tasks t
       LEFT JOIN task_responses tr ON tr.task_id = t.id
       WHERE t.id = $1 AND t.agent_id = $2`,
      [request.params.id, request.agent.id]
    );

    if (rows.length === 0) {
      return reply.notFound('Task not found');
    }

    // Clean up null response
    const task = rows[0];
    if (task.response?.id === null) {
      task.response = null;
    }

    return { success: true, data: task };
  });

  // Download task media (URLs or proxied binary)
  fastify.get('/tasks/:id/media', async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    if (!isValidUUID(request.params.id)) {
      return reply.badRequest('Invalid task ID format');
    }

    const { rows } = await fastify.db.query(
      `SELECT tr.media_urls, tr.created_at, t.type
       FROM task_responses tr
       JOIN tasks t ON t.id = tr.task_id
       WHERE t.id = $1 AND t.agent_id = $2`,
      [request.params.id, request.agent.id],
    );

    if (rows.length === 0 || !rows[0].media_urls || rows[0].media_urls.length === 0) {
      return reply.notFound('No media found for this task');
    }

    const { media_urls, created_at, type } = rows[0];
    const ttl = type === 'video' ? VIDEO_MEDIA_TTL_MS : PHOTO_MEDIA_TTL_MS;
    const expiresAt = new Date(new Date(created_at).getTime() + ttl);

    const queryParsed = MediaQuerySchema.safeParse(request.query);
    if (!queryParsed.success) {
      return reply.badRequest(queryParsed.error.issues.map(i => i.message).join(', '));
    }

    const { format, index: idx } = queryParsed.data;

    if (format === 'proxy') {
      const mediaIdx = idx ?? 0;
      if (mediaIdx >= media_urls.length) {
        return reply.badRequest(`index must be 0-${media_urls.length - 1}`);
      }

      const parsed = extractStoragePath(media_urls[mediaIdx]);
      if (!parsed) {
        return reply.internalServerError('Could not parse storage path');
      }

      const { data, error } = await fastify.supabase.storage
        .from(parsed.bucket)
        .download(parsed.path);

      if (error || !data) {
        return reply.internalServerError('Failed to download file from storage');
      }

      const ext = parsed.path.split('.').pop()?.toLowerCase();
      const mimeMap: Record<string, string> = {
        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
        webp: 'image/webp', mp4: 'video/mp4', mov: 'video/quicktime',
      };
      reply.type(mimeMap[ext || ''] || 'application/octet-stream');
      const buffer = Buffer.from(await data.arrayBuffer());
      return reply.send(buffer);
    }

    // Default: return URLs + metadata
    return {
      success: true,
      data: {
        media_urls,
        count: media_urls.length,
        expires_at: expiresAt.toISOString(),
      },
    };
  });

  // Approve a submitted task
  fastify.post('/tasks/:id/approve', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!isValidUUID(request.params.id)) {
      return reply.badRequest('Invalid task ID format');
    }

    const result = await taskService.approveTask(request.params.id, request.agent.id);
    if (!result.success) {
      return reply.badRequest(result.error);
    }
    return { success: true, data: result.task };
  });

  // Reject a submitted task (requires reason)
  fastify.post('/tasks/:id/reject', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!isValidUUID(request.params.id)) {
      return reply.badRequest('Invalid task ID format');
    }

    const parsed = RejectTaskSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.badRequest(parsed.error.issues.map(i => i.message).join(', '));
    }

    const result = await taskService.rejectTask(request.params.id, request.agent.id, parsed.data.reason);
    if (!result.success) {
      return reply.badRequest(result.error);
    }
    return { success: true, data: result.task };
  });

  // Cancel a task
  fastify.delete('/tasks/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!isValidUUID(request.params.id)) {
      return reply.badRequest('Invalid task ID format');
    }

    const result = await taskService.cancelTask(request.params.id, request.agent.id);
    if (!result) {
      return reply.badRequest('Task cannot be cancelled (must be pending or assigned)');
    }
    return { success: true, data: result };
  });

  // Get all active human locations (anonymized)
  fastify.get('/humans/locations', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await hasDiscoveryCredits(request.agent.id))) {
      return reply.code(402).send({
        success: false,
        message: `Minimum INR ${MIN_DISCOVERY_CREDITS_RUPEES} credits required to access this endpoint`,
      });
    }
    const locations = await geoService.getHumanLocations();
    return { success: true, data: locations };
  });

  // Check human availability at a location
  fastify.get('/humans/availability', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await hasDiscoveryCredits(request.agent.id))) {
      return reply.code(402).send({
        success: false,
        message: `Minimum INR ${MIN_DISCOVERY_CREDITS_RUPEES} credits required to access this endpoint`,
      });
    }

    const parsed = AvailabilityQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.badRequest(parsed.error.issues.map(i => i.message).join(', '));
    }

    const result = await geoService.countNearbyHumans(parsed.data.latitude, parsed.data.longitude);
    return { success: true, data: result };
  });

  // Get/update webhook URL
  fastify.get('/webhook', async (request: FastifyRequest) => {
    const { rows } = await fastify.db.query(
      'SELECT webhook_url FROM agents WHERE id = $1',
      [request.agent.id]
    );
    return { success: true, data: { webhook_url: rows[0].webhook_url } };
  });

  fastify.put('/webhook', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = WebhookUrlSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.badRequest(parsed.error.issues.map(i => i.message).join(', '));
    }

    const webhookUrl = parsed.data.webhook_url || null;

    await fastify.db.query(
      'UPDATE agents SET webhook_url = $1 WHERE id = $2',
      [webhookUrl, request.agent.id]
    );
    return { success: true, data: { webhook_url: webhookUrl } };
  });
}

