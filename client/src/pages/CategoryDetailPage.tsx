import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { apiRequest } from "../api/client.js";
import { formatRubles, formatDateTime } from "../lib/format.js";
import type { TimeseriesPoint, Transaction } from "@expenses/shared";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface TransactionsResponse {
  data: Transaction[];
  total: number;
  page: number;
  limit: number;
}

export function CategoryDetailPage() {
  const { categoryId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";
  const type = searchParams.get("type") || "expense";
  const categoryName = searchParams.get("name") || "Категория";
  const isCashback = type === "cashback";

  const [timeseries, setTimeseries] = useState<TimeseriesPoint[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;

  useEffect(() => {
    if (!categoryId || !from || !to || isCashback) return;
    const params = new URLSearchParams({
      from,
      to,
      group: "day",
      type: "both",
      category_id: categoryId,
    });
    apiRequest<TimeseriesPoint[]>(`/api/stats/timeseries?${params}`)
      .then(setTimeseries)
      .catch(() => {});
  }, [categoryId, from, to, isCashback]);

  const fetchTransactions = useCallback(async () => {
    if (!categoryId || !from || !to) return;
    const params = new URLSearchParams({
      from,
      to,
      page: String(page),
      limit: String(limit),
    });
    if (isCashback) {
      params.set("has_cashback", "1");
    } else {
      params.set("category_id", categoryId);
      if (type) params.set("type", type);
    }
    try {
      const res = await apiRequest<TransactionsResponse>(
        `/api/transactions?${params}`,
      );
      setTransactions(res.data);
      setTotal(res.total);
    } catch {
      /* silently handled */
    }
  }, [categoryId, from, to, type, isCashback, page]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const totalPages = Math.ceil(total / limit);

  const chartData = timeseries.map((p) => ({
    period: p.period.slice(5), // "02-14" вместо "2026-02-14"
    amount: type === "income" ? p.income : p.expense,
  }));

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-surface-hover transition-colors"
        >
          &larr; Назад
        </button>
        <h1 className="text-2xl font-bold">{categoryName}</h1>
        <span className="text-text-secondary text-sm">
          {from} — {to}
        </span>
      </div>

      <div
        className={`grid grid-cols-1 ${!isCashback ? "lg:grid-cols-2" : ""} gap-6`}
      >
        {/* Столбчатый график - скрыт для кэшбэка */}
        {!isCashback && (
          <div className="bg-surface rounded-xl shadow-lg shadow-black/20 p-5">
            <h2 className="text-lg font-semibold mb-4">Динамика по дням</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#64748b" />
                <XAxis
                  dataKey="period"
                  tick={{ fontSize: 12, fill: "#475569" }}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "#475569" }}
                  tickFormatter={(v) =>
                    `${(v / 100).toLocaleString("ru-RU")} \u20BD`
                  }
                />
                <Tooltip
                  formatter={(value: number) => formatRubles(value)}
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: 8,
                    color: "#e2e8f0",
                  }}
                  labelStyle={{ color: "#e2e8f0" }}
                />
                <Bar
                  dataKey="amount"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                  name={type === "income" ? "Доходы" : "Расходы"}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Список операций */}
        <div className="bg-surface rounded-xl shadow-lg shadow-black/20 p-5">
          <h2 className="text-lg font-semibold mb-4">Операции ({total})</h2>
          <div className="space-y-1">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between py-2 border-b border-border last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate">
                    {tx.description || "—"}
                  </div>
                  <div className="text-xs text-text-secondary">
                    {formatDateTime(tx.date_time)}
                  </div>
                </div>
                <div className="ml-4 whitespace-nowrap text-right">
                  {isCashback ? (
                    tx.type === 'income' ? (
                      <div className="text-sm font-medium text-success">{formatRubles(tx.amount_kopeks)}</div>
                    ) : (
                      <>
                        <div className="text-sm font-medium text-danger">{formatRubles(tx.amount_kopeks)}</div>
                        <div className="text-xs text-success">+{formatRubles(tx.cashback_kopeks)} кэшбэк</div>
                      </>
                    )
                  ) : (
                    <span
                      className={`text-sm font-medium ${
                        tx.type === "income" ? "text-success" : tx.type === "expense" ? "text-danger" : ""
                      }`}
                    >
                      {formatRubles(tx.amount_kopeks)}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {transactions.length === 0 && (
              <div className="text-center text-text-secondary py-8">
                Нет операций
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border border-border rounded text-sm disabled:opacity-50"
              >
                &lt;
              </button>
              <span className="text-sm text-text-secondary">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 border border-border rounded text-sm disabled:opacity-50"
              >
                &gt;
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
