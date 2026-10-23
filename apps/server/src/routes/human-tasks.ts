import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { NearbyTasksQuerySchema, SubmitTaskSchema } from '@lokeye/shared';
import { TaskService } from '../services/task.js';
import { GeoService } from '../services/geo.js';
import { isValidUUID } from '../utils/validation.js';

export async function humanTaskRoutes(fastify: FastifyInstance) {
  const taskService = new TaskService(fastify);
  const geoService = new GeoService(fastify);

  // Get human's active task (includes rejection info)
  fastify.get('/tasks/active', async (request: FastifyRequest, reply: FastifyReply) => {
    const { rows } = await fastify.db.query(
      `SELECT t.* FROM tasks t
       JOIN humans h ON h.current_task_id = t.id
       WHERE h.id = $1`,
      [request.human.id]
    );

    if (rows.length === 0) {
      return { success: true, data: null };
    }

    return { success: true, data: rows[0] };
  });

  // Get nearby available tasks
  fastify.get('/tasks/nearby', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = NearbyTasksQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.badRequest(parsed.error.issues.map(i => i.message).join(', '));
    }

    const tasks = await geoService.findNearbyTasks(
      parsed.data.latitude,
      parsed.data.longitude,
      parsed.data.limit,
      (parsed.data.page - 1) * parsed.data.limit
    );

    return { success: true, data: tasks };
  });

  // Accept a task
  fastify.post('/tasks/:id/accept', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!isValidUUID(request.params.id)) {
      return reply.badRequest('Invalid task ID format');
    }

    fastify.log.info({ taskId: request.params.id, humanId: request.human.id }, 'Accept task request');
    const result = await taskService.acceptTask(request.params.id, request.human.id);
    fastify.log.info({ result: { success: result.success, error: result.error } }, 'Accept task result');
    if (!result.success) {
      return reply.badRequest(result.error);
    }
    return { success: true, data: result.task };
  });

  // Start a task (mark in progress)
  fastify.post('/tasks/:id/start', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!isValidUUID(request.params.id)) {
      return reply.badRequest('Invalid task ID format');
    }

    const result = await taskService.startTask(request.params.id, request.human.id);
    if (!result.success) {
      return reply.badRequest(result.error);
    }
    return { success: true, data: result.task };
  });

  // Submit task response
  fastify.post('/tasks/:id/submit', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!isValidUUID(request.params.id)) {
      return reply.badRequest('Invalid task ID format');
    }

    const parsed = SubmitTaskSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.badRequest(parsed.error.issues.map(i => i.message).join(', '));
    }

    const result = await taskService.submitTask(request.params.id, request.human.id, parsed.data);
    if (!result.success) {
      return reply.badRequest(result.error);
    }
    return { success: true, data: result.task };
  });

  // Abandon a task
  fastify.post('/tasks/:id/abandon', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!isValidUUID(request.params.id)) {
      return reply.badRequest('Invalid task ID format');
    }

    const result = await taskService.abandonTask(request.params.id, request.human.id);
    if (!result.success) {
      return reply.badRequest(result.error);
    }
    return { success: true, data: result.task };
  });
}

