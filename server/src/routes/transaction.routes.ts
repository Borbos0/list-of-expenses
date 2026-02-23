import type { FastifyInstance } from 'fastify';
import { createTransactionSchema, updateTransactionSchema, transactionFilterSchema } from '@expenses/shared';

export async function transactionRoutes(fastify: FastifyInstance) {
  fastify.get('/', async (request, reply) => {
    if (!request.user) return reply.status(401).send({ error: 'Unauthorized' });

    const parsed = transactionFilterSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid query', details: parsed.error.issues });
    }

    const { from, to, type, category_id, search, page, limit } = parsed.data;
    const userId = request.user.id;

    const conditions: string[] = ['t.user_id = ?'];
    const params: any[] = [userId];

    if (from) { conditions.push('t.date_time >= ?'); params.push(from); }
    if (to) { conditions.push('t.date_time <= ?'); params.push(to + 'T23:59:59'); }
    if (type) { conditions.push('t.type = ?'); params.push(type); }
    if (category_id) { conditions.push('t.category_id = ?'); params.push(category_id); }
    if (search) {
      conditions.push('(t.description LIKE ? OR t.merchant_norm LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const where = conditions.join(' AND ');

    const countRow = fastify.db.prepare(
      `SELECT COUNT(*) as total FROM transactions t WHERE ${where}`,
    ).get(...params) as { total: number };

    const offset = (page - 1) * limit;
    const rows = fastify.db.prepare(`
      SELECT t.*, c.name as category_name, tr.from_tag, tr.to_tag
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
      LEFT JOIN transfers tr ON tr.transaction_id = t.id
      WHERE ${where}
      ORDER BY t.date_time DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

    return { data: rows, total: countRow.total, page, limit };
  });

  fastify.post('/', async (request, reply) => {
    if (!request.user) return reply.status(401).send({ error: 'Unauthorized' });

    const parsed = createTransactionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request', details: parsed.error.issues });
    }

    const data = parsed.data;
    const userId = request.user.id;

    const result = fastify.db.prepare(`
      INSERT INTO transactions (user_id, date_time, type, amount_kopeks, category_id, description, merchant_norm, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId, data.date_time, data.type, data.amount_kopeks,
      data.category_id ?? null, data.description ?? '', data.merchant_norm ?? null, data.tags ?? null,
    );

    const txId = result.lastInsertRowid;

    if (data.type === 'transfer' && (data.from_tag || data.to_tag)) {
      fastify.db.prepare('INSERT INTO transfers (transaction_id, from_tag, to_tag) VALUES (?, ?, ?)')
        .run(txId, data.from_tag ?? null, data.to_tag ?? null);
    }

    const row = fastify.db.prepare(`
      SELECT t.*, c.name as category_name, tr.from_tag, tr.to_tag
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
      LEFT JOIN transfers tr ON tr.transaction_id = t.id
      WHERE t.id = ?
    `).get(txId);

    reply.status(201);
    return row;
  });

  fastify.patch('/:id', async (request, reply) => {
    if (!request.user) return reply.status(401).send({ error: 'Unauthorized' });

    const { id } = request.params as { id: string };
    const parsed = updateTransactionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request', details: parsed.error.issues });
    }

    const existing = fastify.db.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?')
      .get(Number(id), request.user.id);
    if (!existing) {
      return reply.status(404).send({ error: 'Not found' });
    }

    const data = parsed.data;
    const updates: string[] = [];
    const values: any[] = [];

    if (data.date_time !== undefined) { updates.push('date_time = ?'); values.push(data.date_time); }
    if (data.type !== undefined) { updates.push('type = ?'); values.push(data.type); }
    if (data.amount_kopeks !== undefined) { updates.push('amount_kopeks = ?'); values.push(data.amount_kopeks); }
    if (data.category_id !== undefined) { updates.push('category_id = ?'); values.push(data.category_id); }
    if (data.description !== undefined) { updates.push('description = ?'); values.push(data.description); }
    if (data.merchant_norm !== undefined) { updates.push('merchant_norm = ?'); values.push(data.merchant_norm); }
    if (data.tags !== undefined) { updates.push('tags = ?'); values.push(data.tags); }

    if (updates.length > 0) {
      values.push(Number(id));
      fastify.db.prepare(`UPDATE transactions SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    // Обработка переводов
    if (data.type === 'transfer') {
      const existingTransfer = fastify.db.prepare('SELECT id FROM transfers WHERE transaction_id = ?').get(Number(id));
      if (existingTransfer) {
        if (data.from_tag !== undefined || data.to_tag !== undefined) {
          fastify.db.prepare('UPDATE transfers SET from_tag = COALESCE(?, from_tag), to_tag = COALESCE(?, to_tag) WHERE transaction_id = ?')
            .run(data.from_tag ?? null, data.to_tag ?? null, Number(id));
        }
      } else if (data.from_tag || data.to_tag) {
        fastify.db.prepare('INSERT INTO transfers (transaction_id, from_tag, to_tag) VALUES (?, ?, ?)')
          .run(Number(id), data.from_tag ?? null, data.to_tag ?? null);
      }
    } else if (data.type !== undefined) {
      // Тип изменён с перевода — удалить запись перевода
      fastify.db.prepare('DELETE FROM transfers WHERE transaction_id = ?').run(Number(id));
    }

    const row = fastify.db.prepare(`
      SELECT t.*, c.name as category_name, tr.from_tag, tr.to_tag
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
      LEFT JOIN transfers tr ON tr.transaction_id = t.id
      WHERE t.id = ?
    `).get(Number(id));

    return row;
  });

  // Массовое обновление по описанию
  fastify.patch('/bulk', async (request, reply) => {
    if (!request.user) return reply.status(401).send({ error: 'Unauthorized' });

    const body = request.body as {
      match_description: string;
      type?: string;
      category_id?: number | null;
    };

    if (!body.match_description) {
      return reply.status(400).send({ error: 'match_description is required' });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (body.type !== undefined) { updates.push('type = ?'); values.push(body.type); }
    if (body.category_id !== undefined) { updates.push('category_id = ?'); values.push(body.category_id); }

    if (updates.length === 0) {
      return reply.status(400).send({ error: 'No fields to update' });
    }

    values.push(body.match_description, request.user.id);
    const result = fastify.db.prepare(
      `UPDATE transactions SET ${updates.join(', ')} WHERE description = ? AND user_id = ?`,
    ).run(...values);

    return { updated: result.changes };
  });

  fastify.delete('/:id', async (request, reply) => {
    if (!request.user) return reply.status(401).send({ error: 'Unauthorized' });

    const { id } = request.params as { id: string };
    const existing = fastify.db.prepare('SELECT id FROM transactions WHERE id = ? AND user_id = ?')
      .get(Number(id), request.user.id);
    if (!existing) {
      return reply.status(404).send({ error: 'Not found' });
    }

    fastify.db.prepare('DELETE FROM transactions WHERE id = ?').run(Number(id));
    reply.status(204).send();
  });
}
