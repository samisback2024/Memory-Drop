import React, { createContext, useCallback, useContext, useState } from 'react';
import { ToastStack } from '../components/ui/Toast';

export type ToastVariant = 'success' | 'error';

export interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DURATION_MS = 3000;

// Mounted once near the app root (see App.tsx) — a shared, consistent
// replacement for the ad hoc "Copied"/inline-state confirmations
// scattered across ShareModal/PinButton/etc. Existing inline
// confirmations weren't ripped out wholesale (they still work fine
// where they are, e.g. ShareModal's own "Link copied" button label) —
// this establishes the shared pattern going forward rather than
// forcing a risky sweep of every button in the app.
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, variant: ToastVariant = 'success') => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, message, variant }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), DURATION_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastStack toasts={toasts} />
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};
