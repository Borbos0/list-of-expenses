import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../api/client.js';
import { useToast } from '../contexts/ToastContext.js';
import { useConfirm } from '../contexts/ConfirmContext.js';
import type { Category } from '@expenses/shared';

export function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const { addToast } = useToast();
  const confirm = useConfirm();

  const fetchCategories = useCallback(async () => {
    try {
      const data = await apiRequest<Category[]>('/api/categories');
      setCategories(data);
    } catch {
      addToast('Ошибка загрузки категорий', 'error');
    }
  }, [addToast]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleToggle = async (cat: Category, field: 'include_in_expense_analytics' | 'include_in_income_analytics') => {
    try {
      await apiRequest(`/api/categories/${cat.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ [field]: !cat[field] }),
      });
      fetchCategories();
    } catch {
      addToast('Ошибка обновления', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm({ message: 'Удалить категорию?', confirmLabel: 'Удалить', danger: true });
    if (!ok) return;
    try {
      await apiRequest(`/api/categories/${id}`, { method: 'DELETE' });
      addToast('Категория удалена', 'success');
      fetchCategories();
    } catch {
      addToast('Невозможно удалить: есть связанные операции', 'error');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Категории</h1>
        <button
          onClick={() => { setEditingCat(null); setModalOpen(true); }}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
        >
          + Добавить
        </button>
      </div>

      <div className="bg-surface rounded-xl shadow-lg shadow-black/20 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-surface text-left text-sm text-text-secondary">
              <th className="px-4 py-3">Название</th>
              <th className="px-4 py-3 text-center">В аналитике расходов</th>
              <th className="px-4 py-3 text-center">В аналитике доходов</th>
              <th className="px-4 py-3 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <tr key={cat.id} className="border-t border-border hover:bg-surface-hover text-sm">
                <td className="px-4 py-3 font-medium">{cat.name}</td>
                <td className="px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={cat.include_in_expense_analytics}
                    onChange={() => handleToggle(cat, 'include_in_expense_analytics')}
                    className="w-4 h-4"
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={cat.include_in_income_analytics}
                    onChange={() => handleToggle(cat, 'include_in_income_analytics')}
                    className="w-4 h-4"
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setEditingCat(cat); setModalOpen(true); }}
                      className="px-2.5 py-1 text-xs font-medium rounded-md bg-primary/15 text-primary hover:bg-primary/25 transition-colors"
                    >
                      Изм.
                    </button>
                    <button
                      onClick={() => handleDelete(cat.id)}
                      className="px-2.5 py-1 text-xs font-medium rounded-md bg-danger/15 text-danger hover:bg-danger/25 transition-colors"
                    >
                      Уд.
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <CategoryModal
          category={editingCat}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); fetchCategories(); }}
        />
      )}
    </div>
  );
}

function CategoryModal({ category, onClose, onSaved }: {
  category: Category | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!category;
  const { addToast } = useToast();

  const [form, setForm] = useState({
    name: category?.name || '',
    include_in_expense_analytics: category?.include_in_expense_analytics ?? true,
    include_in_income_analytics: category?.include_in_income_analytics ?? false,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isEdit) {
        await apiRequest(`/api/categories/${category.id}`, {
          method: 'PATCH',
          body: JSON.stringify(form),
        });
        addToast('Категория обновлена', 'success');
      } else {
        await apiRequest('/api/categories', {
          method: 'POST',
          body: JSON.stringify(form),
        });
        addToast('Категория создана', 'success');
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
      <div className="bg-surface rounded-xl shadow-xl shadow-black/30 p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-4">{isEdit ? 'Редактировать' : 'Новая категория'}</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="block text-sm font-medium text-text mb-1">Название</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-input-bg text-text"
              required
              autoFocus
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.include_in_expense_analytics}
              onChange={(e) => setForm((f) => ({ ...f, include_in_expense_analytics: e.target.checked }))}
            />
            Включить в аналитику расходов
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.include_in_income_analytics}
              onChange={(e) => setForm((f) => ({ ...f, include_in_income_analytics: e.target.checked }))}
            />
            Включить в аналитику доходов
          </label>
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
