import type { FastifyInstance } from 'fastify';
import { statsQuerySchema, timeseriesQuerySchema, byCategoryQuerySchema } from '@expenses/shared';

export async function statsRoutes(fastify: FastifyInstance) {
  // Сводка
  fastify.get('/summary', async (request, reply) => {
    if (!request.user) return reply.status(401).send({ error: 'Unauthorized' });

    const parsed = statsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid query', details: parsed.error.issues });
    }

    const { from, to } = parsed.data;
    const userId = request.user.id;

    const row = fastify.db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN t.type = 'income' AND COALESCE(c.include_in_income_analytics, 1) = 1 THEN t.amount_kopeks ELSE 0 END), 0) AS total_income,
        COALESCE(SUM(CASE WHEN t.type = 'expense' AND COALESCE(c.include_in_expense_analytics, 1) = 1 THEN ABS(t.amount_kopeks) ELSE 0 END), 0) AS total_expense,
        COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.cashback_kopeks ELSE 0 END), 0) AS total_cashback,
        COUNT(*) AS transaction_count
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = ? AND t.date_time >= ? AND t.date_time <= ? AND t.type != 'ignore'
    `).get(userId, from, to + 'T23:59:59') as {
      total_income: number;
      total_expense: number;
      total_cashback: number;
      transaction_count: number;
    };

    const lastTx = fastify.db.prepare(
      'SELECT MAX(date_time) AS last_date FROM transactions WHERE user_id = ?',
    ).get(userId) as { last_date: string | null };

    return {
      total_income: row.total_income + row.total_cashback,
      total_expense: row.total_expense,
      net: row.total_income + row.total_cashback - row.total_expense,
      transaction_count: row.transaction_count,
      last_transaction_date: lastTx.last_date,
    };
  });

  // Временные ряды
  fastify.get('/timeseries', async (request, reply) => {
    if (!request.user) return reply.status(401).send({ error: 'Unauthorized' });

    const parsed = timeseriesQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid query', details: parsed.error.issues });
    }

    const { from, to, group, category_id } = parsed.data;
    const userId = request.user.id;

    let groupExpr: string;
    switch (group) {
      case 'day':
        groupExpr = "strftime('%Y-%m-%d', t.date_time)";
        break;
      case 'week':
        groupExpr = "strftime('%Y-W%W', t.date_time)";
        break;
      case 'month':
      default:
        groupExpr = "strftime('%Y-%m', t.date_time)";
        break;
    }

    const categoryCondition = category_id ? 'AND t.category_id = ?' : '';
    const params = category_id
      ? [userId, from, to + 'T23:59:59', category_id]
      : [userId, from, to + 'T23:59:59'];

    const rows = fastify.db.prepare(`
      SELECT
        ${groupExpr} AS period,
        COALESCE(SUM(CASE WHEN t.type = 'income' AND COALESCE(c.include_in_income_analytics, 1) = 1 THEN t.amount_kopeks ELSE 0 END), 0)
          + COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.cashback_kopeks ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN t.type = 'expense' AND COALESCE(c.include_in_expense_analytics, 1) = 1 THEN ABS(t.amount_kopeks) ELSE 0 END), 0) AS expense
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = ? AND t.date_time >= ? AND t.date_time <= ? AND t.type IN ('income', 'expense')
        ${categoryCondition}
      GROUP BY period
      ORDER BY period
    `).all(...params);

    return rows;
  });

  // Дата последней операции (без фильтра по датам)
  fastify.get('/last-update', async (request, reply) => {
    if (!request.user) return reply.status(401).send({ error: 'Unauthorized' });

    const row = fastify.db.prepare(
      'SELECT MAX(date_time) AS last_date FROM transactions WHERE user_id = ?',
    ).get(request.user.id) as { last_date: string | null };

    return { last_transaction_date: row.last_date };
  });

  // По категориям
  fastify.get('/by-category', async (request, reply) => {
    if (!request.user) return reply.status(401).send({ error: 'Unauthorized' });

    const parsed = byCategoryQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid query', details: parsed.error.issues });
    }

    const { from, to, type } = parsed.data;
    const userId = request.user.id;

    const analyticsField = type === 'expense' ? 'include_in_expense_analytics' : 'include_in_income_analytics';

    const rows = fastify.db.prepare(`
      SELECT
        t.category_id,
        COALESCE(c.name, 'Без категории') AS category_name,
        SUM(ABS(t.amount_kopeks)) AS total,
        COUNT(*) AS transaction_count
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = ? AND t.type = ? AND t.date_time >= ? AND t.date_time <= ?
        AND COALESCE(c.${analyticsField}, 1) = 1
      GROUP BY t.category_id
      ORDER BY total DESC
    `).all(userId, type, from, to + 'T23:59:59') as Array<{
      category_id: number | null;
      category_name: string;
      total: number;
      transaction_count: number;
    }>;

    // Для доходов добавляем кэшбэк из расходных транзакций
    if (type === 'income') {
      const cashbackRow = fastify.db.prepare(`
        SELECT COALESCE(SUM(cashback_kopeks), 0) AS total, COUNT(*) AS transaction_count
        FROM transactions
        WHERE user_id = ? AND cashback_kopeks > 0 AND date_time >= ? AND date_time <= ?
      `).get(userId, from, to + 'T23:59:59') as { total: number; transaction_count: number };

      if (cashbackRow.total > 0) {
        const existing = rows.find((r) => r.category_name === 'Кэшбэк');
        if (existing) {
          existing.total += cashbackRow.total;
          existing.transaction_count += cashbackRow.transaction_count;
        } else {
          rows.push({ category_id: null, category_name: 'Кэшбэк', total: cashbackRow.total, transaction_count: cashbackRow.transaction_count });
        }
        rows.sort((a, b) => b.total - a.total);
      }
    }

    const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);

    return rows.map((r) => ({
      ...r,
      percentage: grandTotal > 0 ? Math.round((r.total / grandTotal) * 10000) / 100 : 0,
    }));
  });
}
