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

// A stable, per-drop hue offset for the aurora background — derived only
// from unlockDate (already public, it's what the countdown itself shows),
// never from the sealed content. Gives every locked card its own subtle
// color variation instead of an identical placeholder repeated down the
// feed, while staying clamped to +/-28deg so it drifts around the brand's
// purple/blue identity rather than landing on an unrelated hue like green.
const hueFromSeed = (seed: string): number => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 57;
  return h - 28;
};

// What a locked drop actually shows: no blurred preview of real content —
// there isn't one to blur, the server never sends it — just a sealed
// capsule under frosted glass. The aurora glow, shimmer sweep, and hidden
// watermark icon are all decorative/derived from already-public metadata
// (memory type, mood, unlock time), meant to make the seal itself feel
// alive and worth waiting for rather than revealing anything early.
// `onUnlocked` fires after the crack-open transition once the countdown
// hits zero, giving the parent a moment to swap in the real content
// instead of popping it in instantly.
export const LockedDropPlaceholder: React.FC<LockedDropPlaceholderProps> = ({ memoryType, mood, unlockDate, onUnlocked }) => {
  const [revealing, setRevealing] = useState(false);
  const moodMeta = mood ? MOOD_META[mood] : null;
  const MemoryIcon = MEMORY_TYPE_ICONS[memoryType];
  const hue = hueFromSeed(unlockDate + memoryType);

  const handleUnlock = () => {
    setRevealing(true);
    setTimeout(() => onUnlocked?.(), 620);
  };

  return (
    <div
      className={[
        'relative overflow-hidden rounded-[28px] border border-purple-100/70 dark:border-purple-900/50',
        'px-6 py-10 flex flex-col items-center text-center gap-3',
        revealing ? 'animate-capsule-crack' : '',
      ].join(' ')}
      style={{ filter: `hue-rotate(${hue}deg)` }}
    >
      {/* Ambient aurora, slowly drifting — the "something's in there"
          feeling, never a preview of actual content. */}
      <div
        className="absolute inset-0 opacity-70 dark:opacity-50 animate-aurora-shift"
        style={{
          backgroundImage:
            'radial-gradient(at 20% 25%, rgb(var(--color-purple-400)) 0px, transparent 55%), radial-gradient(at 80% 20%, rgb(var(--color-blue-400)) 0px, transparent 55%), radial-gradient(at 50% 85%, rgb(var(--color-purple-300)) 0px, transparent 55%)',
          backgroundSize: '200% 200%',
        }}
        aria-hidden="true"
      />
      {/* Frosted glass over the aurora — diffuses it into a soft glow
          rather than a legible shape. */}
      <div className="absolute inset-0 backdrop-blur-2xl bg-white/55 dark:bg-gray-950/55" aria-hidden="true" />

      {/* A light streak sweeping across the glass, like a reflection. */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -inset-y-10 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/50 dark:via-white/10 to-transparent animate-shimmer-sweep" />
      </div>

      {/* Faint oversized watermark of the memory type, sealed behind the
          glass — a hint at *what kind* of moment this is without saying
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
