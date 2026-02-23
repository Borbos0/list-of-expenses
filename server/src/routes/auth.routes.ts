import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { loginRequestSchema } from '@expenses/shared';

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/login', async (request, reply) => {
    const parsed = loginRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request', details: parsed.error.issues });
    }

    const { username, password } = parsed.data;

    const user = fastify.db.prepare('SELECT id, username, password_hash FROM users WHERE username = ?')
      .get(username) as { id: number; username: string; password_hash: string } | undefined;

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return reply.status(401).send({ error: 'Неверные учётные данные' });
    }

    // Очистка просроченных сессий
    fastify.db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();

    // Создание сессии
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    fastify.db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(
      sessionId,
      user.id,
      expiresAt,
    );

    reply.setCookie('session_id', sessionId, {
      signed: true,
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
    });

    return { id: user.id, username: user.username };
  });

  fastify.post('/logout', async (request, reply) => {
    const sessionId = request.cookies.session_id;
    if (sessionId) {
      const unsigned = request.unsignCookie(sessionId);
      if (unsigned.valid && unsigned.value) {
        fastify.db.prepare('DELETE FROM sessions WHERE id = ?').run(unsigned.value);
      }
    }

    reply.clearCookie('session_id', { path: '/' });
    return { ok: true };
  });

  fastify.get('/me', async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    return { id: request.user.id, username: request.user.username };
  });
}
