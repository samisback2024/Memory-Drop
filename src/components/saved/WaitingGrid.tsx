import React from 'react';
import { Link } from 'react-router-dom';
import { Lock, Image as ImageIcon, Video, Mic, PenLine } from 'lucide-react';
import { MOOD_META, type MemoryType } from '../../types/feed';
import type { Drop } from '../../types/feed';

const TYPE_ICONS: Record<MemoryType, typeof ImageIcon> = {
  photo: ImageIcon, video: Video, audio: Mic, text: PenLine,
};

interface WaitingGridProps {
  drops: Drop[];
}

// A compact grid alternative to the full feed-card scroll for Waiting
// to Unlock. Locked cells (most of what lives on this tab, by
// definition) stay non-interactive rather than linking anywhere — the
// Memory Details permalink only ever resolves for your own content or
// something already unlocked (get_memory denies everyone else's still-
// sealed Drops), so a tap there would just land on a confusing "this
// memory doesn't exist" page. Anything already past its unlock time
// (the 2-day grace window before it rolls off this tab) links through
// like normal.
export const WaitingGrid: React.FC<WaitingGridProps> = ({ drops }) => (
  <div className="grid grid-cols-3 gap-1.5">
    {drops.map(drop => {
      const Icon = TYPE_ICONS[drop.post_type] ?? PenLine;
      const moodMeta = drop.mood ? MOOD_META[drop.mood] : null;
      const cover = drop.images[0];

      const cellClass = 'relative aspect-square rounded-xl overflow-hidden bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-950/50 dark:to-blue-950/50 block';

      const inner = (
        <>
          {cover && drop.is_unlocked ? (
            <img src={cover.url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 p-2 text-center">
              {!drop.is_unlocked ? <Lock size={18} className="text-purple-400" aria-hidden="true" /> : <Icon size={18} className="text-purple-400" aria-hidden="true" />}
              {moodMeta && <span className="text-sm">{moodMeta.emoji}</span>}
            </div>
          )}
          {!drop.is_unlocked && (
            <span className="absolute bottom-1.5 left-1.5 w-5 h-5 rounded-full bg-black/50 flex items-center justify-center">
              <Lock size={10} className="text-white" aria-hidden="true" />
            </span>
          )}
        </>
      );

      return drop.is_unlocked ? (
        <Link key={drop.id} to={`/memories/drop/${drop.id}`} className={`${cellClass} group`}>
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
          {inner}
        </Link>
      ) : (
        <div key={drop.id} className={cellClass} aria-label="Still sealed">
          {inner}
        </div>
      );
    })}
  </div>
);
