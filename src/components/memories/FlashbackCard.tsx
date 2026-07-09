import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, X } from 'lucide-react';
import { useMemories } from '../../hooks/useMemories';
import { MOOD_META } from '../../types/feed';
import type { Flashback } from '../../types/memory';

interface FlashbackCardProps {
  flashback: Flashback;
  onDismissed: (id: string) => void;
}

// "On this day" — a soft gradient reveal rather than a notification
// badge, since this is meant to feel like a nice surprise, not an alert.
export const FlashbackCard: React.FC<FlashbackCardProps> = ({ flashback, onDismissed }) => {
  const { dismissFlashback } = useMemories();
  const [dismissing, setDismissing] = useState(false);
  const moodMeta = flashback.mood ? MOOD_META[flashback.mood] : null;
  const cover = flashback.media.find(m => m.type === 'photo' || m.type === 'video');

  const handleDismiss = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDismissing(true);
    await dismissFlashback(flashback.memory_type, flashback.id);
    onDismissed(flashback.id);
  };

  return (
    <Link
      to={`/memories/${flashback.memory_type}/${flashback.id}`}
      className={[
        'relative flex items-center gap-3 rounded-2xl overflow-hidden border border-white/60 bg-gradient-to-br from-purple-100 via-fuchsia-50 to-blue-100 p-3 animate-fade-in transition-opacity',
        dismissing ? 'opacity-0' : 'opacity-100',
      ].join(' ')}
    >
      <div className="w-14 h-14 rounded-xl overflow-hidden bg-white/60 flex-shrink-0 flex items-center justify-center">
        {cover ? (
          <img src={cover.url} alt="" className="w-full h-full object-cover" />
        ) : (
          <Sparkles size={20} className="text-purple-400" aria-hidden="true" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-purple-700">{flashback.years_ago} {flashback.years_ago === 1 ? 'year' : 'years'} ago</p>
        <p className="text-sm text-gray-800 truncate">{flashback.title || flashback.caption || 'A memory to revisit'}</p>
        {moodMeta && <span className="text-xs">{moodMeta.emoji}</span>}
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss this flashback"
        className="p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-white/60 transition-colors flex-shrink-0"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </Link>
  );
};
