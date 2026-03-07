import { useState } from 'react';
import { apiRequest } from '../api/client.js';
import { useToast } from '../contexts/ToastContext.js';
import { formatRubles, typeLabels } from '../lib/format.js';
import type { ColumnMapping, ProcessedRow } from '@expenses/shared';

type Step = 'upload' | 'mapping' | 'preview' | 'review' | 'result';

interface UploadResponse {
  batchId: number;
  headers: string[];
  sampleRows: string[][];
  suggestedMapping: Partial<ColumnMapping>;
}

interface MappingResponse {
  preview: ProcessedRow[];
  stats: { total: number; auto_classified: number; need_review: number; duplicates: number };
}

interface CommitResponse {
  imported: number;
  skipped: number;
  duplicates: number;
}

export function ImportPage() {
  const [step, setStep] = useState<Step>('upload');
  const [batchId, setBatchId] = useState<number>(0);
  const [headers, setHeaders] = useState<string[]>([]);
  const [sampleRows, setSampleRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<ProcessedRow[]>([]);
  const [reviewRows, setReviewRows] = useState<ProcessedRow[]>([]);
  const [stats, setStats] = useState<MappingResponse['stats'] | null>(null);
  const [result, setResult] = useState<CommitResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const { addToast } = useToast();

  const mappingFields = [
    { key: 'date_time', label: 'Дата', required: true },
    { key: 'amount', label: 'Сумма', required: true },
    { key: 'description', label: 'Описание', required: false },
    { key: 'merchant', label: 'Получатель', required: false },
    { key: 'mcc', label: 'MCC', required: false },
    { key: 'bank_category', label: 'Категория банка', required: false },
    { key: 'extra_amount', label: 'Округление (доп. сумма)', required: false },
    { key: 'cashback', label: 'Кэшбэк', required: false },
  ];

  const handleUpload = async (file: File) => {
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/import/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      const data: UploadResponse = await res.json();

      setBatchId(data.batchId);
      setHeaders(data.headers);
      setSampleRows(data.sampleRows);
      setMapping(data.suggestedMapping as Record<string, string>);
      setStep('mapping');
    } catch {
      addToast('Ошибка загрузки файла', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmMapping = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<MappingResponse>(`/api/import/${batchId}/confirm-mapping`, {
        method: 'POST',
        body: JSON.stringify(mapping),
      });
      setPreview(data.preview);
      setStats(data.stats);
      setStep('preview');
    } catch {
      addToast('Ошибка маппинга', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoToReview = async () => {
    setLoading(true);
    try {
      const rows = await apiRequest<ProcessedRow[]>(`/api/import/${batchId}/review`);
      setReviewRows(rows);
      setStep('review');
    } catch {
      addToast('Ошибка загрузки строк для проверки', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReviewDecision = (index: number, field: string, value: string) => {
    setReviewRows((rows) =>
      rows.map((r) =>
        r.row_index === index ? { ...r, [field]: value } : r,
      ),
    );
  };

  const handleSubmitReview = async () => {
    setLoading(true);
    const decisions = reviewRows.map((r) => ({
      row_index: r.row_index,
      action: 'approve' as const,
      type: r.auto_type,
      category_id: r.auto_category_id,
    }));

    try {
      await apiRequest(`/api/import/${batchId}/review`, {
        method: 'POST',
        body: JSON.stringify({ decisions }),
      });
      const commitResult = await apiRequest<CommitResponse>(`/api/import/${batchId}/commit`, {
        method: 'POST',
      });
      setResult(commitResult);
      setStep('result');
    } catch {
      addToast('Ошибка импорта', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    setLoading(true);
    try {
      const commitResult = await apiRequest<CommitResponse>(`/api/import/${batchId}/commit`, {
        method: 'POST',
      });
      setResult(commitResult);
      setStep('result');
    } catch {
      addToast('Ошибка импорта', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Импорт операций</h1>

      {/* Прогресс */}
      <div className="flex items-center gap-2 mb-6">
        {(['upload', 'mapping', 'preview', 'review', 'result'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step === s ? 'bg-primary text-white' :
              (['upload', 'mapping', 'preview', 'review', 'result'].indexOf(step) > i) ? 'bg-success text-white' :
              'bg-surface-hover text-text-secondary'
            }`}>
              {i + 1}
            </div>
            {i < 4 && <div className="w-8 h-0.5 bg-surface-hover" />}
          </div>
        ))}
      </div>

      {/* Шаг 1: Загрузка */}
      {step === 'upload' && (
        <div
          className={`border-2 border-dashed rounded-xl p-16 text-center transition-colors ${
            dragOver ? 'border-primary bg-blue-900/30' : 'border-border'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleFileDrop}
        >
          <p className="text-text-secondary mb-4">Перетащите CSV или XLSX файл сюда</p>
          <label className="inline-block px-6 py-2.5 bg-primary text-white rounded-lg cursor-pointer hover:bg-primary-hover transition-colors">
            Выбрать файл
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
            />
          </label>
          {loading && <p className="mt-4 text-text-secondary">Загрузка...</p>}
        </div>
      )}

      {/* Шаг 2: Маппинг */}
      {step === 'mapping' && (
        <div className="bg-surface rounded-xl shadow-lg shadow-black/20 p-6">
          <h2 className="text-lg font-semibold mb-4">Маппинг колонок</h2>
          <div className="grid grid-cols-2 gap-4 mb-6">
            {mappingFields.map((f) => (
              <div key={f.key}>
                <label className="block text-sm font-medium text-text mb-1">
                  {f.label} {f.required && <span className="text-danger">*</span>}
                </label>
                <select
                  value={mapping[f.key] || ''}
                  onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-input-bg text-text"
                >
                  <option value="">— не выбрано —</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {/* Пример данных */}
          {sampleRows.length > 0 && (
            <div className="mb-6 overflow-auto">
              <h3 className="text-sm font-medium text-text-secondary mb-2">Пример данных</h3>
              <table className="text-xs border border-border">
                <thead>
                  <tr>
                    {headers.map((h) => (
                      <th key={h} className="px-2 py-1 bg-surface border-b border-border text-left whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sampleRows.slice(0, 5).map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j} className="px-2 py-1 border-b border-border whitespace-nowrap max-w-48 truncate">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button
            onClick={handleConfirmMapping}
            disabled={loading || !mapping.date_time || !mapping.amount}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
          >
            {loading ? 'Обработка...' : 'Далее'}
          </button>
        </div>
      )}

      {/* Шаг 3: Предпросмотр */}
      {step === 'preview' && (
        <div className="bg-surface rounded-xl shadow-lg shadow-black/20 p-6">
          <h2 className="text-lg font-semibold mb-4">Предварительный просмотр</h2>

          {stats && (
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-surface rounded-lg p-3 text-center">
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-sm text-text-secondary">Всего строк</div>
              </div>
              <div className="bg-green-900/30 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-success">{stats.auto_classified}</div>
                <div className="text-sm text-text-secondary">Авто</div>
              </div>
              <div className="bg-yellow-900/30 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-warning">{stats.need_review}</div>
                <div className="text-sm text-text-secondary">На проверку</div>
              </div>
              <div className="bg-surface rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-text-secondary">{stats.duplicates}</div>
                <div className="text-sm text-text-secondary">Дубли</div>
              </div>
            </div>
          )}

          <div className="overflow-auto mb-6 max-h-96">
            <table className="w-full text-sm">
              <thead className="sticky top-0">
                <tr className="bg-surface text-left">
                  <th className="px-3 py-2">Статус</th>
                  <th className="px-3 py-2">Дата</th>
                  <th className="px-3 py-2">Тип</th>
                  <th className="px-3 py-2">Сумма</th>
                  <th className="px-3 py-2">Категория</th>
                  <th className="px-3 py-2">Описание</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 50).map((row) => (
                  <tr key={row.row_index} className={`border-t border-border ${
                    row.status === 'duplicate' ? 'bg-surface-hover opacity-50' :
                    row.status === 'need_review' ? 'bg-yellow-900/30' : ''
                  }`}>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        row.status === 'auto_classified' ? 'bg-green-900/40 text-green-400' :
                        row.status === 'need_review' ? 'bg-yellow-900/40 text-yellow-400' :
                        row.status === 'duplicate' ? 'bg-surface-hover text-text-secondary' :
                        'bg-surface-hover text-text-secondary'
                      }`}>
                        {row.status === 'auto_classified' ? 'Авто' :
                         row.status === 'need_review' ? 'Проверка' :
                         row.status === 'duplicate' ? 'Дубль' : row.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{row.date_time?.slice(0, 10)}</td>
                    <td className="px-3 py-2">{row.auto_type ? typeLabels[row.auto_type] : '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatRubles(row.amount_kopeks)}</td>
                    <td className="px-3 py-2">{row.auto_category_name || '—'}</td>
                    <td className="px-3 py-2 max-w-xs truncate">{row.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3">
            {stats && stats.need_review > 0 ? (
              <button
                onClick={handleGoToReview}
                disabled={loading}
                className="px-6 py-2 bg-warning text-white rounded-lg hover:opacity-90 transition-colors disabled:opacity-50"
              >
                Проверить ({stats.need_review})
              </button>
            ) : (
              <button
                onClick={handleCommit}
                disabled={loading}
                className="px-6 py-2 bg-success text-white rounded-lg hover:opacity-90 transition-colors disabled:opacity-50"
              >
                {loading ? 'Импорт...' : 'Импортировать'}
              </button>
            )}
            <button
              onClick={() => setStep('mapping')}
              className="px-6 py-2 border border-border rounded-lg hover:bg-surface-hover transition-colors"
            >
              Назад
            </button>
          </div>
        </div>
      )}

      {/* Шаг 4: Проверка */}
      {step === 'review' && (
        <div className="bg-surface rounded-xl shadow-lg shadow-black/20 p-6">
          <h2 className="text-lg font-semibold mb-4">Проверка спорных строк ({reviewRows.length})</h2>
          <div className="flex flex-col gap-4 mb-6">
            {reviewRows.map((row) => (
              <div key={row.row_index} className="border border-border rounded-lg p-4 bg-yellow-900/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">{row.description}</div>
                  <div className="font-medium">{formatRubles(row.amount_kopeks)}</div>
                </div>
                <div className="text-sm text-text-secondary mb-3">
                  {row.date_time?.slice(0, 10)} | {row.bank_category_raw || 'Без категории банка'}
                  {row.review_reason && <span className="ml-2 text-warning">({row.review_reason})</span>}
                </div>
                <div className="flex gap-3">
                  <select
                    value={row.auto_type || ''}
                    onChange={(e) => handleReviewDecision(row.row_index, 'auto_type', e.target.value)}
                    className="px-3 py-1.5 border border-border rounded text-sm bg-input-bg text-text"
                  >
                    <option value="expense">Расход</option>
                    <option value="income">Доход</option>
                    <option value="transfer">Перевод</option>
                    <option value="ignore">Игнор</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSubmitReview}
              disabled={loading}
              className="px-6 py-2 bg-success text-white rounded-lg hover:opacity-90 transition-colors disabled:opacity-50"
            >
              {loading ? 'Импорт...' : 'Подтвердить и импортировать'}
            </button>
            <button
              onClick={() => setStep('preview')}
              className="px-6 py-2 border border-border rounded-lg hover:bg-surface-hover transition-colors"
            >
              Назад
            </button>
          </div>
        </div>
      )}

      {/* Шаг 5: Результат */}
      {step === 'result' && result && (
        <div className="bg-surface rounded-xl shadow-lg shadow-black/20 p-8 text-center">
          <div className="text-5xl mb-4">OK</div>
          <h2 className="text-xl font-bold mb-4">Импорт завершён</h2>
          <div className="grid grid-cols-3 gap-4 max-w-md mx-auto mb-6">
            <div>
              <div className="text-2xl font-bold text-success">{result.imported}</div>
              <div className="text-sm text-text-secondary">Импортировано</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-text-secondary">{result.skipped}</div>
              <div className="text-sm text-text-secondary">Пропущено</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-warning">{result.duplicates}</div>
              <div className="text-sm text-text-secondary">Дублей</div>
            </div>
          </div>
          <div className="flex gap-3 justify-center">
            <a href="/transactions" className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors">
              К операциям
            </a>
            <button
              onClick={() => { setStep('upload'); setResult(null); }}
              className="px-6 py-2 border border-border rounded-lg hover:bg-surface-hover transition-colors"
            >
              Импортировать ещё
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
