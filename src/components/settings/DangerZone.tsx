import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../ui/Button';

interface DangerZoneProps {
  title: string;
  description: string;
  actionLabel: string;
  confirmPhrase?: string;
  onConfirm: () => Promise<void> | void;
}

// Every irreversible action in Settings (delete account, delete all
// data) goes through this same shape — type an exact phrase before the
// button even activates, not just a single "are you sure?" click.
export const DangerZone: React.FC<DangerZoneProps> = ({ title, description, actionLabel, confirmPhrase = 'DELETE', onConfirm }) => {
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-red-200 dark:border-red-900/60 bg-red-50/60 dark:bg-red-950/20 p-5 flex flex-col gap-3">
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">{title}</h3>
          <p className="text-xs text-red-600/80 dark:text-red-400/70 mt-0.5">{description}</p>
        </div>
      </div>

      {!expanded ? (
        <Button variant="outline" size="sm" onClick={() => setExpanded(true)} className="self-start !border-red-300 !text-red-600 hover:!bg-red-100">
          {actionLabel}
        </Button>
      ) : (
        <div className="flex flex-col gap-2">
          <label className="text-xs text-red-700 dark:text-red-400">
            Type <span className="font-mono font-semibold">{confirmPhrase}</span> to confirm.
          </label>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            className="border border-red-200 dark:border-red-900 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-red-400"
          />
          <div className="flex gap-2">
            <Button
              variant="danger"
              size="sm"
              disabled={input !== confirmPhrase}
              loading={busy}
              onClick={handleConfirm}
            >
              {actionLabel}
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setExpanded(false); setInput(''); }} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
