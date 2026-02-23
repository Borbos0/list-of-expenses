import fp from 'fastify-plugin';
import cookie from '@fastify/cookie';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: { id: number; username: string };
  }
}

export default fp(async function authPlugin(fastify: FastifyInstance) {
  await fastify.register(cookie, {
    secret: config.SESSION_SECRET,
  });

  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    // Пропуск авторизации для логина
    if (request.url === '/api/auth/login' && request.method === 'POST') {
      return;
    }

    // Пропуск авторизации для не-API маршрутов
    if (!request.url.startsWith('/api')) {
      return;
    }

    const sessionId = request.cookies.session_id;
    if (!sessionId) {
      reply.status(401).send({ error: 'Unauthorized' });
      return;
    }

    // Проверка подписанной куки
    const unsigned = request.unsignCookie(sessionId);
    if (!unsigned.valid || !unsigned.value) {
      reply.status(401).send({ error: 'Unauthorized' });
      return;
    }

    const session = fastify.db.prepare(`
      SELECT s.id, s.user_id, s.expires_at, u.username
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.id = ? AND s.expires_at > datetime('now')
    `).get(unsigned.value) as { id: string; user_id: number; expires_at: string; username: string } | undefined;

    if (!session) {
      reply.status(401).send({ error: 'Unauthorized' });
      return;
    }

    request.user = { id: session.user_id, username: session.username };
  });
});
