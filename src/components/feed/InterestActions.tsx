import React, { useState } from 'react';
import { Bookmark, Star, Zap, Wand2 } from 'lucide-react';
import { useDrops } from '../../hooks/useDrops';
import { INTEREST_META, type InterestType } from '../../types/feed';

interface InterestActionsProps {
  dropId: string;
  counts: Record<InterestType, number>;
  active: Record<InterestType, boolean>;
  onChange: (type: InterestType, isActive: boolean) => void;
}

const ICONS: Record<InterestType, typeof Bookmark> = {
  save_to_unlock: Bookmark,
  interested: Star,
  cant_wait: Zap,
  good_vibes: Wand2,
};

const ORDER: InterestType[] = ['save_to_unlock', 'interested', 'cant_wait', 'good_vibes'];

// The locked-drop action row — four uplifting, anticipation-flavored
// reactions instead of a like/comment row that has nothing to attach to
// yet. Deliberately not styled like the muted post-unlock action bar:
// warm pill buttons that light up on selection, so waiting for a memory
// to open feels like part of the experience, not a dead end.
export const InterestActions: React.FC<InterestActionsProps> = ({ dropId, counts, active, onChange }) => {
  const { addInterest, removeInterest } = useDrops();
  const [busy, setBusy] = useState<InterestType | null>(null);

  const toggle = async (type: InterestType) => {
    if (busy) return;
    setBusy(type);
    const next = !active[type];
    onChange(type, next);

    const { error } = next ? await addInterest(dropId, type) : await removeInterest(dropId, type);
    if (error) onChange(type, !next);
    setBusy(null);
  };

  return (
    <div role="group" aria-label="Show some love before it unlocks" className="flex flex-wrap gap-2 px-4 pb-4">
      {ORDER.map(type => {
        const Icon = ICONS[type];
        const meta = INTEREST_META[type];
        const isActive = active[type];
        const count = counts[type];
        return (
          <button
            key={type}
            type="button"
            onClick={() => toggle(type)}
            aria-pressed={isActive}
            className={[
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
              'focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none',
              isActive
                ? 'bg-gradient-to-r from-purple-500 to-blue-500 border-transparent text-white shadow-sm'
                : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-purple-200 dark:hover:border-purple-800 hover:text-purple-600 dark:hover:text-purple-400',
            ].join(' ')}
          >
            <Icon size={13} aria-hidden="true" />
            {isActive ? meta.activeLabel : meta.label}
            {count > 0 && <span className={isActive ? 'text-white/80' : 'text-gray-400 dark:text-gray-500'}>{count}</span>}
          </button>
        );
      })}
    </div>
  );
};
