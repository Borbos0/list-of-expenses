import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { getDb, closeDb } from '../db/connection.js';
import { runMigrations } from '../db/migrate.js';
import { seedUser } from '../db/seed-user.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: Database.Database;
  }
}

export default fp(async function dbPlugin(fastify: FastifyInstance) {
  const db = getDb();
  runMigrations(db);
  seedUser(db);

  fastify.decorate('db', db);
  fastify.addHook('onClose', () => {
    closeDb();
  });
});
