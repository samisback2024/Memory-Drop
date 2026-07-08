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
      className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-purple-600 transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none rounded-lg px-1.5 py-1 -mx-1.5"
    >
      <Bookmark size={17} className={saved ? 'fill-purple-600 text-purple-600' : ''} aria-hidden="true" />
      Save
    </button>
  );
};
