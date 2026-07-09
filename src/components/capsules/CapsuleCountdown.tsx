import React, { useEffect, useRef, useState } from 'react';

interface Breakdown {
  years: number;
  months: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  done: boolean;
}

// Calendar-aware, not a naive ms/unit division — "1 year 2 months" should
// actually mean that, not an approximation based on a fixed day count.
const breakdown = (target: Date, now: Date): Breakdown => {
  if (target <= now) return { years: 0, months: 0, days: 0, hours: 0, minutes: 0, seconds: 0, done: true };

  let years = target.getFullYear() - now.getFullYear();
  let months = target.getMonth() - now.getMonth();
  let days = target.getDate() - now.getDate();
  let hours = target.getHours() - now.getHours();
  let minutes = target.getMinutes() - now.getMinutes();
  let seconds = target.getSeconds() - now.getSeconds();

  if (seconds < 0) { seconds += 60; minutes -= 1; }
  if (minutes < 0) { minutes += 60; hours -= 1; }
  if (hours < 0) { hours += 24; days -= 1; }
  if (days < 0) {
    const daysInPrevMonth = new Date(target.getFullYear(), target.getMonth(), 0).getDate();
    days += daysInPrevMonth;
    months -= 1;
  }
  if (months < 0) { months += 12; years -= 1; }

  return { years, months, days, hours, minutes, seconds, done: false };
};

interface CapsuleCountdownProps {
  unlockDate: string;
  onUnlock?: () => void;
  size?: 'sm' | 'lg';
}

const UNITS: { key: keyof Omit<Breakdown, 'done'>; label: string }[] = [
  { key: 'years', label: 'Years' },
  { key: 'months', label: 'Months' },
  { key: 'days', label: 'Days' },
  { key: 'hours', label: 'Hours' },
  { key: 'minutes', label: 'Minutes' },
  { key: 'seconds', label: 'Seconds' },
];

// Ticks every second — this is the one countdown in the app precise
// enough to matter (a capsule opening is a real moment, not just an
// approximate "unlocks in ~2h" pill). `size="lg"` is the ceremonial,
// full-width display used on the wizard's review step and the locked
// card; `sm` is a compact single-line variant for tighter spaces.
export const CapsuleCountdown: React.FC<CapsuleCountdownProps> = ({ unlockDate, onUnlock, size = 'lg' }) => {
  const target = useRef(new Date(unlockDate)).current;
  const [value, setValue] = useState(() => breakdown(target, new Date()));
  const fired = useRef(false);

  useEffect(() => {
    const tick = () => {
      const next = breakdown(target, new Date());
      setValue(next);
      if (next.done && !fired.current) {
        fired.current = true;
        onUnlock?.();
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [target, onUnlock]);

  if (value.done) {
    return (
      <p className={size === 'lg' ? 'text-lg font-semibold text-white' : 'text-sm font-medium text-purple-600'}>
        This memory is ready to open.
      </p>
    );
  }

  if (size === 'sm') {
    const parts: string[] = [];
    if (value.years > 0) parts.push(`${value.years}y`);
    if (value.months > 0) parts.push(`${value.months}mo`);
    if (value.days > 0) parts.push(`${value.days}d`);
    if (parts.length === 0) parts.push(`${value.hours}h ${value.minutes}m`);
    return <span className="text-xs font-medium text-white/90">{parts.slice(0, 2).join(' ')}</span>;
  }

  return (
    <div className="grid grid-cols-6 gap-1.5 sm:gap-2.5 w-full" role="timer" aria-label="Time until this memory unlocks">
      {UNITS.map(({ key, label }) => (
        <div key={key} className="flex flex-col items-center gap-0.5 bg-white/10 backdrop-blur-sm rounded-xl py-2 sm:py-3 px-0.5">
          <span className="text-lg sm:text-2xl font-bold text-white tabular-nums">{String(value[key]).padStart(2, '0')}</span>
          <span className="text-[9px] sm:text-[10px] uppercase tracking-wide text-white/60">{label}</span>
        </div>
      ))}
    </div>
  );
};
