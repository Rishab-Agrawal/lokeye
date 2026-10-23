import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import sensible from '@fastify/sensible';
import rateLimit from '@fastify/rate-limit';
import { supabasePlugin } from './plugins/supabase.js';
import { agentAuthPlugin } from './plugins/agent-auth.js';
import { humanAuthPlugin } from './plugins/human-auth.js';
import { agentRoutes } from './routes/agent-tasks.js';
import { agentCreditsRoutes } from './routes/agent-credits.js';
import { humanRoutes } from './routes/human.js';
import { humanTaskRoutes } from './routes/human-tasks.js';
import { mediaRoutes } from './routes/media.js';
import { authRoutes } from './routes/auth.js';
import { telegramWebhookRoutes } from './routes/telegram-webhook.js';
import { agentRegisterRoutes } from './routes/agent-register.js';
import { publicRoutes } from './routes/public.js';
import { docsRoutes } from './routes/docs.js';
import { appLegalRoutes } from './routes/app-legal.js';
import { mcpRoutes } from './routes/mcp.js';
import { homepageRoutes } from './routes/homepage.js';
import { startTaskExpiryCron } from './services/cron.js';
import { setWebhook as setTelegramWebhook } from './services/telegram.js';

async function main() {
  const server = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  // Plugins
  const isProduction = process.env.NODE_ENV === 'production';

  await server.register(cors, {
    origin: isProduction
      ? false  // Mobile app doesn't need CORS; disable in production
      : true,  // Allow all in development
  });

  await server.register(helmet, {
    // Disable contentSecurityPolicy for API-only server (no HTML pages served except docs)
    contentSecurityPolicy: false,
  });

  await server.register(sensible);
  await server.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });
  await server.register(multipart, {
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  });
  await server.register(supabasePlugin);

  // Health check
  server.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // Custom 404 handler
  server.setNotFoundHandler((_request, reply) => {
    // Keep JSON response for API routes
    if (_request.url.startsWith('/api/')) {
      return reply.code(404).send({ error: 'Not Found' });
    }
    reply.code(404).type('text/html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>404 | Page Not Found</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif;
      background: #fafafa;
      color: #1a1a1a;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }
    .container {
      text-align: center;
      padding: 32px;
    }
    .code {
      font-size: 96px;
      font-weight: 800;
      letter-spacing: -4px;
      color: #e5e5e5;
      line-height: 1;
    }
    h1 {
      font-size: 22px;
      font-weight: 600;
      margin: 16px 0 8px;
    }
    p {
      font-size: 15px;
      color: #717171;
      margin-bottom: 28px;
    }
    a {
      display: inline-block;
      padding: 10px 24px;
      background: #171717;
      color: #fff;
      border-radius: 8px;
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
      transition: background 0.15s;
    }
    a:hover { background: #333; }
  </style>
</head>
<body>
  <div class="container">
    <div class="code">404</div>
    <h1>Page Not Found</h1>
    <p>The page you're looking for doesn't exist or has been moved.</p>
    <a href="/">Go Home</a>
  </div>
</body>
</html>`);
  });

  // Agent routes (API key auth)
  await server.register(async (instance) => {
    await instance.register(agentAuthPlugin);
    await instance.register(agentRoutes);
    await instance.register(agentCreditsRoutes);
  }, { prefix: '/api/v1/agent' });

  // Human routes (Supabase JWT auth)
  await server.register(async (instance) => {
    await instance.register(humanAuthPlugin);
    await instance.register(humanRoutes);
    await instance.register(humanTaskRoutes);
    await instance.register(mediaRoutes);
  }, { prefix: '/api/v1/human' });

  // Auth proxy routes (no JWT auth — user is logging in)
  await server.register(authRoutes, { prefix: '/api/v1/auth' });

  // Public routes (no auth)
  await server.register(agentRegisterRoutes, { prefix: '/api/v1' });
  await server.register(publicRoutes, { prefix: '/api/v1' });
  await server.register(docsRoutes);
  await server.register(appLegalRoutes);
  await server.register(homepageRoutes);

  // MCP endpoint (API key auth handled inside)
  await server.register(mcpRoutes);

  // Webhooks (their own auth)
  await server.register(telegramWebhookRoutes, { prefix: '/webhooks' });

  // Start task expiry cron
  startTaskExpiryCron(server);

  // Start server
  const host = process.env.HOST || '0.0.0.0';
  const port = parseInt(process.env.PORT || '3000', 10);

  try {
    await server.listen({ host, port });
    server.log.info(`Server running on ${host}:${port}`);

    // Register Telegram webhook if configured
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.PUBLIC_URL) {
      const ok = await setTelegramWebhook(process.env.PUBLIC_URL);
      server.log.info({ ok }, 'Telegram webhook registration');
    }
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      server.log.info({ signal }, 'Received shutdown signal, draining...');
      server.close().then(() => {
        process.exit(0);
      });
    });
  }
}

main();
