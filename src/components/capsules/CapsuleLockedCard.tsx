import React from 'react';
import { Lock, Image, Video, Mic, PenLine, Music, Globe2, Users } from 'lucide-react';
import { CapsuleCountdown } from './CapsuleCountdown';
import { MOOD_META } from '../../types/feed';
import { formatDate } from '../../utils/date';
import type { Capsule, CapsuleMemoryType } from '../../types/capsule';

export const MEMORY_TYPE_ICONS: Record<CapsuleMemoryType, typeof Image> = {
  text: PenLine,
  photo: Image,
  video: Video,
  audio: Music,
  voice: Mic,
};

interface CapsuleLockedCardProps {
  capsule: Capsule;
  onUnlockReached?: () => void;
  onOpen?: () => void;
}

// The vault, not a blurred preview — there's nothing to blur, the server
// never sends the content. Layered pulsing rings and a still-sealed
// core give the waiting itself some presence rather than a flat "locked"
// label. Once the countdown reaches zero, "Open Capsule" appears —
// opening is always a deliberate tap, never automatic.
export const CapsuleLockedCard: React.FC<CapsuleLockedCardProps> = ({ capsule, onUnlockReached, onOpen }) => {
  const moodMeta = capsule.mood ? MOOD_META[capsule.mood] : null;
  const isDue = new Date(capsule.unlock_date).getTime() <= Date.now();

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-800 via-fuchsia-800 to-blue-800 px-6 py-10 flex flex-col items-center text-center gap-5">
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5" aria-hidden="true" />

      <div className="relative w-24 h-24 flex items-center justify-center" aria-hidden="true">
        <span className="absolute inset-0 rounded-full bg-white/10 animate-ping" style={{ animationDuration: '3s' }} />
        <span className="absolute inset-2 rounded-full bg-white/10 animate-ping" style={{ animationDuration: '3s', animationDelay: '1s' }} />
        <span className="relative w-16 h-16 rounded-full bg-white/15 backdrop-blur-sm shadow-lg flex items-center justify-center">
          <Lock size={26} className="text-white" aria-hidden="true" />
        </span>
      </div>

      <div className="relative flex flex-col items-center gap-1.5">
        <p className="text-sm font-semibold text-white/90 tracking-wide">Memory Locked</p>
        <div className="flex items-center gap-1.5 flex-wrap justify-center">
          {capsule.memory_types.map(type => {
            const Icon = MEMORY_TYPE_ICONS[type];
            return (
              <span key={type} className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                <Icon size={12} className="text-white/70" aria-hidden="true" />
              </span>
            );
          })}
          {moodMeta && <span className="text-sm" aria-label={moodMeta.label}>{moodMeta.emoji}</span>}
          <span className="text-white/50">
            {capsule.visibility === 'public' ? <Globe2 size={12} aria-hidden="true" /> : capsule.visibility === 'followers' ? <Users size={12} aria-hidden="true" /> : <Lock size={12} aria-hidden="true" />}
          </span>
        </div>
        <p className="text-xs text-white/60">Unlocks {formatDate(capsule.unlock_date)}</p>
      </div>

      <div className="relative w-full max-w-sm">
        <CapsuleCountdown unlockDate={capsule.unlock_date} onUnlock={onUnlockReached} size="lg" />
      </div>

      {isDue && (
        <button
          type="button"
          onClick={onOpen}
          className="relative mt-1 px-6 py-2.5 rounded-full bg-white text-purple-700 text-sm font-semibold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
        >
          Open Capsule
        </button>
      )}
    </div>
  );
};
