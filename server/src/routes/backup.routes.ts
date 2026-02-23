import type { FastifyInstance } from 'fastify';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { statsQuerySchema } from '@expenses/shared';

export async function backupRoutes(fastify: FastifyInstance) {
  // Скачивание резервной копии БД
  fastify.get('/backup/db', async (request, reply) => {
    if (!request.user) return reply.status(401).send({ error: 'Unauthorized' });

    const backupPath = path.join(os.tmpdir(), `expenses-backup-${Date.now()}.db`);

    try {
      await fastify.db.backup(backupPath);
      const date = new Date().toISOString().slice(0, 10);
      const stream = fs.createReadStream(backupPath);

      reply.header('Content-Disposition', `attachment; filename="expenses-${date}.db"`);
      reply.type('application/octet-stream');

      // Удаление временного файла после отправки
      stream.on('end', () => {
        try { fs.unlinkSync(backupPath); } catch { /* ignore */ }
      });

      return reply.send(stream);
    } catch (err) {
      try { fs.unlinkSync(backupPath); } catch { /* ignore */ }
      throw err;
    }
  });

  // Экспорт операций в CSV
  fastify.get('/export/transactions.csv', async (request, reply) => {
    if (!request.user) return reply.status(401).send({ error: 'Unauthorized' });

    const parsed = statsQuerySchema.safeParse(request.query);
    const from = parsed.success ? parsed.data.from : '2000-01-01';
    const to = parsed.success ? parsed.data.to : '2099-12-31';

    const rows = fastify.db.prepare(`
      SELECT t.*, c.name as category_name
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
      WHERE t.user_id = ? AND t.date_time >= ? AND t.date_time <= ?
      ORDER BY t.date_time DESC
    `).all(request.user.id, from, to + 'T23:59:59') as any[];

    // BOM для корректного отображения кириллицы в Excel
    const BOM = '\uFEFF';
    const header = 'Дата;Тип;Сумма;Категория;Описание;MCC;Теги\n';

    const csvRows = rows.map((r) => {
      const amount = (r.amount_kopeks / 100).toFixed(2).replace('.', ',');
      return [
        r.date_time,
        r.type,
        amount,
        r.category_name || '',
        (r.description || '').replace(/;/g, ','),
        r.mcc || '',
        r.tags || '',
      ].join(';');
    }).join('\n');

    const date = new Date().toISOString().slice(0, 10);
    reply.header('Content-Disposition', `attachment; filename="transactions-${date}.csv"`);
    reply.type('text/csv; charset=utf-8');
    return BOM + header + csvRows;
  });
}
