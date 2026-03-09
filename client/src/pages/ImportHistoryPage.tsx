import { useState, useEffect } from 'react';
import { apiRequest } from '../api/client.js';
import { formatDateTime } from '../lib/format.js';

interface ImportBatch {
  id: number;
  source_name: string | null;
  created_at: string;
  rows_total: number;
  rows_imported: number;
  rows_skipped: number;
  rows_need_review: number;
}

export function ImportHistoryPage() {
  const [batches, setBatches] = useState<ImportBatch[]>([]);

  useEffect(() => {
    apiRequest<ImportBatch[]>('/api/import/history').then(setBatches).catch(() => {});
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">История импортов</h1>

      <div className="bg-surface rounded-xl shadow-lg shadow-black/20 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-left text-sm text-text-secondary">
              <th className="px-4 py-3">Файл</th>
              <th className="px-4 py-3">Дата</th>
              <th className="px-4 py-3 text-right">Всего</th>
              <th className="px-4 py-3 text-right text-success">Импортировано</th>
              <th className="px-4 py-3 text-right text-text-secondary">Пропущено</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id} className="border-t border-border hover:bg-surface-hover text-sm">
                <td className="px-4 py-3 max-w-xs truncate">{b.source_name || '—'}</td>
                <td className="px-4 py-3 text-text-secondary">{formatDateTime(b.created_at)}</td>
                <td className="px-4 py-3 text-right">{b.rows_total}</td>
                <td className="px-4 py-3 text-right text-success">{b.rows_imported}</td>
                <td className="px-4 py-3 text-right text-text-secondary">{b.rows_skipped}</td>
              </tr>
            ))}
            {batches.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-secondary">
                  Нет импортов
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
