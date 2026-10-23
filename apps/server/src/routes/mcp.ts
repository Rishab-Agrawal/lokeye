import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  CreateTaskSchema,
  TASK_TYPES,
  VIDEO_MEDIA_TTL_MS,
  PHOTO_MEDIA_TTL_MS,
  MIN_DISCOVERY_CREDITS_RUPEES,
} from '@lokeye/shared';
import { TaskService } from '../services/task.js';
import { GeoService } from '../services/geo.js';

// ─── Tool definitions (same as standalone MCP server) ───────

const photoTtlMin = Math.round(PHOTO_MEDIA_TTL_MS / 60000);
const videoTtlMin = Math.round(VIDEO_MEDIA_TTL_MS / 60000);

const tools = [
  {
    name: 'create_task',
    description: `Dispatch a microtask to a nearby human to capture real-world data. Types: 'photo' or 'video'. Bounty is in rupees (minimum 10, maximum 1000). Deadline is ISO 8601. Tasks go to humans within 250m of the location. IMPORTANT: The title must be ONLY the subject to capture - e.g. "Phoenix Mall", "Traffic Signal", "Cars on Road". Do NOT include action words like "Take a photo of" or "Record a video of" - the task type already indicates photo/video. Humans have minimal English, so keep titles short and simple. NOTE: Submitted media is auto-deleted after ${photoTtlMin} minutes for photos and ${videoTtlMin} minutes for videos - download promptly after task completion.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        type: { type: 'string', enum: TASK_TYPES as unknown as string[], description: 'photo or video' },
        title: { type: 'string', description: 'Subject to capture, e.g. "Phoenix Mall", "Queue at Bank". NOT "Take a photo of..." (3-200 chars)' },
        description: { type: 'string', description: 'What is needed (10-2000 chars)' },
        instructions: { type: 'string', description: 'Specific instructions for the human (optional)' },
        latitude: { type: 'number', description: 'Target latitude (-90 to 90)' },
        longitude: { type: 'number', description: 'Target longitude (-180 to 180)' },
        bounty_rupees: { type: 'number', description: 'Payment in rupees (10-1000)' },
        deadline: { type: 'string', description: 'ISO 8601 deadline' },
      },
      required: ['type', 'title', 'description', 'latitude', 'longitude', 'bounty_rupees', 'deadline'],
    },
  },
  {
    name: 'get_task_status',
    description: 'Get current status and details of a task. If completed, includes the human response (photo/video URLs).',
    inputSchema: {
      type: 'object' as const,
      properties: { task_id: { type: 'string', description: 'Task UUID' } },
      required: ['task_id'],
    },
  },
  {
    name: 'list_my_tasks',
    description: 'List your tasks. Optionally filter by status: pending, assigned, in_progress, submitted, completed, expired, cancelled.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['pending', 'assigned', 'in_progress', 'submitted', 'completed', 'expired', 'cancelled'],
          description: 'Filter by status (optional)',
        },
      },
    },
  },
  {
    name: 'cancel_task',
    description: 'Cancel a pending or assigned task. Bounty is refunded to your credits.',
    inputSchema: {
      type: 'object' as const,
      properties: { task_id: { type: 'string', description: 'Task UUID' } },
      required: ['task_id'],
    },
  },
  {
    name: 'approve_task',
    description: 'Approve a submitted task. Triggers human payout. You have 2 minutes before auto-approval.',
    inputSchema: {
      type: 'object' as const,
      properties: { task_id: { type: 'string', description: 'Task UUID' } },
      required: ['task_id'],
    },
  },
  {
    name: 'reject_task',
    description: 'Reject a submitted task with a reason. Task returns to the pool. Agents rejecting >35% may be flagged.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        task_id: { type: 'string', description: 'Task UUID' },
        reason: { type: 'string', description: 'Rejection reason (shown to human, 5-500 chars)' },
      },
      required: ['task_id', 'reason'],
    },
  },
  {
    name: 'view_task_media',
    description: `Get media URLs from a completed task. Photos are also returned inline as base64. IMPORTANT: Media is auto-deleted — photos after ${photoTtlMin} minutes, videos after ${videoTtlMin} minutes from submission. If you need to keep a copy, download it promptly. Approve the task before downloading.`,
    inputSchema: {
      type: 'object' as const,
      properties: { task_id: { type: 'string', description: 'Task UUID' } },
      required: ['task_id'],
    },
  },
  {
    name: 'check_credits',
    description: 'Check your current credit balance in rupees.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'request_credits',
    description: 'Request a credit top-up. You will be contacted via your registered email with payment details. Amount in rupees (minimum 100, maximum 10000). Final payable might be slightly higher to account for any conversion/payment transfer rates if present.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        amount_rupees: { type: 'number', description: 'Desired top-up amount in rupees (100-10000)' },
      },
      required: ['amount_rupees'],
    },
  },
  {
    name: 'check_human_availability',
    description: 'Count active humans within 250m of a location. Use before creating a task. Minimum INR 10 credits required.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        latitude: { type: 'number', description: 'Latitude (-90 to 90)' },
        longitude: { type: 'number', description: 'Longitude (-180 to 180)' },
      },
      required: ['latitude', 'longitude'],
    },
  },
  {
    name: 'get_human_locations',
    description: 'Get coordinates of all active humans (anonymized). Only those seen in last 30 minutes. Minimum INR 10 credits required.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
];

// ─── Resource definitions ────────────────────────────────────

const resources = [
  {
    uri: 'lokeye://credits',
    name: 'credits',
    title: 'Credit Balance',
    description: 'Your current credit balance in rupees.',
    mimeType: 'application/json',
  },
  {
    uri: 'lokeye://tasks',
    name: 'tasks',
    title: 'My Tasks',
    description: 'Your 50 most recent tasks across all statuses.',
    mimeType: 'application/json',
  },
  {
    uri: 'lokeye://humans/locations',
    name: 'human-locations',
    title: 'Human Locations',
    description: 'Anonymized coordinates of all active humans seen in the last 30 minutes. Requires INR 10 minimum credits.',
    mimeType: 'application/json',
  },
];

const resourceTemplates = [
  {
    uriTemplate: 'lokeye://tasks/{task_id}',
    name: 'task-detail',
    title: 'Task Detail',
    description: 'Full details of a specific task, including submitted response and media URLs if available.',
    mimeType: 'application/json',
  },
  {
    uriTemplate: 'lokeye://humans/availability/{lat}/{lng}',
    name: 'human-availability',
    title: 'Human Availability',
    description: 'Count of active humans within 250m of a location. Requires INR 10 minimum credits.',
    mimeType: 'application/json',
  },
];

// ─── Prompt definitions ──────────────────────────────────────

const prompts = [
  {
    name: 'capture_photo',
    title: 'Capture a Photo',
    description: 'Dispatch a photo capture task to a nearby human. Checks availability first, then creates the task.',
    arguments: [
      { name: 'subject', description: 'What to photograph, e.g. "Phoenix Mall entrance"', required: true },
      { name: 'latitude', description: 'Target latitude', required: true },
      { name: 'longitude', description: 'Target longitude', required: true },
      { name: 'bounty_rupees', description: 'Payment in rupees (10–1000, default 20)', required: false },
      { name: 'details', description: 'Additional instructions for the human', required: false },
    ],
  },
  {
    name: 'capture_video',
    title: 'Capture a Video',
    description: 'Dispatch a short video recording task to a nearby human. Checks availability first, then creates the task.',
    arguments: [
      { name: 'subject', description: 'What to record, e.g. "Traffic at Main Street junction"', required: true },
      { name: 'latitude', description: 'Target latitude', required: true },
      { name: 'longitude', description: 'Target longitude', required: true },
      { name: 'bounty_rupees', description: 'Payment in rupees (10–1000, default 40)', required: false },
      { name: 'details', description: 'Additional instructions for the human', required: false },
    ],
  },
  {
    name: 'survey_area',
    title: 'Survey an Area',
    description: 'Check human availability at a location and get a coverage report before deciding whether to dispatch a task.',
    arguments: [
      { name: 'latitude', description: 'Target latitude', required: true },
      { name: 'longitude', description: 'Target longitude', required: true },
      { name: 'task_type', description: 'Task type you plan to dispatch: photo or video (default photo)', required: false },
    ],
  },
];

// ─── Auth helper ────────────────────────────────────────────

async function authenticateAgent(
  fastify: FastifyInstance,
  apiKey: string,
): Promise<{ id: string; name: string }> {
  const prefix = apiKey.substring(0, 8);
  const hash = crypto.createHash('sha256').update(apiKey).digest('hex');

  const { rows } = await fastify.db.query(
    'SELECT id, name FROM agents WHERE api_key_prefix = $1 AND api_key_hash = $2 AND is_active = true',
    [prefix, hash],
  );

  if (rows.length === 0) throw new Error('Invalid API key');
  return { id: rows[0].id, name: rows[0].name };
}

// ─── MCP server factory (creates one per request with agent context) ──

function createMcpServer(
  fastify: FastifyInstance,
  agentId: string,
) {
  const taskService = new TaskService(fastify);
  const geoService = new GeoService(fastify);

  const server = new Server(
    { name: 'lokeye', version: '0.1.0' },
    { capabilities: { tools: {}, resources: {}, prompts: {} } },
  );

  const ensureDiscoveryCredits = async () => {
    const { rows } = await fastify.db.query(
      'SELECT credits_balance FROM agents WHERE id = $1',
      [agentId],
    );
    const balance = Number(rows[0]?.credits_balance ?? 0);
    if (balance < MIN_DISCOVERY_CREDITS_RUPEES) {
      throw new Error(`Minimum INR ${MIN_DISCOVERY_CREDITS_RUPEES} credits required to access this resource`);
    }
  };

  // ── Tools ──────────────────────────────────────────────────
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      const result = await handleTool(fastify, taskService, geoService, agentId, name, args || {});
      return result;
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  });

  // ── Resources ──────────────────────────────────────────────
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources }));
  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({ resourceTemplates }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    const text = (data: unknown) => ({ contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(data, null, 2) }] });

    if (uri === 'lokeye://credits') {
      const { rows } = await fastify.db.query('SELECT credits_balance FROM agents WHERE id = $1', [agentId]);
      const balance = rows[0]?.credits_balance ?? 0;
      return text({ balance, currency: 'INR', balance_display: `INR ${Number(balance).toFixed(0)}` });
    }

    if (uri === 'lokeye://tasks') {
      const { rows } = await fastify.db.query(
        'SELECT * FROM tasks WHERE agent_id = $1 ORDER BY created_at DESC LIMIT 50',
        [agentId],
      );
      return text(rows);
    }

    if (uri === 'lokeye://humans/locations') {
      await ensureDiscoveryCredits();
      const locations = await geoService.getHumanLocations();
      return text(locations);
    }

    const taskMatch = uri.match(/^lokeye:\/\/tasks\/([^/]+)$/);
    if (taskMatch) {
      const { rows } = await fastify.db.query(
        `SELECT t.*,
                json_build_object('id', tr.id, 'text_response', tr.text_response,
                  'media_urls', tr.media_urls, 'capture_metadata', tr.capture_metadata,
                  'created_at', tr.created_at) AS response
         FROM tasks t LEFT JOIN task_responses tr ON tr.task_id = t.id
         WHERE t.id = $1 AND t.agent_id = $2`,
        [taskMatch[1], agentId],
      );
      if (rows.length === 0) throw new Error('Task not found');
      const task = rows[0];
      if (task.response?.id === null) task.response = null;
      return text(task);
    }

    const availMatch = uri.match(/^lokeye:\/\/humans\/availability\/([-\d.]+)\/([-\d.]+)$/);
    if (availMatch) {
      await ensureDiscoveryCredits();
      const result = await geoService.countNearbyHumans(parseFloat(availMatch[1]), parseFloat(availMatch[2]));
      return text(result);
    }

    throw new Error(`Unknown resource: ${uri}`);
  });

  // ── Prompts ────────────────────────────────────────────────
  server.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts }));

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    const msg = (text: string) => ({
      messages: [{ role: 'user' as const, content: { type: 'text' as const, text } }],
    });

    switch (name) {
      case 'capture_photo': {
        const subject = args.subject ?? '[subject]';
        const lat = args.latitude ?? '[latitude]';
        const lng = args.longitude ?? '[longitude]';
        const bounty = args.bounty_rupees ?? '20';
        const extra = args.details ? `\n\nAdditional instructions for the human: ${args.details}` : '';
        return msg(
          `I need a real-world photo captured at coordinates (${lat}, ${lng}).\n\nSubject: ${subject}${extra}\n\nPlease:\n1. Call check_human_availability to verify humans are near (${lat}, ${lng}).\n2. If humans are available, call create_task with type="photo", title="${subject}", bounty_rupees=${bounty}, and a deadline 2 hours from now.\n3. Report the task ID so I can track progress.`,
        );
      }

      case 'capture_video': {
        const subject = args.subject ?? '[subject]';
        const lat = args.latitude ?? '[latitude]';
        const lng = args.longitude ?? '[longitude]';
        const bounty = args.bounty_rupees ?? '40';
        const extra = args.details ? `\n\nAdditional instructions for the human: ${args.details}` : '';
        return msg(
          `I need a real-world video recorded at coordinates (${lat}, ${lng}).\n\nSubject: ${subject}${extra}\n\nPlease:\n1. Call check_human_availability to verify humans are near (${lat}, ${lng}).\n2. If humans are available, call create_task with type="video", title="${subject}", bounty_rupees=${bounty}, and a deadline 2 hours from now.\n3. Report the task ID so I can track progress.`,
        );
      }

      case 'survey_area': {
        const lat = args.latitude ?? '[latitude]';
        const lng = args.longitude ?? '[longitude]';
        const taskType = args.task_type ?? 'photo';
        return msg(
          `Survey the area at coordinates (${lat}, ${lng}) and report on human availability.\n\nPlease:\n1. Call check_human_availability at (${lat}, ${lng}).\n2. Call get_human_locations to see where all active humans are.\n3. Report the count and whether this location has enough coverage to dispatch a ${taskType} task.\n4. If humans are available, ask me if I'd like to proceed with creating a task.`,
        );
      }

      default:
        throw new Error(`Unknown prompt: ${name}`);
    }
  });

  return server;
}

// ─── Tool handler (calls services directly, no HTTP round-trip) ──

async function handleTool(
  fastify: FastifyInstance,
  taskService: TaskService,
  geoService: GeoService,
  agentId: string,
  toolName: string,
  args: Record<string, unknown>,
) {
  const json = (data: unknown) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  });
  const ensureDiscoveryCredits = async () => {
    const { rows } = await fastify.db.query(
      'SELECT credits_balance FROM agents WHERE id = $1',
      [agentId],
    );
    const balance = Number(rows[0]?.credits_balance ?? 0);
    if (balance < MIN_DISCOVERY_CREDITS_RUPEES) {
      throw new Error(`Minimum INR ${MIN_DISCOVERY_CREDITS_RUPEES} credits required to access this tool`);
    }
  };

  switch (toolName) {
    case 'create_task': {
      const parsed = CreateTaskSchema.safeParse(args);
      if (!parsed.success) throw new Error(parsed.error.issues.map(i => i.message).join(', '));
      const task = await taskService.createTask(agentId, parsed.data);
      return json(task);
    }

    case 'get_task_status': {
      const { rows } = await fastify.db.query(
        `SELECT t.*,
                json_build_object('id', tr.id, 'text_response', tr.text_response,
                  'media_urls', tr.media_urls, 'capture_metadata', tr.capture_metadata,
                  'created_at', tr.created_at) AS response
         FROM tasks t LEFT JOIN task_responses tr ON tr.task_id = t.id
         WHERE t.id = $1 AND t.agent_id = $2`,
        [args.task_id, agentId],
      );
      if (rows.length === 0) throw new Error('Task not found');
      const task = rows[0];
      if (task.response?.id === null) task.response = null;
      return json(task);
    }

    case 'list_my_tasks': {
      let query = 'SELECT * FROM tasks WHERE agent_id = $1';
      const params: unknown[] = [agentId];
      if (args.status) {
        query += ' AND status = $2';
        params.push(args.status);
      }
      query += ' ORDER BY created_at DESC LIMIT 50';
      const { rows } = await fastify.db.query(query, params);
      return json(rows);
    }

    case 'cancel_task': {
      const result = await taskService.cancelTask(args.task_id as string, agentId);
      if (!result) throw new Error('Task cannot be cancelled (must be pending or assigned)');
      return json(result);
    }

    case 'approve_task': {
      const result = await taskService.approveTask(args.task_id as string, agentId);
      if (!result.success) throw new Error(result.error);
      return json(result.task);
    }

    case 'reject_task': {
      const reason = args.reason as string;
      if (!reason || reason.length < 5) throw new Error('Reason must be at least 5 characters');
      if (reason.length > 500) throw new Error('Reason must be at most 500 characters');
      const result = await taskService.rejectTask(args.task_id as string, agentId, reason);
      if (!result.success) throw new Error(result.error);
      return json(result.task);
    }

    case 'view_task_media': {
      const { rows } = await fastify.db.query(
        `SELECT tr.media_urls, tr.created_at, t.type
         FROM task_responses tr JOIN tasks t ON t.id = tr.task_id
         WHERE t.id = $1 AND t.agent_id = $2`,
        [args.task_id, agentId],
      );
      if (rows.length === 0 || !rows[0].media_urls?.length) throw new Error('No media found');
      const { media_urls, created_at, type } = rows[0];
      const ttl = type === 'video' ? VIDEO_MEDIA_TTL_MS : PHOTO_MEDIA_TTL_MS;
      const expiresAt = new Date(new Date(created_at).getTime() + ttl);

      const content: Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }> = [];
      content.push({ type: 'text' as const, text: JSON.stringify({ media_urls, count: media_urls.length, expires_at: expiresAt.toISOString() }, null, 2) });

      // Inline base64 for photos
      for (const url of media_urls) {
        const isImage = /\.(jpg|jpeg|png|webp)/i.test(url);
        if (!isImage) continue;
        try {
          const match = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
          if (!match) continue;
          const { data, error } = await fastify.supabase.storage.from(match[1]).download(match[2]);
          if (error || !data) continue;
          const buffer = Buffer.from(await data.arrayBuffer());
          const ext = match[2].split('.').pop()?.toLowerCase() || 'jpeg';
          const mimeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
          content.push({ type: 'image' as const, data: buffer.toString('base64'), mimeType: mimeMap[ext] || 'image/jpeg' });
        } catch { /* skip failed downloads */ }
      }

      return { content };
    }

    case 'check_credits': {
      const { rows } = await fastify.db.query(
        'SELECT credits_balance FROM agents WHERE id = $1',
        [agentId],
      );
      const balance = rows[0].credits_balance;
      return json({ balance, currency: 'INR', balance_display: `INR ${balance.toFixed(0)}` });
    }

    case 'request_credits': {
      const amount = args.amount_rupees as number;
      if (!amount || amount < 100 || amount > 10000) {
        throw new Error('amount_rupees must be between 100 and 10000');
      }
      const { rows } = await fastify.db.query(
        'SELECT name, email FROM agents WHERE id = $1',
        [agentId],
      );
      const { sendCreditTopupRequest } = await import('../services/telegram.js');
      sendCreditTopupRequest({ name: rows[0].name, email: rows[0].email, amount_rupees: amount }).catch(() => {});
      return json({
        success: true,
        message: `Top-up request for INR ${amount} received. You will be contacted at ${rows[0].email} with payment details.`,
        note: 'Final payable might be slightly higher to account for any conversion/payment transfer rates if present.',
      });
    }

    case 'check_human_availability': {
      await ensureDiscoveryCredits();
      const result = await geoService.countNearbyHumans(args.latitude as number, args.longitude as number);
      return json(result);
    }

    case 'get_human_locations': {
      await ensureDiscoveryCredits();
      const locations = await geoService.getHumanLocations();
      return json(locations);
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

// ─── Fastify route ──────────────────────────────────────────

export async function mcpRoutes(fastify: FastifyInstance) {
  // Stateless: each POST creates a fresh MCP server + transport
  fastify.post('/mcp', async (request: FastifyRequest, reply: FastifyReply) => {
    const apiKey = request.headers['x-api-key'] as string;
    if (!apiKey) {
      return reply.code(401).send({ error: 'Missing X-API-Key header' });
    }

    let agent: { id: string; name: string };
    try {
      agent = await authenticateAgent(fastify, apiKey);
    } catch {
      return reply.code(401).send({ error: 'Invalid API key' });
    }

    const server = createMcpServer(fastify, agent.id);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    await server.connect(transport);

    // Hijack the response so Fastify doesn't interfere with the MCP transport's writes
    reply.hijack();
    await transport.handleRequest(request.raw, reply.raw, request.body as Record<string, unknown>);
  });
}



