import { useState, useEffect } from 'react';
import { apiRequest } from '../api/client.js';

function getDefaultDates() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = now.toISOString().slice(0, 10);
  return { from, to };
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function SettingsPage() {
  const [dates, setDates] = useState(getDefaultDates);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<{ last_transaction_date: string | null }>('/api/stats/last-update')
      .then((res) => setLastUpdate(res.last_transaction_date))
      .catch(() => {});
  }, []);

  const downloadBackup = () => {
    window.open('/api/backup/db', '_blank');
  };

  const downloadCSV = () => {
    window.open(`/api/export/transactions.csv?from=${dates.from}&to=${dates.to}`, '_blank');
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Настройки</h1>

      <div className="grid gap-6 max-w-xl">
        {/* Актуальность данных */}
        <div className="bg-surface rounded-xl shadow-lg shadow-black/20 p-6">
          <h2 className="text-lg font-semibold mb-2">Актуальность данных</h2>
          {lastUpdate ? (
            <p className="text-sm text-text-secondary">
              Данные актуальны на{' '}
              <span className="text-text font-medium">{formatDate(lastUpdate)}</span>
              {' '}(дата последней операции в базе).
            </p>
          ) : (
            <p className="text-sm text-text-secondary">Нет импортированных операций.</p>
          )}
        </div>

        {/* Резервная копия */}
        <div className="bg-surface rounded-xl shadow-lg shadow-black/20 p-6">
          <h2 className="text-lg font-semibold mb-2">Резервная копия</h2>
          <p className="text-sm text-text-secondary mb-4">
            Скачать полную базу данных SQLite. Содержит все операции, категории, правила и настройки.
          </p>
          <button
            onClick={downloadBackup}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
          >
            Скачать бэкап
          </button>
        </div>

        {/* Экспорт CSV */}
        <div className="bg-surface rounded-xl shadow-lg shadow-black/20 p-6">
          <h2 className="text-lg font-semibold mb-2">Экспорт операций (CSV)</h2>
          <p className="text-sm text-text-secondary mb-4">
            Выгрузить операции за выбранный период в формате CSV.
          </p>
          <div className="flex items-center gap-2 mb-4">
            <input
              type="date"
              value={dates.from}
              onChange={(e) => setDates((d) => ({ ...d, from: e.target.value }))}
              className="px-3 py-1.5 border border-border rounded-lg text-sm bg-input-bg text-text"
            />
            <span className="text-text-secondary">—</span>
            <input
              type="date"
              value={dates.to}
              onChange={(e) => setDates((d) => ({ ...d, to: e.target.value }))}
              className="px-3 py-1.5 border border-border rounded-lg text-sm bg-input-bg text-text"
            />
          </div>
          <button
            onClick={downloadCSV}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
          >
            Скачать CSV
          </button>
        </div>
      </div>
    </div>
  );
}
