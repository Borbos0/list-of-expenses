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

function getPreviousPeriod(from: string, to: string) {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const days = Math.round((toDate.getTime() - fromDate.getTime()) / 86400000) + 1;
  const prevTo = new Date(fromDate);
  prevTo.setDate(prevTo.getDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setDate(prevFrom.getDate() - days + 1);
  return {
    from: prevFrom.toISOString().slice(0, 10),
    to: prevTo.toISOString().slice(0, 10),
  };
}

function Delta({ current, prev, invertColors = false }: { current: number; prev: number; invertColors?: boolean }) {
  if (!prev) return null;
  const pct = Math.round((current - prev) / prev * 100);
  if (pct === 0) return null;
  const up = pct > 0;
  const isGood = invertColors ? !up : up;
  return (
    <div className={`text-xs mt-1 ${isGood ? 'text-success' : 'text-danger'}`}>
      {up ? '▲' : '▼'} {Math.abs(pct)}% vs пред. период
    </div>
  );
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
  const [prevSummary, setPrevSummary] = useState<SummaryResponse | null>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesPoint[]>([]);
  const [topMerchants, setTopMerchants] = useState<Array<{ name: string; total: number; transaction_count: number }>>([]);
  const [byCategory, setByCategory] = useState<CategoryBreakdown[]>([]);
  const [byCategoryIncome, setByCategoryIncome] = useState<CategoryBreakdown[]>([]);
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());
  const [hiddenIncomeCategories, setHiddenIncomeCategories] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  useEffect(() => {
    const params = `from=${dates.from}&to=${dates.to}`;
    const prev = getPreviousPeriod(dates.from, dates.to);
    const prevParams = `from=${prev.from}&to=${prev.to}`;
    Promise.all([
      apiRequest<SummaryResponse>(`/api/stats/summary?${params}`),
      apiRequest<SummaryResponse>(`/api/stats/summary?${prevParams}`),
      apiRequest<TimeseriesPoint[]>(`/api/stats/timeseries?${params}&group=day&type=both`),
      apiRequest<CategoryBreakdown[]>(`/api/stats/by-category?${params}&type=expense`),
      apiRequest<CategoryBreakdown[]>(`/api/stats/by-category?${params}&type=income`),
      apiRequest<Array<{ name: string; total: number; transaction_count: number }>>(`/api/stats/top-merchants?${params}`),
    ]).then(([s, sp, t, c, ci, tm]) => {
      setSummary(s);
      setPrevSummary(sp);
      setTimeseries(t);
      setByCategory(c);
      setByCategoryIncome(ci);
      setTopMerchants(tm);
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
            {prevSummary && <Delta current={summary.total_income} prev={prevSummary.total_income} />}
          </div>
          <div className="bg-surface rounded-xl shadow-lg shadow-black/20 p-5">
            <div className="text-sm text-text-secondary mb-1">Расходы</div>
            <div className="text-2xl font-bold text-danger">
              {formatRubles(summary.total_expense)}
            </div>
            {prevSummary && <Delta current={summary.total_expense} prev={prevSummary.total_expense} invertColors />}
          </div>
          <div className="bg-surface rounded-xl shadow-lg shadow-black/20 p-5">
            <div className="text-sm text-text-secondary mb-1">Баланс</div>
            <div className={`text-2xl font-bold ${summary.net >= 0 ? 'text-success' : 'text-danger'}`}>
              {formatRubles(summary.net)}
            </div>
            {prevSummary && <Delta current={summary.net} prev={prevSummary.net} />}
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

      {/* Топ мерчантов */}
      {topMerchants.length > 0 && (
        <div className="bg-surface rounded-xl shadow-lg shadow-black/20 p-5 mb-6">
          <h2 className="text-lg font-semibold mb-3">Топ расходов</h2>
          <div className="space-y-2">
            {topMerchants.map((m) => {
              const maxTotal = topMerchants[0].total;
              const pct = Math.round((m.total / maxTotal) * 100);
              return (
                <div key={m.name} className="flex items-center gap-3">
                  <div className="w-36 text-sm truncate shrink-0">{m.name}</div>
                  <div className="flex-1 bg-surface-hover rounded-full h-2">
                    <div className="bg-danger h-2 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-sm font-medium text-danger w-28 text-right shrink-0">
                    {formatRubles(m.total)}
                  </div>
                  <div className="text-xs text-text-secondary w-16 text-right shrink-0">
                    {m.transaction_count} опер.
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
                        if (entry.category_name === 'Кэшбэк') {
                          const params = new URLSearchParams({ from: dates.from, to: dates.to, type: 'cashback', name: 'Кэшбэк' });
                          navigate(`/category/cashback?${params}`);
                        } else if (entry.category_id == null) {
                          navigate(`/transactions?from=${dates.from}&to=${dates.to}&type=income&category_id=none`);
                        } else {
                          const params = new URLSearchParams({ from: dates.from, to: dates.to, type: 'income', name: entry.category_name });
                          navigate(`/category/${entry.category_id}?${params}`);
                        }
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
