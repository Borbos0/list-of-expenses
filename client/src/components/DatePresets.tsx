interface Props {
  dates: { from: string; to: string };
  onChange: (dates: { from: string; to: string }) => void;
}

function toStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const presets = [
  {
    label: 'Текущий месяц',
    get: () => {
      const now = new Date();
      return { from: toStr(new Date(now.getFullYear(), now.getMonth(), 1)), to: toStr(now) };
    },
  },
  {
    label: 'Прошлый месяц',
    get: () => {
      const now = new Date();
      return {
        from: toStr(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        to: toStr(new Date(now.getFullYear(), now.getMonth(), 0)),
      };
    },
  },
  {
    label: '3 месяца',
    get: () => {
      const now = new Date();
      return { from: toStr(new Date(now.getFullYear(), now.getMonth() - 2, 1)), to: toStr(now) };
    },
  },
  {
    label: 'Год',
    get: () => {
      const now = new Date();
      return { from: `${now.getFullYear()}-01-01`, to: toStr(now) };
    },
  },
] as const;

export function DatePresets({ dates, onChange }: Props) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {presets.map((p) => (
        <button
          key={p.label}
          type="button"
          onClick={() => onChange(p.get())}
          className="px-2.5 py-1 text-xs rounded-md bg-surface-hover text-text-secondary hover:text-text hover:bg-primary/20 transition-colors"
        >
          {p.label}
        </button>
      ))}
      <input
        type="date"
        value={dates.from}
        onChange={(e) => onChange({ ...dates, from: e.target.value })}
        className="px-3 py-1.5 border border-border rounded-lg text-sm bg-input-bg text-text"
      />
      <span className="text-text-secondary">—</span>
      <input
        type="date"
        value={dates.to}
        onChange={(e) => onChange({ ...dates, to: e.target.value })}
        className="px-3 py-1.5 border border-border rounded-lg text-sm bg-input-bg text-text"
      />
    </div>
  );
}
