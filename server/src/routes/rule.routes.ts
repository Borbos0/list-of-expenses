import type { FastifyInstance } from 'fastify';
import { createRuleSchema, updateRuleSchema } from '@expenses/shared';

export async function ruleRoutes(fastify: FastifyInstance) {
  fastify.get('/', async (request, reply) => {
    if (!request.user) return reply.status(401).send({ error: 'Unauthorized' });
    return fastify.db.prepare('SELECT * FROM rules WHERE user_id = ? ORDER BY priority DESC, created_at DESC')
      .all(request.user.id);
  });

  fastify.post('/', async (request, reply) => {
    if (!request.user) return reply.status(401).send({ error: 'Unauthorized' });

    const parsed = createRuleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request', details: parsed.error.issues });
    }

    const data = parsed.data;
    const result = fastify.db.prepare(`
      INSERT INTO rules (user_id, match_type, pattern, mcc, bank_category_raw, amount_sign, action_type, action_category_id, action_set_type, priority)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      request.user.id, data.match_type, data.pattern,
      data.mcc ?? null, data.bank_category_raw ?? null, data.amount_sign ?? null,
      data.action_type, data.action_category_id ?? null, data.action_set_type ?? null,
      data.priority,
    );

    const row = fastify.db.prepare('SELECT * FROM rules WHERE id = ?').get(result.lastInsertRowid);
    reply.status(201);
    return row;
  });

  fastify.patch('/:id', async (request, reply) => {
    if (!request.user) return reply.status(401).send({ error: 'Unauthorized' });

    const { id } = request.params as { id: string };
    const existing = fastify.db.prepare('SELECT * FROM rules WHERE id = ? AND user_id = ?')
      .get(Number(id), request.user.id);
    if (!existing) {
      return reply.status(404).send({ error: 'Not found' });
    }

    const parsed = updateRuleSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request', details: parsed.error.issues });
    }

    const data = parsed.data;
    const updates: string[] = [];
    const values: any[] = [];

    if (data.match_type !== undefined) { updates.push('match_type = ?'); values.push(data.match_type); }
    if (data.pattern !== undefined) { updates.push('pattern = ?'); values.push(data.pattern); }
    if (data.mcc !== undefined) { updates.push('mcc = ?'); values.push(data.mcc); }
    if (data.bank_category_raw !== undefined) { updates.push('bank_category_raw = ?'); values.push(data.bank_category_raw); }
    if (data.amount_sign !== undefined) { updates.push('amount_sign = ?'); values.push(data.amount_sign); }
    if (data.action_type !== undefined) { updates.push('action_type = ?'); values.push(data.action_type); }
    if (data.action_category_id !== undefined) { updates.push('action_category_id = ?'); values.push(data.action_category_id); }
    if (data.action_set_type !== undefined) { updates.push('action_set_type = ?'); values.push(data.action_set_type); }
    if (data.priority !== undefined) { updates.push('priority = ?'); values.push(data.priority); }

    if (updates.length > 0) {
      values.push(Number(id));
      fastify.db.prepare(`UPDATE rules SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    return fastify.db.prepare('SELECT * FROM rules WHERE id = ?').get(Number(id));
  });

  fastify.delete('/:id', async (request, reply) => {
    if (!request.user) return reply.status(401).send({ error: 'Unauthorized' });

    const { id } = request.params as { id: string };
    const existing = fastify.db.prepare('SELECT id FROM rules WHERE id = ? AND user_id = ?')
      .get(Number(id), request.user.id);
    if (!existing) {
      return reply.status(404).send({ error: 'Not found' });
    }

    fastify.db.prepare('DELETE FROM rules WHERE id = ?').run(Number(id));
    reply.status(204).send();
  });
}
