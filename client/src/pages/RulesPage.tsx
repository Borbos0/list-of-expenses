import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../api/client.js';
import { useToast } from '../contexts/ToastContext.js';
import { useConfirm } from '../contexts/ConfirmContext.js';
import type { Rule, Category } from '@expenses/shared';

export function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const { addToast } = useToast();
  const confirm = useConfirm();

  const fetchRules = useCallback(async () => {
    try {
      const data = await apiRequest<Rule[]>('/api/rules');
      setRules(data);
    } catch {
      addToast('Ошибка загрузки правил', 'error');
    }
  }, [addToast]);

  useEffect(() => {
    fetchRules();
    apiRequest<Category[]>('/api/categories').then(setCategories).catch(() => {});
  }, [fetchRules]);

  const handleDelete = async (id: number) => {
    const ok = await confirm({ message: 'Удалить правило?', confirmLabel: 'Удалить', danger: true });
    if (!ok) return;
    try {
      await apiRequest(`/api/rules/${id}`, { method: 'DELETE' });
      addToast('Правило удалено', 'success');
      fetchRules();
    } catch {
      addToast('Ошибка удаления', 'error');
    }
  };

  const matchTypeLabels: Record<string, string> = {
    contains: 'Содержит',
    startsWith: 'Начинается с',
    equals: 'Равно',
    regex: 'Regex',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Правила категоризации</h1>
        <button
          onClick={() => { setEditingRule(null); setModalOpen(true); }}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
        >
          + Добавить
        </button>
      </div>

      <div className="bg-surface rounded-xl shadow-lg shadow-black/20 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-surface text-left text-sm text-text-secondary">
              <th className="px-4 py-3">Приоритет</th>
              <th className="px-4 py-3">Тип совпадения</th>
              <th className="px-4 py-3">Паттерн</th>
              <th className="px-4 py-3">MCC</th>
              <th className="px-4 py-3">Действие</th>
              <th className="px-4 py-3 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id} className="border-t border-border hover:bg-surface-hover text-sm">
                <td className="px-4 py-3">{rule.priority}</td>
                <td className="px-4 py-3">{matchTypeLabels[rule.match_type] || rule.match_type}</td>
                <td className="px-4 py-3 font-mono text-xs">{rule.pattern}</td>
                <td className="px-4 py-3 text-text-secondary">{rule.mcc || '—'}</td>
                <td className="px-4 py-3">
                  {rule.action_category_id
                    ? categories.find((c) => c.id === rule.action_category_id)?.name || `#${rule.action_category_id}`
                    : rule.action_set_type || rule.action_type}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setEditingRule(rule); setModalOpen(true); }}
                      className="px-2.5 py-1 text-xs font-medium rounded-md bg-primary/15 text-primary hover:bg-primary/25 transition-colors"
                    >
                      Изм.
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id)}
                      className="px-2.5 py-1 text-xs font-medium rounded-md bg-danger/15 text-danger hover:bg-danger/25 transition-colors"
                    >
                      Уд.
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-secondary">
                  Нет правил
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <RuleModal
          rule={editingRule}
          categories={categories}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); fetchRules(); }}
        />
      )}
    </div>
  );
}

function RuleModal({ rule, categories, onClose, onSaved }: {
  rule: Rule | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!rule;
  const { addToast } = useToast();

  const [form, setForm] = useState({
    match_type: rule?.match_type || 'contains',
    pattern: rule?.pattern || '',
    mcc: rule?.mcc || '',
    bank_category_raw: rule?.bank_category_raw || '',
    amount_sign: rule?.amount_sign || '',
    action_type: rule?.action_type || 'categorize',
    action_category_id: rule?.action_category_id?.toString() || '',
    action_set_type: rule?.action_set_type || '',
    priority: rule?.priority?.toString() || '0',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const body = {
      match_type: form.match_type,
      pattern: form.pattern,
      mcc: form.mcc || null,
      bank_category_raw: form.bank_category_raw || null,
      amount_sign: form.amount_sign || null,
      action_type: form.action_type,
      action_category_id: form.action_category_id ? Number(form.action_category_id) : null,
      action_set_type: form.action_set_type || null,
      priority: Number(form.priority),
    };

    try {
      if (isEdit) {
        await apiRequest(`/api/rules/${rule.id}`, { method: 'PATCH', body: JSON.stringify(body) });
        addToast('Правило обновлено', 'success');
      } else {
        await apiRequest('/api/rules', { method: 'POST', body: JSON.stringify(body) });
        addToast('Правило создано', 'success');
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
      <div className="bg-surface rounded-xl shadow-xl shadow-black/30 p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-4">{isEdit ? 'Редактировать правило' : 'Новое правило'}</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-text mb-1">Тип совпадения</label>
              <select
                value={form.match_type}
                onChange={(e) => setForm((f) => ({ ...f, match_type: e.target.value as typeof f.match_type }))}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-input-bg text-text"
              >
                <option value="contains">Содержит</option>
                <option value="startsWith">Начинается с</option>
                <option value="equals">Равно</option>
                <option value="regex">Regex</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text mb-1">Паттерн</label>
              <input
                type="text"
                value={form.pattern}
                onChange={(e) => setForm((f) => ({ ...f, pattern: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-input-bg text-text"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-text mb-1">MCC (опц.)</label>
              <input
                type="text"
                value={form.mcc}
                onChange={(e) => setForm((f) => ({ ...f, mcc: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-input-bg text-text"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text mb-1">Кат. банка (опц.)</label>
              <input
                type="text"
                value={form.bank_category_raw}
                onChange={(e) => setForm((f) => ({ ...f, bank_category_raw: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-input-bg text-text"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text mb-1">Знак суммы</label>
              <select
                value={form.amount_sign}
                onChange={(e) => setForm((f) => ({ ...f, amount_sign: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-input-bg text-text"
              >
                <option value="">Любой</option>
                <option value="positive">Положительная</option>
                <option value="negative">Отрицательная</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-text mb-1">Действие</label>
              <select
                value={form.action_type}
                onChange={(e) => setForm((f) => ({ ...f, action_type: e.target.value }))}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-input-bg text-text"
              >
                <option value="categorize">Назначить категорию</option>
                <option value="set_type">Назначить тип</option>
                <option value="ignore">Игнорировать</option>
              </select>
            </div>
            {form.action_type === 'categorize' && (
              <div>
                <label className="block text-sm font-medium text-text mb-1">Категория</label>
                <select
                  value={form.action_category_id}
                  onChange={(e) => setForm((f) => ({ ...f, action_category_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-input-bg text-text"
                >
                  <option value="">—</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
            {form.action_type === 'set_type' && (
              <div>
                <label className="block text-sm font-medium text-text mb-1">Тип операции</label>
                <select
                  value={form.action_set_type}
                  onChange={(e) => setForm((f) => ({ ...f, action_set_type: e.target.value }))}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-input-bg text-text"
                >
                  <option value="expense">Расход</option>
                  <option value="income">Доход</option>
                  <option value="transfer">Перевод</option>
                  <option value="ignore">Игнор</option>
                </select>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Приоритет</label>
            <input
              type="number"
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-input-bg text-text"
            />
          </div>
          <div className="flex gap-3 mt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-border rounded-lg hover:bg-surface-hover transition-colors">
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
