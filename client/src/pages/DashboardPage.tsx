import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiRequest } from '../api/client.js';
import { formatRubles } from '../lib/format.js';
import { DatePresets } from '../components/DatePresets.js';
import type { SummaryResponse, TimeseriesPoint, CategoryBreakdown } from '@expenses/shared';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed',
  '#db2777', '#0891b2', '#65a30d', '#ea580c', '#6366f1',
  '#14b8a6', '#f43f5e',
];

function getDefaultDates() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = now.toISOString().slice(0, 10);
  return { from, to };
}

const tooltipStyle = {
  contentStyle: { backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' },
  labelStyle: { color: '#e2e8f0' },
  itemStyle: { color: '#e2e8f0' },
};

export function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const defaults = useMemo(() => getDefaultDates(), []);
  const dates = useMemo(() => ({
    from: searchParams.get('from') || defaults.from,
    to: searchParams.get('to') || defaults.to,
  }), [searchParams, defaults]);

  const setDates = useCallback((d: { from: string; to: string }) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('from', d.from);
      next.set('to', d.to);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesPoint[]>([]);
  const [byCategory, setByCategory] = useState<CategoryBreakdown[]>([]);
  const [byCategoryIncome, setByCategoryIncome] = useState<CategoryBreakdown[]>([]);
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());
  const [hiddenIncomeCategories, setHiddenIncomeCategories] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  useEffect(() => {
    const params = `from=${dates.from}&to=${dates.to}`;
    Promise.all([
      apiRequest<SummaryResponse>(`/api/stats/summary?${params}`),
      apiRequest<TimeseriesPoint[]>(`/api/stats/timeseries?${params}&group=day&type=both`),
      apiRequest<CategoryBreakdown[]>(`/api/stats/by-category?${params}&type=expense`),
      apiRequest<CategoryBreakdown[]>(`/api/stats/by-category?${params}&type=income`),
    ]).then(([s, t, c, ci]) => {
      setSummary(s);
      setTimeseries(t);
      setByCategory(c);
      setByCategoryIncome(ci);
    });
  }, [dates]);

  const toggleCategory = (name: string) => {
    setHiddenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleIncomeCategory = (name: string) => {
    setHiddenIncomeCategories((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const visibleCategories = byCategory.filter((c) => !hiddenCategories.has(c.category_name));
  const visibleTotal = visibleCategories.reduce((sum, c) => sum + c.total, 0);
  const visibleIncomeCategories = byCategoryIncome.filter((c) => !hiddenIncomeCategories.has(c.category_name));
  const visibleIncomeTotal = visibleIncomeCategories.reduce((sum, c) => sum + c.total, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Дашборд</h1>
        <DatePresets dates={dates} onChange={setDates} />
      </div>

      {/* KPI-карточки */}
      {summary && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-surface rounded-xl shadow-lg shadow-black/20 p-5">
            <div className="text-sm text-text-secondary mb-1">Доходы</div>
            <div className="text-2xl font-bold text-success">
              {formatRubles(summary.total_income)}
            </div>
          </div>
          <div className="bg-surface rounded-xl shadow-lg shadow-black/20 p-5">
            <div className="text-sm text-text-secondary mb-1">Расходы</div>
            <div className="text-2xl font-bold text-danger">
              {formatRubles(summary.total_expense)}
            </div>
          </div>
          <div className="bg-surface rounded-xl shadow-lg shadow-black/20 p-5">
            <div className="text-sm text-text-secondary mb-1">Баланс</div>
            <div className={`text-2xl font-bold ${summary.net >= 0 ? 'text-success' : 'text-danger'}`}>
              {formatRubles(summary.net)}
            </div>
          </div>
        </div>
      )}

      {/* График доходов и расходов */}
      <div className="bg-surface rounded-xl shadow-lg shadow-black/20 p-5 mb-6">
        <h2 className="text-lg font-semibold mb-4">Доходы и расходы</h2>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={timeseries}>
            <CartesianGrid strokeDasharray="3 3" stroke="#64748b" />
            <XAxis dataKey="period" tick={{ fontSize: 12, fill: '#475569' }} />
            <YAxis tick={{ fontSize: 12, fill: '#475569' }} tickFormatter={(v) => `${(v / 100).toLocaleString('ru-RU')} \u20BD`} />
            <Tooltip formatter={(value: number) => formatRubles(value)} {...tooltipStyle} />
            <Area type="monotone" dataKey="income" stroke="#16a34a" fill="#16a34a33" name="Доходы" />
            <Area type="monotone" dataKey="expense" stroke="#dc2626" fill="#dc262633" name="Расходы" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Диаграммы по категориям */}
      <div className="grid grid-cols-2 gap-6">
        {/* Расходы по категориям */}
        <div className="bg-surface rounded-xl shadow-lg shadow-black/20 p-5">
          <h2 className="text-lg font-semibold mb-4">Расходы по категориям</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={visibleCategories}
                dataKey="total"
                nameKey="category_name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ category_name, total }) =>
                  `${category_name} ${visibleTotal > 0 ? Math.round((total / visibleTotal) * 100) : 0}%`
                }
              >
                {visibleCategories.map((entry) => (
                  <Cell
                    key={entry.category_name}
                    fill={COLORS[byCategory.findIndex((c) => c.category_name === entry.category_name) % COLORS.length]}
                    className="cursor-pointer"
                    onClick={() => {
                      if (entry.category_id == null) return;
                      const params = new URLSearchParams({
                        from: dates.from,
                        to: dates.to,
                        type: 'expense',
                        name: entry.category_name,
                      });
                      navigate(`/category/${entry.category_id}?${params}`);
                    }}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => formatRubles(value)} {...tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>

          {/* Переключатели категорий расходов */}
          <div className="flex flex-wrap gap-2 mt-3">
            {byCategory.map((c, i) => {
              const hidden = hiddenCategories.has(c.category_name);
              const color = COLORS[i % COLORS.length];
              return (
                <button
                  key={c.category_name}
                  onClick={() => toggleCategory(c.category_name)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
                    hidden ? 'opacity-40' : ''
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-sm inline-block"
                    style={{ backgroundColor: color }}
                  />
                  {c.category_name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Доходы по категориям */}
        {byCategoryIncome.length > 0 && (
          <div className="bg-surface rounded-xl shadow-lg shadow-black/20 p-5">
            <h2 className="text-lg font-semibold mb-4">Доходы по категориям</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={visibleIncomeCategories}
                  dataKey="total"
                  nameKey="category_name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ category_name, total }) =>
                    `${category_name} ${visibleIncomeTotal > 0 ? Math.round((total / visibleIncomeTotal) * 100) : 0}%`
                  }
                >
                  {visibleIncomeCategories.map((entry) => (
                    <Cell
                      key={entry.category_name}
                      fill={COLORS[byCategoryIncome.findIndex((c) => c.category_name === entry.category_name) % COLORS.length]}
                      className="cursor-pointer"
                      onClick={() => {
                        const params = new URLSearchParams({
                          from: dates.from,
                          to: dates.to,
                          type: entry.category_id == null ? 'cashback' : 'income',
                          name: entry.category_name,
                        });
                        const id = entry.category_id ?? 'cashback';
                        navigate(`/category/${id}?${params}`);
                      }}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatRubles(value)} {...tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>

            {/* Переключатели категорий доходов */}
            <div className="flex flex-wrap gap-2 mt-3">
              {byCategoryIncome.map((c, i) => {
                const hidden = hiddenIncomeCategories.has(c.category_name);
                const color = COLORS[i % COLORS.length];
                return (
                  <button
                    key={c.category_name}
                    onClick={() => toggleIncomeCategory(c.category_name)}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
                      hidden ? 'opacity-40' : ''
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-sm inline-block"
                      style={{ backgroundColor: color }}
                    />
                    {c.category_name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
