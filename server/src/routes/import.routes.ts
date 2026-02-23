import type { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import { columnMappingSchema } from '@expenses/shared';
import type { ProcessedRow, Rule } from '@expenses/shared';
import { generateFingerprint } from '../utils/fingerprint.js';
import { applyRules } from '../utils/rule-engine.js';

interface BatchData {
  headers: string[];
  rows: string[][];
  processedRows: ProcessedRow[];
  mapping: Record<string, string> | null;
}

// Хранилище батчей в памяти
const batchStore = new Map<number, BatchData>();

function parseAmount(value: string): number {
  // Обработка русского формата: "1 234,56" или "-409,97"
  const cleaned = value.replace(/\s/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  return Math.round(num * 100); // Конвертация в копейки
}

const RUSSIAN_MONTHS: Record<string, string> = {
  'янв': '01', 'фев': '02', 'мар': '03', 'апр': '04',
  'мая': '05', 'май': '05', 'июн': '06', 'июл': '07',
  'авг': '08', 'сен': '09', 'окт': '10', 'ноя': '11', 'дек': '12',
};

function parseRussianDate(dateStr: string): string | null {
  // "07 сент. 2025, 15:07" or "30 сент. 2025, 23:59"
  const match = dateStr.match(/^(\d{1,2})\s+([а-яё]+)\.?\s+(\d{4}),?\s+(\d{1,2}):(\d{2})$/i);
  if (!match) return null;
  const [, day, monthStr, year, hour, min] = match;
  const monthKey = monthStr.slice(0, 3).toLowerCase();
  const mm = RUSSIAN_MONTHS[monthKey];
  if (!mm) return null;
  return `${year}-${mm}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${min}:00`;
}

function parseCSV(buffer: Buffer): { headers: string[]; rows: string[][] } {
  // Сначала пробуем UTF-8, потом Windows-1251
  let text = buffer.toString('utf-8');

  // Определение кодировки (win-1251 файлы отображаются «мусором» в UTF-8)
  if (text.includes('\ufffd') || text.includes('????')) {
    try {
      const decoder = new TextDecoder('windows-1251');
      text = decoder.decode(buffer);
    } catch {
      // Оставляем UTF-8
    }
  }

  const records: string[][] = parse(text, {
    delimiter: ';',
    quote: '"',
    relax_quotes: true,
    relax_column_count: true,
    skip_empty_lines: true,
    bom: true,
  });

  if (records.length < 2) {
    return { headers: records[0] || [], rows: [] };
  }

  const headers = records[0];
  const rows = records.slice(1);
  return { headers, rows };
}

function parseXLSX(buffer: Buffer): { headers: string[]; rows: string[][] } {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (data.length < 2) {
    return { headers: (data[0] || []).map(String), rows: [] };
  }

  return {
    headers: data[0].map(String),
    rows: data.slice(1).map((row) => row.map(String)),
  };
}

function suggestMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const lower = headers.map((h) => h.toLowerCase());

  // Дата
  const dateIdx = lower.findIndex((h) => h.includes('дата операции') || h.includes('дата'));
  if (dateIdx >= 0) mapping.date_time = headers[dateIdx];

  // Сумма (приоритет: «сумма в рублях» > «сумма операции» > «сумма платежа» > любая «сумма»)
  const amtRubIdx = lower.findIndex((h) => h.includes('сумма в рублях'));
  if (amtRubIdx >= 0) {
    mapping.amount = headers[amtRubIdx];
  } else {
    const amtIdx = lower.findIndex((h) => h === 'сумма операции' || h.includes('сумма платежа'));
    if (amtIdx >= 0) mapping.amount = headers[amtIdx];
    else {
      const amtIdx2 = lower.findIndex((h) => h.includes('сумма'));
      if (amtIdx2 >= 0) mapping.amount = headers[amtIdx2];
    }
  }

  // Тип операции (для банков с отдельной колонкой «Расходы»/«Доходы»)
  const opTypeIdx = lower.findIndex((h) => h === 'тип операции');
  if (opTypeIdx >= 0) mapping.operation_type = headers[opTypeIdx];

  // Описание
  const descIdx = lower.findIndex((h) => h.includes('описание'));
  if (descIdx >= 0) mapping.description = headers[descIdx];

  // MCC
  const mccIdx = lower.findIndex((h) => h === 'mcc' || h.includes('mcc'));
  if (mccIdx >= 0) mapping.mcc = headers[mccIdx];

  // Категория банка
  const catIdx = lower.findIndex((h) => h === 'категория' || h.includes('категория'));
  if (catIdx >= 0) mapping.bank_category = headers[catIdx];

  // Дополнительная сумма (округление)
  const extraIdx = lower.findIndex((h) => h.includes('округлен') || h.includes('инвесткопилк'));
  if (extraIdx >= 0) mapping.extra_amount = headers[extraIdx];

  return mapping;
}

export async function importRoutes(fastify: FastifyInstance) {
  await fastify.register(multipart, {
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 МБ
  });

  // Шаг 1: Загрузка файла
  fastify.post('/upload', async (request, reply) => {
    if (!request.user) return reply.status(401).send({ error: 'Unauthorized' });

    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'No file provided' });
    }

    const buffer = await data.toBuffer();
    const filename = data.filename;

    let parsed: { headers: string[]; rows: string[][] };
    if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
      parsed = parseXLSX(buffer);
    } else {
      parsed = parseCSV(buffer);
    }

    // Создание батча импорта
    const result = fastify.db.prepare(
      'INSERT INTO import_batches (user_id, source_name, rows_total) VALUES (?, ?, ?)',
    ).run(request.user.id, filename, parsed.rows.length);

    const batchId = Number(result.lastInsertRowid);

    batchStore.set(batchId, {
      headers: parsed.headers,
      rows: parsed.rows,
      processedRows: [],
      mapping: null,
    });

    return {
      batchId,
      headers: parsed.headers,
      sampleRows: parsed.rows.slice(0, 5),
      suggestedMapping: suggestMapping(parsed.headers),
    };
  });

  // Шаг 2: Подтверждение маппинга
  fastify.post('/:batchId/confirm-mapping', async (request, reply) => {
    if (!request.user) return reply.status(401).send({ error: 'Unauthorized' });

    const { batchId } = request.params as { batchId: string };
    const batch = batchStore.get(Number(batchId));
    if (!batch) {
      return reply.status(404).send({ error: 'Batch not found or expired' });
    }

    const parsed = columnMappingSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid mapping', details: parsed.error.issues });
    }

    const mapping = parsed.data;
    batch.mapping = mapping as Record<string, string>;

    // Получение правил пользователя
    const rules = fastify.db.prepare('SELECT * FROM rules WHERE user_id = ? ORDER BY priority DESC')
      .all(request.user.id) as Rule[];

    // Получение категорий для поиска по имени
    const categories = fastify.db.prepare('SELECT id, name FROM categories').all() as { id: number; name: string }[];
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    // Поиск категорий «Кэшбэк» и «Переводы»
    const cashbackCat = categories.find((c) => c.name === 'Кэшбэк');
    const transfersCat = categories.find((c) => c.name === 'Переводы');

    // Получение существующих фингерпринтов для дедупликации
    const existingFingerprints = new Set(
      (fastify.db.prepare('SELECT fingerprint FROM transactions WHERE user_id = ? AND fingerprint IS NOT NULL')
        .all(request.user.id) as { fingerprint: string }[]).map((r) => r.fingerprint),
    );

    const headerIndex = new Map(batch.headers.map((h, i) => [h, i]));
    const getCol = (row: string[], colName?: string): string => {
      if (!colName) return '';
      const idx = headerIndex.get(colName);
      return idx !== undefined ? (row[idx] || '').trim() : '';
    };

    const processedRows: ProcessedRow[] = [];
    let autoClassified = 0;
    let needReview = 0;
    let duplicates = 0;

    for (let i = 0; i < batch.rows.length; i++) {
      const row = batch.rows[i];
      const dateStr = getCol(row, mapping.date_time);
      const amountStr = getCol(row, mapping.amount);
      const description = getCol(row, mapping.description);
      const mcc = getCol(row, mapping.mcc) || null;
      const bankCategory = getCol(row, mapping.bank_category) || null;
      const extraAmountStr = getCol(row, mapping.extra_amount);

      const operationType = getCol(row, mapping.operation_type).toLowerCase();

      let amountKopeks = parseAmount(amountStr);
      // Если банк указал тип операции и сумма положительная — инвертировать знак для расходов
      if (operationType && amountKopeks > 0) {
        if (operationType.includes('расход') || operationType.includes('списан')) {
          amountKopeks = -amountKopeks;
        }
      }
      const extraAmountKopeks = parseAmount(extraAmountStr);

      // Парсинг даты (различные форматы российских банков)
      let dateTime = dateStr;
      const russianDate = parseRussianDate(dateStr);
      if (russianDate) {
        dateTime = russianDate;
      } else {
        const ddmmyyyyMatch = dateStr.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
        if (ddmmyyyyMatch) {
          const [, dd, mm, yyyy, hh, min, ss] = ddmmyyyyMatch;
          dateTime = `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`;
        } else {
          const ddmmyyyyShort = dateStr.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
          if (ddmmyyyyShort) {
            const [, dd, mm, yyyy] = ddmmyyyyShort;
            dateTime = `${yyyy}-${mm}-${dd}T00:00:00`;
          } else {
            try {
              const d = new Date(dateStr);
              if (!isNaN(d.getTime())) dateTime = d.toISOString();
            } catch {
              // Оставляем оригинальную строку
            }
          }
        }
      }

      const fingerprint = generateFingerprint(dateTime, amountKopeks, description, mcc || undefined);

      // Формирование сырой записи
      const raw: Record<string, string> = {};
      batch.headers.forEach((h, idx) => { raw[h] = row[idx] || ''; });

      const processedRow: ProcessedRow = {
        row_index: i,
        raw,
        date_time: dateTime,
        amount_kopeks: amountKopeks,
        description,
        merchant_norm: description, // Используем описание как merchant
        mcc,
        bank_category_raw: bankCategory,
        extra_amount_kopeks: extraAmountKopeks,
        auto_type: null,
        auto_category_id: null,
        auto_category_name: null,
        status: 'auto_classified',
        fingerprint,
        from_tag: null,
        to_tag: null,
        review_reason: null,
      };

      // Проверка дублей
      if (existingFingerprints.has(fingerprint)) {
        processedRow.status = 'duplicate';
        duplicates++;
        processedRows.push(processedRow);
        continue;
      }

      // Первый приоритет — правила пользователя
      const ruleResult = applyRules({
        description,
        merchant_norm: description,
        mcc: mcc || undefined,
        bank_category_raw: bankCategory || undefined,
        amount_kopeks: amountKopeks,
      }, rules);

      if (ruleResult) {
        if (ruleResult.category_id) {
          processedRow.auto_category_id = ruleResult.category_id;
          processedRow.auto_category_name = categoryMap.get(ruleResult.category_id) || null;
        }
        if (ruleResult.type) {
          processedRow.auto_type = ruleResult.type as ProcessedRow['auto_type'];
        }
        if (!processedRow.auto_type) {
          processedRow.auto_type = amountKopeks < 0 ? 'expense' : 'income';
        }
        autoClassified++;
      } else if (bankCategory && bankCategory.toLowerCase().includes('переводы')) {
        // Эвристики Тинькофф для переводов (если правила не сработали)
        if (description.toLowerCase().includes('между своими счетами')) {
          processedRow.auto_type = 'transfer';
          processedRow.auto_category_id = transfersCat?.id ?? null;
          processedRow.auto_category_name = transfersCat?.name ?? 'Переводы';
          processedRow.from_tag = 'Основная карта';
          processedRow.to_tag = 'Другой счёт';
          autoClassified++;
        } else {
          // Внешний перевод — классификация по знаку суммы
          processedRow.auto_type = amountKopeks < 0 ? 'expense' : 'income';
          processedRow.auto_category_id = transfersCat?.id ?? null;
          processedRow.auto_category_name = transfersCat?.name ?? 'Переводы';
          autoClassified++;
        }
      } else if (
        bankCategory && bankCategory.toLowerCase().includes('бонус') &&
        description.toLowerCase().includes('кэшбэк')
      ) {
        processedRow.auto_type = 'income';
        processedRow.auto_category_id = cashbackCat?.id ?? null;
        processedRow.auto_category_name = cashbackCat?.name ?? 'Кэшбэк';
        autoClassified++;
      } else {
        // Тип по умолчанию — по знаку суммы
        processedRow.auto_type = amountKopeks < 0 ? 'expense' : 'income';
        autoClassified++;
      }

      processedRows.push(processedRow);

      // Сохранение фингерпринта для дедупликации внутри батча
      existingFingerprints.add(fingerprint);
    }

    batch.processedRows = processedRows;

    // Обновление статистики батча
    fastify.db.prepare(
      'UPDATE import_batches SET rows_total = ?, rows_need_review = ? WHERE id = ?',
    ).run(processedRows.length, needReview, Number(batchId));

    return {
      preview: processedRows.slice(0, 50),
      stats: {
        total: processedRows.length,
        auto_classified: autoClassified,
        need_review: needReview,
        duplicates,
      },
    };
  });

  // Шаг 3: Получение строк для проверки
  fastify.get('/:batchId/review', async (request, reply) => {
    if (!request.user) return reply.status(401).send({ error: 'Unauthorized' });

    const { batchId } = request.params as { batchId: string };
    const batch = batchStore.get(Number(batchId));
    if (!batch) {
      return reply.status(404).send({ error: 'Batch not found or expired' });
    }

    return batch.processedRows.filter((r) => r.status === 'need_review');
  });

  // Шаг 3б: Отправка решений по проверке
  fastify.post('/:batchId/review', async (request, reply) => {
    if (!request.user) return reply.status(401).send({ error: 'Unauthorized' });

    const { batchId } = request.params as { batchId: string };
    const batch = batchStore.get(Number(batchId));
    if (!batch) {
      return reply.status(404).send({ error: 'Batch not found or expired' });
    }

    const body = request.body as { decisions: Array<{ row_index: number; action: string; type?: string; category_id?: number }> };
    if (!body.decisions) {
      return reply.status(400).send({ error: 'Missing decisions' });
    }

    for (const decision of body.decisions) {
      const row = batch.processedRows.find((r) => r.row_index === decision.row_index);
      if (!row) continue;

      if (decision.action === 'skip') {
        row.status = 'skipped';
      } else if (decision.action === 'approve' || decision.action === 'recategorize') {
        row.status = 'auto_classified';
        if (decision.type) row.auto_type = decision.type as ProcessedRow['auto_type'];
        if (decision.category_id) row.auto_category_id = decision.category_id;
      }
    }

    return { ok: true };
  });

  // Шаг 4: Сохранение в БД
  fastify.post('/:batchId/commit', async (request, reply) => {
    if (!request.user) return reply.status(401).send({ error: 'Unauthorized' });

    const { batchId } = request.params as { batchId: string };
    const batch = batchStore.get(Number(batchId));
    if (!batch) {
      return reply.status(404).send({ error: 'Batch not found or expired' });
    }

    const userId = request.user.id;
    let imported = 0;
    let skipped = 0;
    let duplicateCount = 0;

    const insertTx = fastify.db.prepare(`
      INSERT OR IGNORE INTO transactions (user_id, date_time, type, amount_kopeks, category_id, description, merchant_norm, mcc, bank_category_raw, import_batch_id, fingerprint)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertTransfer = fastify.db.prepare(
      'INSERT INTO transfers (transaction_id, from_tag, to_tag) VALUES (?, ?, ?)',
    );

    const commitTransaction = fastify.db.transaction(() => {
      for (const row of batch.processedRows) {
        if (row.status === 'duplicate') {
          duplicateCount++;
          continue;
        }
        if (row.status === 'skipped') {
          skipped++;
          continue;
        }
        if (row.status === 'need_review') {
          // Не проверено — пропуск
          skipped++;
          continue;
        }

        const result = insertTx.run(
          userId,
          row.date_time,
          row.auto_type || 'expense',
          row.amount_kopeks,
          row.auto_category_id,
          row.description,
          row.merchant_norm,
          row.mcc,
          row.bank_category_raw,
          Number(batchId),
          row.fingerprint,
        );

        if (result.changes > 0) {
          imported++;

          // Обработка переводов
          if (row.auto_type === 'transfer') {
            insertTransfer.run(
              result.lastInsertRowid,
              row.from_tag || null,
              row.to_tag || null,
            );
          }

          // Обработка доп. суммы (округление на инвесткопилку → игнор)
          if (row.extra_amount_kopeks && row.extra_amount_kopeks !== 0) {
            const extraFingerprint = generateFingerprint(row.date_time, row.extra_amount_kopeks, 'Округление на инвесткопилку');
            const extraResult = insertTx.run(
              userId,
              row.date_time,
              'ignore',
              row.extra_amount_kopeks,
              null,
              'Округление на инвесткопилку',
              'Инвесткопилка',
              null,
              null,
              Number(batchId),
              extraFingerprint,
            );
            if (extraResult.changes > 0) {
              imported++;
            }
          }
        } else {
          // INSERT OR IGNORE — коллизия фингерпринта
          duplicateCount++;
        }
      }

      // Обновление статистики батча
      fastify.db.prepare(
        'UPDATE import_batches SET rows_imported = ?, rows_skipped = ? WHERE id = ?',
      ).run(imported, skipped + duplicateCount, Number(batchId));
    });

    commitTransaction();

    // Очистка батча из памяти
    batchStore.delete(Number(batchId));

    return { imported, skipped, duplicates: duplicateCount };
  });
}
