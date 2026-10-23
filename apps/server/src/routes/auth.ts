import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

const SignUpSchema = z.object({
  phone: z.string().min(1),
  password: z.string().min(6),
  name: z.string().min(1),
  upi_vpa: z.string().optional(),
});

const LoginSchema = z.object({
  phone: z.string().min(1),
  password: z.string().min(6),
});

const RefreshSchema = z.object({
  refresh_token: z.string().min(1),
});

const ChangePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(6),
});

function sessionPayload(session: { access_token: string; refresh_token: string; expires_at?: number }, user: { id: string; phone?: string | null }) {
  return {
    session: {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
      user: {
        id: user.id,
        phone: user.phone ?? undefined,
      },
    },
  };
}

async function isHumanDeleted(fastify: FastifyInstance, humanId: string): Promise<boolean> {
  const { rows } = await fastify.db.query(
    'SELECT deleted_at FROM humans WHERE id = $1 LIMIT 1',
    [humanId]
  );
  return !!rows[0]?.deleted_at;
}

const loginRateLimit = { config: { rateLimit: { max: 3, timeWindow: '1 minute' } } };
const signupRateLimit = { config: { rateLimit: { max: 1, timeWindow: '1 hour' } } };
const changePasswordRateLimit = { config: { rateLimit: { max: 3, timeWindow: '1 hour' } } };

export async function authRoutes(fastify: FastifyInstance) {
  // POST /auth/signup
  fastify.post('/signup', { ...signupRateLimit }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = SignUpSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.badRequest(parsed.error.issues.map(i => i.message).join(', '));
    }
    const { phone, password, name, upi_vpa } = parsed.data;

    const { data, error } = await fastify.supabase.auth.signUp({ phone, password });
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('already registered') || msg.includes('already been registered')) {
        return reply.badRequest('An account with this phone number already exists');
      }
      return reply.badRequest(error.message);
    }
    if (!data.session || !data.user) {
      return reply.badRequest('Signup failed: no session returned. Phone confirmation may be required.');
    }

    // Create human row with display_name and optional UPI
    await fastify.db.query(
      `INSERT INTO humans (id, phone, display_name, upi_vpa)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name, upi_vpa = COALESCE(EXCLUDED.upi_vpa, humans.upi_vpa)`,
      [data.user.id, phone, name, upi_vpa || null]
    );

    // Log signup for audit trail
    await fastify.db.query(
      `INSERT INTO account_signups (phone, upi_vpa, human_id) VALUES ($1, $2, $3)`,
      [phone, upi_vpa || null, data.user.id]
    );

    return sessionPayload(data.session, { id: data.user.id, phone: data.user.phone ?? phone });
  });

  // POST /auth/login
  fastify.post('/login', { ...loginRateLimit }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = LoginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.badRequest(parsed.error.issues.map(i => i.message).join(', '));
    }
    const { phone, password } = parsed.data;

    const { data, error } = await fastify.supabase.auth.signInWithPassword({ phone, password });
    if (error) {
      return reply.badRequest('Incorrect phone number or password');
    }
    if (!data.session) return reply.badRequest('Login failed');
    if (await isHumanDeleted(fastify, data.user.id)) {
      await fastify.supabase.auth.admin.signOut(data.user.id);
      return reply.badRequest('This account has been deleted. Please sign up again to continue.');
    }

    // Invalidate all other sessions so only this device is signed in
    await fastify.supabase.auth.admin.signOut(data.user.id, 'others');

    return sessionPayload(data.session, { id: data.user.id, phone: data.user.phone ?? phone });
  });

  // POST /auth/refresh
  fastify.post('/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = RefreshSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.badRequest(parsed.error.issues.map(i => i.message).join(', '));
    }
    const { refresh_token } = parsed.data;

    const { data, error } = await fastify.supabase.auth.refreshSession({ refresh_token });
    if (error) return reply.unauthorized(error.message);
    if (!data.session || !data.user) return reply.unauthorized('Refresh failed');
    if (await isHumanDeleted(fastify, data.user.id)) {
      await fastify.supabase.auth.admin.signOut(data.user.id);
      return reply.unauthorized('Account has been deleted');
    }

    return sessionPayload(data.session, { id: data.user.id, phone: data.user.phone });
  });

  // POST /auth/logout
  fastify.post('/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.unauthorized('Missing Authorization header');
    }
    const token = authHeader.substring(7);

    const { data: { user } } = await fastify.supabase.auth.getUser(token);
    if (user) {
      await fastify.supabase.auth.admin.signOut(user.id);
      await fastify.db.query(
        `UPDATE humans SET last_location = NULL, last_location_at = NULL, expo_push_token = NULL WHERE id = $1`,
        [user.id],
      );
    }

    return { success: true };
  });

  // POST /auth/change-password (authenticated via Bearer token)
  fastify.post('/change-password', { ...changePasswordRateLimit }, async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.unauthorized('Missing Authorization header');
    }
    const token = authHeader.substring(7);

    const { data: { user }, error: authError } = await fastify.supabase.auth.getUser(token);
    if (authError || !user) return reply.unauthorized('Invalid or expired token');

    const parsed = ChangePasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.badRequest(parsed.error.issues.map(i => i.message).join(', '));
    }
    const { current_password, new_password } = parsed.data;

    // Verify current password
    const phone = user.phone as string;
    const { error: signInError } = await fastify.supabase.auth.signInWithPassword({
      phone,
      password: current_password,
    });
    if (signInError) {
      return reply.badRequest('Current password is incorrect');
    }

    // Update password
    const { error: updateError } = await fastify.supabase.auth.admin.updateUserById(user.id, {
      password: new_password,
    });
    if (updateError) return reply.internalServerError(updateError.message);

    return { success: true };
  });
}
