import React from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import type { ToastItem } from '../../hooks/useToast';

interface ToastStackProps {
  toasts: ToastItem[];
}

// A single aria-live region announces every toast to screen readers as
// it appears — the visual stack and the announcement are the same DOM,
// not a separate visually-hidden duplicate.
export const ToastStack: React.FC<ToastStackProps> = ({ toasts }) => (
  <div
    role="status"
    aria-live="polite"
    className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 items-center pointer-events-none w-full px-4"
  >
    {toasts.map(t => (
      <div
        key={t.id}
        className={[
          'pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg text-sm font-medium animate-slide-up max-w-sm',
          t.variant === 'error'
            ? 'bg-red-600 text-white'
            : 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900',
        ].join(' ')}
      >
        {t.variant === 'error' ? <AlertCircle size={15} aria-hidden="true" /> : <CheckCircle2 size={15} aria-hidden="true" />}
        {t.message}
      </div>
    ))}
  </div>
);
