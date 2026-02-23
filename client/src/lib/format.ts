export function formatRubles(kopeks: number): string {
  const rubles = Math.abs(kopeks) / 100;
  const formatted = rubles.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sign = kopeks < 0 ? '-' : '';
  return `${sign}${formatted} \u20BD`;
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function rubleInputToKopeks(value: string): number {
  const cleaned = value.replace(/\s/g, '').replace(',', '.');
  return Math.round(parseFloat(cleaned) * 100);
}

export function kopeksToRubleInput(kopeks: number): string {
  return (kopeks / 100).toFixed(2).replace('.', ',');
}

export const typeLabels: Record<string, string> = {
  expense: 'Расход',
  income: 'Доход',
  transfer: 'Перевод',
  ignore: 'Игнор',
};

export const typeColors: Record<string, string> = {
  expense: 'bg-red-900/40 text-red-400',
  income: 'bg-green-900/40 text-green-400',
  transfer: 'bg-blue-900/40 text-blue-400',
  ignore: 'bg-surface-hover text-text-secondary',
};
