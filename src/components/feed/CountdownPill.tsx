import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Clock } from 'lucide-react';

interface CountdownPillProps {
  unlockDate: string;
  onUnlock?: () => void;
  size?: 'sm' | 'md';
}

const formatRemaining = (ms: number): string => {
  if (ms <= 0) return 'Unlocking…';
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${Math.max(minutes, 1)}m`;
};

// Ticks once a minute — the countdown doesn't need second-level precision,
// and a slower interval means a feed full of these stays cheap. Fires
// `onUnlock` exactly once, the moment it crosses zero while mounted, so a
// card can trigger its reveal animation without the viewer needing to
// refresh.
export const CountdownPill: React.FC<CountdownPillProps> = ({ unlockDate, onUnlock, size = 'md' }) => {
  const target = useMemo(() => new Date(unlockDate).getTime(), [unlockDate]);
  const [remaining, setRemaining] = useState(() => target - Date.now());
  const fired = useRef(false);

  useEffect(() => {
    const tick = () => {
      const next = target - Date.now();
      setRemaining(next);
      if (next <= 0 && !fired.current) {
        fired.current = true;
        onUnlock?.();
      }
    };
    tick();
    const interval = setInterval(tick, 60000);
    return () => clearInterval(interval);
  }, [target, onUnlock]);

  // Under an hour left pulses gently — a physical "it's almost ready"
  // cue rather than just the number changing.
  const almostThere = remaining > 0 && remaining <= 3_600_000;

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full bg-purple-600 text-white font-medium tactile',
        size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm',
        almostThere || remaining <= 0 ? 'animate-pill-pulse' : '',
      ].join(' ')}
    >
      <Clock size={size === 'sm' ? 11 : 13} aria-hidden="true" />
      {remaining <= 0 ? 'Unlocking…' : `Unlocks in ${formatRemaining(remaining)}`}
    </span>
  );
};
