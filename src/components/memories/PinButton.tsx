import React, { useState } from 'react';
import { Pin } from 'lucide-react';
import { useMemories } from '../../hooks/useMemories';
import type { MemorySourceType } from '../../types/memory';

interface PinButtonProps {
  memoryType: MemorySourceType;
  memoryId: string;
  isPinned: boolean;
  onChange?: (isPinned: boolean) => void;
}

// Text-label variant (not an icon-only overlay like FavoriteButton) since
// this lives in MemoryViewer's action row, not floating on a media card.
export const PinButton: React.FC<PinButtonProps> = ({ memoryType, memoryId, isPinned, onChange }) => {
  const { pinMemory, unpinMemory } = useMemories();
  const [pinned, setPinned] = useState(isPinned);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const next = !pinned;
    setPinned(next);
    onChange?.(next);
    const { error: err } = next ? await pinMemory(memoryType, memoryId) : await unpinMemory(memoryType, memoryId);
    if (err) {
      setPinned(!next);
      onChange?.(!next);
      setError(err);
    }
    setBusy(false);
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={pinned}
        className={`flex items-center gap-1.5 text-xs font-medium disabled:opacity-50 ${pinned ? 'text-purple-600' : 'text-gray-600 hover:text-purple-600'}`}
      >
        <Pin size={13} className={pinned ? 'fill-purple-600' : ''} aria-hidden="true" />
        {pinned ? 'Pinned to profile' : 'Pin to profile'}
      </button>
      {error && <p className="text-[11px] text-red-500">{error}</p>}
    </div>
  );
};
