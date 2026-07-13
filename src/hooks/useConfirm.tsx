import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  // true (default) renders the danger-red confirm button + warning icon
  // for destructive actions (delete, block, remove). Set false for a
  // confirm that isn't destructive but still deserves a pause.
  danger?: boolean;
}

interface ConfirmContextType {
  // Promise-based, like window.confirm() but styled and non-blocking —
  // `if (!(await confirm({...}))) return;` at the top of any destructive
  // handler. One shared dialog instance app-wide rather than every
  // delete-capable component owning its own modal state.
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setOptions(opts);
    return new Promise<boolean>(resolve => { resolveRef.current = resolve; });
  }, []);

  const settle = (result: boolean) => {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setOptions(null);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <Modal isOpen={!!options} onClose={() => settle(false)} size="sm" hideClose>
        {options && (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              {options.danger !== false && (
                <span className="w-9 h-9 rounded-full bg-red-50 dark:bg-red-950/40 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={17} className="text-red-500" aria-hidden="true" />
                </span>
              )}
              <div className="flex-1 min-w-0 pt-0.5">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{options.title}</h2>
                {options.description && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{options.description}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => settle(false)}>
                {options.cancelLabel ?? 'Cancel'}
              </Button>
              <Button
                variant={options.danger === false ? 'primary' : 'danger'}
                size="sm"
                onClick={() => settle(true)}
              >
                {options.confirmLabel ?? 'Delete'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </ConfirmContext.Provider>
  );
};

export const useConfirm = (): ConfirmContextType => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
};
