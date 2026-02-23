import type { FastifyInstance } from 'fastify';
import { createCategorySchema, updateCategorySchema } from '@expenses/shared';

function toCategory(row: any) {
  return {
    ...row,
    include_in_expense_analytics: !!row.include_in_expense_analytics,
    include_in_income_analytics: !!row.include_in_income_analytics,
  };
}

export async function categoryRoutes(fastify: FastifyInstance) {
  fastify.get('/', async (request) => {
    if (!request.user) return [];
    const rows = fastify.db.prepare('SELECT * FROM categories ORDER BY name').all();
    return rows.map(toCategory);
  });

  fastify.post('/', async (request, reply) => {
    if (!request.user) return reply.status(401).send({ error: 'Unauthorized' });

    const parsed = createCategorySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request', details: parsed.error.issues });
    }

    const { name, parent_id, include_in_expense_analytics, include_in_income_analytics } = parsed.data;

    const result = fastify.db.prepare(
      'INSERT INTO categories (name, parent_id, include_in_expense_analytics, include_in_income_analytics) VALUES (?, ?, ?, ?)',
    ).run(name, parent_id ?? null, include_in_expense_analytics ? 1 : 0, include_in_income_analytics ? 1 : 0);

    const row = fastify.db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
    reply.status(201);
    return toCategory(row);
  });

  fastify.patch('/:id', async (request, reply) => {
    if (!request.user) return reply.status(401).send({ error: 'Unauthorized' });

    const { id } = request.params as { id: string };
    const parsed = updateCategorySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request', details: parsed.error.issues });
    }

    const existing = fastify.db.prepare('SELECT * FROM categories WHERE id = ?').get(Number(id));
    if (!existing) {
      return reply.status(404).send({ error: 'Not found' });
    }

    const updates: string[] = [];
    const values: any[] = [];
    const data = parsed.data;

    if (data.name !== undefined) { updates.push('name = ?'); values.push(data.name); }
    if (data.parent_id !== undefined) { updates.push('parent_id = ?'); values.push(data.parent_id); }
    if (data.include_in_expense_analytics !== undefined) {
      updates.push('include_in_expense_analytics = ?');
      values.push(data.include_in_expense_analytics ? 1 : 0);
    }
    if (data.include_in_income_analytics !== undefined) {
      updates.push('include_in_income_analytics = ?');
      values.push(data.include_in_income_analytics ? 1 : 0);
    }

    if (updates.length > 0) {
      values.push(Number(id));
      fastify.db.prepare(`UPDATE categories SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    const row = fastify.db.prepare('SELECT * FROM categories WHERE id = ?').get(Number(id));
    return toCategory(row);
  });

  fastify.delete('/:id', async (request, reply) => {
    if (!request.user) return reply.status(401).send({ error: 'Unauthorized' });

    const { id } = request.params as { id: string };

    // Проверка на использование в операциях
    const txCount = fastify.db.prepare('SELECT COUNT(*) as cnt FROM transactions WHERE category_id = ?')
      .get(Number(id)) as { cnt: number };
    if (txCount.cnt > 0) {
      return reply.status(409).send({ error: 'Категория используется в операциях' });
    }

    fastify.db.prepare('DELETE FROM categories WHERE id = ?').run(Number(id));
    reply.status(204).send();
  });
}
