import React, { useState } from 'react';
import { Lock, Image, Video, Mic, PenLine } from 'lucide-react';
import { CountdownPill } from './CountdownPill';
import { MOOD_META, MEMORY_TYPE_LABELS, type Mood, type MemoryType } from '../../types/feed';

export const MEMORY_TYPE_ICONS: Record<MemoryType, typeof Image> = {
  photo: Image,
  video: Video,
  audio: Mic,
  text: PenLine,
};

interface LockedDropPlaceholderProps {
  memoryType: MemoryType;
  mood: Mood | null;
  unlockDate: string;
  onUnlocked?: () => void;
}

// What a locked drop actually shows: no preview of real content — there
// isn't one to show, the server never sends it — just a sealed capsule on
// a plain tinted card. The faint watermark icon is derived from already-
// public metadata (memory type), a quiet hint at *what kind* of moment
// this is without saying anything about its actual contents. `onUnlocked`
// fires after the crack-open transition once the countdown hits zero,
// giving the parent a moment to swap in the real content instead of
// popping it in instantly.
export const LockedDropPlaceholder: React.FC<LockedDropPlaceholderProps> = ({ memoryType, mood, unlockDate, onUnlocked }) => {
  const [revealing, setRevealing] = useState(false);
  const moodMeta = mood ? MOOD_META[mood] : null;
  const MemoryIcon = MEMORY_TYPE_ICONS[memoryType];

  const handleUnlock = () => {
    setRevealing(true);
    setTimeout(() => onUnlocked?.(), 620);
  };

  return (
    <div
      className={[
        'relative overflow-hidden rounded-[28px] border border-purple-100/70 dark:border-purple-900/50',
        'px-6 py-10 flex flex-col items-center text-center gap-3 bg-purple-50 dark:bg-purple-950/20',
        revealing ? 'animate-capsule-crack' : '',
      ].join(' ')}
    >
      {/* Faint oversized watermark of the memory type, sealed behind the
          card — a hint at *what kind* of moment this is without saying
          anything about its actual contents. */}
      <MemoryIcon size={96} className="absolute inset-0 m-auto text-purple-500/10 dark:text-purple-300/10" aria-hidden="true" />

      <div className="relative w-14 h-14 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center tactile">
        <Lock size={22} className="text-purple-500" aria-hidden="true" />
      </div>

      <div className="relative flex flex-col items-center gap-1">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
          <MemoryIcon size={14} className="text-gray-400 dark:text-gray-500" aria-hidden="true" />
          {MEMORY_TYPE_LABELS[memoryType]}
          {moodMeta && <span aria-label={moodMeta.label}>{moodMeta.emoji}</span>}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500">Sealed until it's time.</p>
      </div>

      <div className="relative">
        <CountdownPill unlockDate={unlockDate} onUnlock={handleUnlock} />
      </div>
    </div>
  );
};
