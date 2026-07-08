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

// What a locked drop actually shows: no blurred preview of real content —
// there isn't one to blur, the server never sends it — just a sealed
// capsule with a countdown. `onUnlocked` fires after a brief reveal
// transition once the countdown hits zero, giving the parent a moment to
// swap in the real content instead of popping it in instantly.
export const LockedDropPlaceholder: React.FC<LockedDropPlaceholderProps> = ({ memoryType, mood, unlockDate, onUnlocked }) => {
  const [revealing, setRevealing] = useState(false);
  const moodMeta = mood ? MOOD_META[mood] : null;
  const MemoryIcon = MEMORY_TYPE_ICONS[memoryType];

  const handleUnlock = () => {
    setRevealing(true);
    setTimeout(() => onUnlocked?.(), 700);
  };

  return (
    <div
      className={[
        'relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-50 via-white to-blue-50',
        'border border-purple-100/70 px-6 py-10 flex flex-col items-center text-center gap-3',
        'transition-all duration-700 ease-out',
        revealing ? 'scale-105 opacity-0' : 'opacity-100',
      ].join(' ')}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-purple-600/5 via-transparent to-blue-500/5 animate-pulse" aria-hidden="true" />

      <div className="relative w-14 h-14 rounded-full bg-white shadow-md flex items-center justify-center">
        <Lock size={22} className="text-purple-500" aria-hidden="true" />
      </div>

      <div className="relative flex flex-col items-center gap-1">
        <p className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
          <MemoryIcon size={14} className="text-gray-400" aria-hidden="true" />
          {MEMORY_TYPE_LABELS[memoryType]}
          {moodMeta && <span aria-label={moodMeta.label}>{moodMeta.emoji}</span>}
        </p>
        <p className="text-xs text-gray-400">Sealed until it's time.</p>
      </div>

      <CountdownPill unlockDate={unlockDate} onUnlock={handleUnlock} />
    </div>
  );
};
