import { useState, useEffect, useCallback, useRef } from "react";
import { apiRequest } from "../api/client.js";
import { useToast } from "../contexts/ToastContext.js";
import { useConfirm } from "../contexts/ConfirmContext.js";
import {
  formatRubles,
  formatDateTime,
  typeLabels,
  typeColors,
} from "../lib/format.js";
import { TransactionModal } from "../components/TransactionModal.js";
import { DatePresets } from "../components/DatePresets.js";
import { useFilterParams } from "../hooks/useFilterParams.js";
import type { Transaction, Category } from "@expenses/shared";

interface TransactionsResponse {
  data: Transaction[];
  total: number;
  page: number;
  limit: number;
}

export function TransactionsPage() {
  const { filters, setFilter, setDates } = useFilterParams();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [localSearch, setLocalSearch] = useState(filters.search);
  const { addToast } = useToast();
  const confirm = useConfirm();
  const topRef = useRef<HTMLDivElement>(null);
  const limit = 50;

  useEffect(() => {
    apiRequest<Category[]>("/api/categories")
      .then(setCategories)
      .catch(() => {});
  }, []);

  // Синхронизация URL и локальный поиск (при навигации назад)
  useEffect(() => {
    setLocalSearch(filters.search);
  }, [filters.search]);

  // Debounce: локальный поиск и URL (300мс)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== filters.search) {
        setFilter("search", localSearch);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch, filters.search, setFilter]);

  const fetchTransactions = useCallback(async () => {
    const params = new URLSearchParams();
    params.set("from", filters.from);
    params.set("to", filters.to);
    params.set("page", String(filters.page));
    params.set("limit", String(limit));
    if (filters.type) params.set("type", filters.type);
    if (filters.category_id === "none") {
      params.set("no_category", "1");
    } else if (filters.category_id) {
      params.set("category_id", filters.category_id);
    }
    if (filters.search) params.set("search", filters.search);

    try {
      const res = await apiRequest<TransactionsResponse>(
        `/api/transactions?${params}`,
      );
      setTransactions(res.data);
      setTotal(res.total);
    } catch {
      addToast("Ошибка загрузки операций", "error");
    }
  }, [filters, addToast]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [filters.page]);

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      message: "Удалить операцию?",
      confirmLabel: "Удалить",
      danger: true,
    });
    if (!ok) return;
    try {
      await apiRequest(`/api/transactions/${id}`, { method: "DELETE" });
      addToast("Операция удалена", "success");
      fetchTransactions();
    } catch {
      addToast("Ошибка удаления", "error");
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div ref={topRef} />
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Операции</h1>
        <button
          onClick={() => {
            setEditingTx(null);
            setModalOpen(true);
          }}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
        >
          + Добавить
        </button>
      </div>

      {/* Фильтры */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <DatePresets
          dates={{ from: filters.from, to: filters.to }}
          onChange={setDates}
        />
        <select
          value={filters.type}
          onChange={(e) => setFilter("type", e.target.value)}
          className="px-3 py-1.5 border border-border rounded-lg text-sm bg-input-bg text-text"
        >
          <option value="">Все типы</option>
          <option value="expense">Расход</option>
          <option value="income">Доход</option>
          <option value="transfer">Перевод</option>
          <option value="ignore">Игнор</option>
        </select>
        <select
          value={filters.category_id}
          onChange={(e) => setFilter("category_id", e.target.value)}
          className="px-3 py-1.5 border border-border rounded-lg text-sm bg-input-bg text-text"
        >
          <option value="">Все категории</option>
          <option value="none">— Без категории</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder="Поиск..."
          className="px-3 py-1.5 border border-border rounded-lg text-sm bg-input-bg text-text"
        />
      </div>

      {/* Таблица */}
      <div className="bg-surface rounded-xl shadow-lg shadow-black/20 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-surface text-left text-sm text-text-secondary">
              <th className="px-4 py-3">Дата</th>
              <th className="px-4 py-3">Тип</th>
              <th className="px-4 py-3">Сумма</th>
              <th className="px-4 py-3">Категория</th>
              <th className="px-4 py-3">Описание</th>
              <th className="px-4 py-3 w-24"></th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr
                key={tx.id}
                className="border-t border-border hover:bg-surface-hover text-sm"
              >
                <td className="px-4 py-3">{formatDateTime(tx.date_time)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${typeColors[tx.type]}`}
                  >
                    {typeLabels[tx.type]}
                  </span>
                </td>
                <td
                  className={`px-4 py-3 font-medium ${tx.type === "income" ? "text-success" : tx.type === "expense" ? "text-danger" : ""}`}
                >
                  {formatRubles(tx.amount_kopeks)}
                  {tx.cashback_kopeks > 0 && (
                    <span className="ml-2 text-xs font-normal text-success">
                      +{formatRubles(tx.cashback_kopeks)} кэшбэк
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-text-secondary">
                  {tx.category_name || "—"}
                </td>
                <td className="px-4 py-3 text-text-secondary max-w-xs truncate">
                  {tx.description || "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingTx(tx);
                        setModalOpen(true);
                      }}
                      className="px-2.5 py-1 text-xs font-medium rounded-md bg-primary/15 text-primary hover:bg-primary/25 transition-colors"
                    >
                      Изм.
                    </button>
                    <button
                      onClick={() => handleDelete(tx.id)}
                      className="px-2.5 py-1 text-xs font-medium rounded-md bg-danger/15 text-danger hover:bg-danger/25 transition-colors"
                    >
                      Уд.
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-text-secondary"
                >
                  Нет операций
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Пагинация */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setFilter("page", Math.max(1, filters.page - 1))}
            disabled={filters.page === 1}
            className="px-3 py-1 border border-border rounded text-sm disabled:opacity-50"
          >
            &lt;
          </button>
          <span className="text-sm text-text-secondary">
            {filters.page} / {totalPages}
          </span>
          <button
            onClick={() =>
              setFilter("page", Math.min(totalPages, filters.page + 1))
            }
            disabled={filters.page === totalPages}
            className="px-3 py-1 border border-border rounded text-sm disabled:opacity-50"
          >
            &gt;
          </button>
        </div>
      )}

      {modalOpen && (
        <TransactionModal
          transaction={editingTx}
          categories={categories}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            setModalOpen(false);
            fetchTransactions();
          }}
        />
      )}
    </div>
  );
}
