import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { sendSupportRequest } from '../services/telegram.js';

const SupportRequestSchema = z.object({
  phone: z.string().regex(/^\+?91\d{10}$/, 'A valid Indian phone number is required'),
});

export async function publicRoutes(fastify: FastifyInstance) {
  const neutralMessage = 'If this number is registered, you will receive support shortly.';

  const handleSupportRequest = async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = SupportRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.badRequest(parsed.error.issues.map(i => i.message).join(', '));
    }

    const inputPhone = parsed.data.phone;
    const canonicalPhone = inputPhone.startsWith('+') ? inputPhone : `+${inputPhone}`;

    // Match both +91XXXXXXXXXX and 91XXXXXXXXXX records.
    const { rows } = await fastify.db.query(
      `SELECT id, phone, display_name
       FROM humans
       WHERE regexp_replace(phone, '^\\+', '') = regexp_replace($1, '^\\+', '')
       LIMIT 1`,
      [canonicalPhone]
    );

    if (rows.length > 0) {
      await sendSupportRequest({
        id: rows[0].id,
        phone: rows[0].phone || canonicalPhone,
        display_name: rows[0].display_name,
      });
    }

    return { success: true, message: neutralMessage };
  };

  // Account support request; kept at /forgot-password for backward compatibility.
  fastify.post('/forgot-password', async (request: FastifyRequest, reply: FastifyReply) => {
    return handleSupportRequest(request, reply);
  });

  // Alias for clarity (same behavior).
  fastify.post('/support-request', async (request: FastifyRequest, reply: FastifyReply) => {
    return handleSupportRequest(request, reply);
  });
}
