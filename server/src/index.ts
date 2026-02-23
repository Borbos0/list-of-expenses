import 'dotenv/config';
import Fastify from 'fastify';
import { config } from './config.js';
import dbPlugin from './plugins/db.js';
import authPlugin from './plugins/auth.js';
import { authRoutes } from './routes/auth.routes.js';
import { categoryRoutes } from './routes/category.routes.js';
import { transactionRoutes } from './routes/transaction.routes.js';
import { ruleRoutes } from './routes/rule.routes.js';
import { importRoutes } from './routes/import.routes.js';
import { statsRoutes } from './routes/stats.routes.js';
import { backupRoutes } from './routes/backup.routes.js';

const isDev = process.env.NODE_ENV !== 'production';

const fastify = Fastify({
  logger: isDev
    ? { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' } } }
    : true,
});

async function start() {
  // Плагины
  await fastify.register(dbPlugin);
  await fastify.register(authPlugin);

  // Маршруты
  await fastify.register(authRoutes, { prefix: '/api/auth' });
  await fastify.register(categoryRoutes, { prefix: '/api/categories' });
  await fastify.register(transactionRoutes, { prefix: '/api/transactions' });
  await fastify.register(ruleRoutes, { prefix: '/api/rules' });
  await fastify.register(importRoutes, { prefix: '/api/import' });
  await fastify.register(statsRoutes, { prefix: '/api/stats' });
  await fastify.register(backupRoutes, { prefix: '/api' });

  // Продакшен: отдача статических файлов
  if (process.env.NODE_ENV === 'production') {
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));

    await fastify.register(import('@fastify/static'), {
      root: path.join(__dirname, '..', 'public'),
      prefix: '/',
    });

    fastify.setNotFoundHandler((req, reply) => {
      if (!req.url.startsWith('/api')) {
        return reply.sendFile('index.html');
      }
      reply.status(404).send({ error: 'Not found' });
    });
  }

  try {
    await fastify.listen({ port: config.PORT, host: '0.0.0.0' });
    fastify.log.info(`Server running on port ${config.PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
