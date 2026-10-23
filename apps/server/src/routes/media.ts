import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export async function mediaRoutes(fastify: FastifyInstance) {
  // POST /media/upload — humanAuthPlugin must be registered in the parent scope
  fastify.post('/media/upload', async (request: FastifyRequest, reply: FastifyReply) => {
    const file = await request.file();
    if (!file) return reply.badRequest('No file provided');

    const buffer = await file.toBuffer();
    const ext = (file.filename?.split('.').pop() || 'bin').toLowerCase();
    const storagePath = `${request.human.id}/${Date.now()}.${ext}`;

    const { data, error } = await fastify.supabase.storage
      .from('task-media')
      .upload(storagePath, buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) return reply.internalServerError(error.message);

    const { data: urlData } = fastify.supabase.storage
      .from('task-media')
      .getPublicUrl(data.path);

    return { publicUrl: urlData.publicUrl };
  });
}
