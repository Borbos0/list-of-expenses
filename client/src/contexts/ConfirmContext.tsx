import { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { open: boolean }) | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm: ConfirmFn = useCallback((options) => {
    const opts = typeof options === 'string' ? { message: options } : options;
    setState({ ...opts, open: true });
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const handleClose = (result: boolean) => {
    setState(null);
    resolveRef.current?.(result);
    resolveRef.current = null;
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state?.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => handleClose(false)}>
          <div className="bg-surface rounded-xl shadow-xl shadow-black/30 p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            {state.title && <h3 className="text-lg font-bold mb-2">{state.title}</h3>}
            <p className="text-sm text-text-secondary mb-5">{state.message}</p>
            <div className="flex gap-3">
              <button
                onClick={() => handleClose(true)}
                className={`flex-1 py-2 text-white rounded-lg transition-colors ${
                  state.danger
                    ? 'bg-danger hover:bg-danger-hover'
                    : 'bg-primary hover:bg-primary-hover'
                }`}
              >
                {state.confirmLabel || 'Подтвердить'}
              </button>
              <button
                onClick={() => handleClose(false)}
                className="flex-1 py-2 border border-border rounded-lg hover:bg-surface-hover transition-colors"
              >
                {state.cancelLabel || 'Отмена'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error('useConfirm must be used within ConfirmProvider');
  return context;
}
