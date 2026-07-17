import React, { useEffect, useState } from 'react';
import { Bookmark } from 'lucide-react';
import { useDrops } from '../../hooks/useDrops';

interface SaveButtonProps {
  dropId: string;
  isSaved: boolean;
  onChange?: (isSaved: boolean) => void;
}

export const SaveButton: React.FC<SaveButtonProps> = ({ dropId, isSaved, onChange }) => {
  const { saveDrop, unsaveDrop } = useDrops();
  const [saved, setSaved] = useState(isSaved);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setSaved(isSaved); }, [isSaved]);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    const next = !saved;
    setSaved(next);
    onChange?.(next);

    const { error } = next ? await saveDrop(dropId) : await unsaveDrop(dropId);
    if (error) {
      setSaved(saved);
      onChange?.(saved);
    }
    setBusy(false);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      aria-label={saved ? 'Remove from saved' : 'Save this memory'}
      className={[
        'inline-flex items-center gap-1.5 rounded-full pl-2.5 pr-3 py-1.5 text-xs font-semibold transition-all',
        'focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none',
        saved
          ? 'bg-purple-600 text-white shadow-sm shadow-purple-500/25'
          : 'bg-gray-50 dark:bg-gray-800/70 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/70',
      ].join(' ')}
    >
      <Bookmark size={14} className={saved ? 'fill-white' : ''} aria-hidden="true" />
      Save
    </button>
  );
};
