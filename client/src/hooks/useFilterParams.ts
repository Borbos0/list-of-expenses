import { useSearchParams } from 'react-router-dom';
import { useCallback, useMemo } from 'react';

function getDefaultDates() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = now.toISOString().slice(0, 10);
  return { from, to };
}

export interface FilterParams {
  from: string;
  to: string;
  type: string;
  category_id: string;
  search: string;
  tag: string;
  page: number;
}

export function useFilterParams() {
  const [searchParams, setSearchParams] = useSearchParams();
  const defaults = useMemo(() => getDefaultDates(), []);

  const filters: FilterParams = useMemo(() => ({
    from: searchParams.get('from') || defaults.from,
    to: searchParams.get('to') || defaults.to,
    type: searchParams.get('type') || '',
    category_id: searchParams.get('category_id') || '',
    search: searchParams.get('search') || '',
    tag: searchParams.get('tag') || '',
    page: Number(searchParams.get('page')) || 1,
  }), [searchParams, defaults]);

  const setFilter = useCallback((key: string, value: string | number) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      const strValue = String(value);
      if (!strValue || strValue === '0') {
        next.delete(key);
      } else {
        next.set(key, strValue);
      }
      if (key !== 'page') {
        next.delete('page');
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const setDates = useCallback((dates: { from: string; to: string }) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('from', dates.from);
      next.set('to', dates.to);
      next.delete('page');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  return { filters, setFilter, setDates };
}
