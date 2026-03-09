import { useState } from 'react';
import { apiRequest } from '../api/client.js';
import { useToast } from '../contexts/ToastContext.js';
import { useConfirm } from '../contexts/ConfirmContext.js';
import { rubleInputToKopeks, kopeksToRubleInput } from '../lib/format.js';
import type { Transaction, Category } from '@expenses/shared';

interface Props {
  transaction: Transaction | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}

export function TransactionModal({ transaction, categories, onClose, onSaved }: Props) {
  const isEdit = !!transaction;
  const { addToast } = useToast();
  const confirm = useConfirm();

  const [form, setForm] = useState({
    date_time: transaction?.date_time?.slice(0, 16) || new Date().toISOString().slice(0, 16),
    type: transaction?.type || 'expense',
    amount: transaction ? kopeksToRubleInput(Math.abs(transaction.amount_kopeks)) : '',
    category_id: transaction?.category_id?.toString() || '',
    description: transaction?.description || '',
    tags: transaction?.tags || '',
    from_tag: transaction?.from_tag || '',
    to_tag: transaction?.to_tag || '',
  });
  const [loading, setLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  const handleBulkUpdate = async () => {
    if (!transaction?.description) return;
    const ok = await confirm({
      title: 'Массовое обновление',
      message: `Применить тип и категорию ко всем операциям с описанием «${transaction.description}»?`,
      confirmLabel: 'Применить',
    });
    if (!ok) return;

    setBulkLoading(true);
    try {
      const body: Record<string, unknown> = {
        match_description: transaction.description,
        type: form.type,
        category_id: form.category_id ? Number(form.category_id) : null,
      };
      const res = await apiRequest<{ updated: number }>('/api/transactions/bulk', {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      addToast(`Обновлено операций: ${res.updated}`, 'success');
      onSaved();
    } catch {
      addToast('Ошибка массового обновления', 'error');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const kopeks = rubleInputToKopeks(form.amount);
    const body = {
      date_time: new Date(form.date_time).toISOString(),
      type: form.type,
      amount_kopeks: form.type === 'expense' ? -kopeks : kopeks,
      category_id: form.category_id ? Number(form.category_id) : null,
      description: form.description,
      tags: form.tags || undefined,
      ...(form.type === 'transfer' ? { from_tag: form.from_tag, to_tag: form.to_tag } : {}),
    };

    try {
      if (isEdit) {
        await apiRequest(`/api/transactions/${transaction.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        addToast('Операция обновлена', 'success');
      } else {
        await apiRequest('/api/transactions', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        addToast('Операция создана', 'success');
      }
      onSaved();
    } catch {
      addToast('Ошибка сохранения', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-surface rounded-xl shadow-xl shadow-black/30 p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-4">{isEdit ? 'Редактировать' : 'Новая операция'}</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="block text-sm font-medium text-text mb-1">Дата и время</label>
            <input
              type="datetime-local"
              value={form.date_time}
              onChange={(e) => setForm((f) => ({ ...f, date_time: e.target.value }))}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-input-bg text-text"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Тип</label>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as typeof f.type }))}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-input-bg text-text"
            >
              <option value="expense">Расход</option>
              <option value="income">Доход</option>
              <option value="transfer">Перевод</option>
              <option value="ignore">Игнор</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Сумма (руб.)</label>
            <input
              type="text"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="0,00"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-input-bg text-text"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Категория</label>
            <select
              value={form.category_id}
              onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-input-bg text-text"
            >
              <option value="">Без категории</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Описание</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-input-bg text-text"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Теги</label>
            <input
              type="text"
              value={form.tags}
              onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              placeholder="отпуск, работа, подарок..."
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-input-bg text-text"
            />
          </div>
          {form.type === 'transfer' && (
            <>
              <div>
                <label className="block text-sm font-medium text-text mb-1">Откуда</label>
                <input
                  type="text"
                  value={form.from_tag}
                  onChange={(e) => setForm((f) => ({ ...f, from_tag: e.target.value }))}
                  placeholder="Карта, Наличные..."
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-input-bg text-text"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text mb-1">Куда</label>
                <input
                  type="text"
                  value={form.to_tag}
                  onChange={(e) => setForm((f) => ({ ...f, to_tag: e.target.value }))}
                  placeholder="Копилка, Друг..."
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-input-bg text-text"
                />
              </div>
            </>
          )}
          <div className="flex gap-3 mt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-border rounded-lg hover:bg-surface-hover transition-colors"
            >
              Отмена
            </button>
          </div>
          {isEdit && transaction?.description && (
            <button
              type="button"
              onClick={handleBulkUpdate}
              disabled={bulkLoading}
              className="w-full py-2 text-sm border border-border rounded-lg hover:bg-surface-hover transition-colors text-text-secondary disabled:opacity-50"
            >
              {bulkLoading ? 'Обновление...' : `Применить тип и категорию ко всем "${transaction.description}"`}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
