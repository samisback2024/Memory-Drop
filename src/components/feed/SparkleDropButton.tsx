import React, { useEffect, useState } from 'react';
import { useDrops } from '../../hooks/useDrops';
import { SparkleDrop } from '../icons/SparkleDrop';
import { RecentLikersPopover } from './RecentLikersPopover';

interface SparkleDropButtonProps {
  dropId: string;
  isSparkled: boolean;
  sparkleCount: number;
  onChange: (isSparkled: boolean, sparkleCount: number) => void;
}

// Post-unlock only — there's no locked-state version of this button; a
// still-sealed drop uses InterestActions instead. Memory Drop's own
// appreciation action — never "Like": a Sparkle Drop, marked with the
// custom crystal-droplet icon instead of a heart. Styled as the same
// gradient-chip pill InterestActions already uses for a locked drop's
// reactions, so the unlocked action row reads as the same design system
// as the locked one.
export const SparkleDropButton: React.FC<SparkleDropButtonProps> = ({ dropId, isSparkled, sparkleCount, onChange }) => {
  const { likeDrop, unlikeDrop } = useDrops();
  const [sparkled, setSparkled] = useState(isSparkled);
  const [count, setCount] = useState(sparkleCount);
  const [busy, setBusy] = useState(false);
  const [popKey, setPopKey] = useState(0);
  const [showFloat, setShowFloat] = useState(false);

  useEffect(() => { setSparkled(isSparkled); setCount(sparkleCount); }, [isSparkled, sparkleCount]);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    const nextSparkled = !sparkled;
    const nextCount = Math.max(0, count + (nextSparkled ? 1 : -1));
    setSparkled(nextSparkled);
    setCount(nextCount);
    onChange(nextSparkled, nextCount);
    if (nextSparkled) {
      setPopKey(k => k + 1);
      setShowFloat(true);
      setTimeout(() => setShowFloat(false), 600);
    }

    const { error } = nextSparkled ? await likeDrop(dropId) : await unlikeDrop(dropId);
    if (error) {
      setSparkled(sparkled);
      setCount(count);
      onChange(sparkled, count);
    }
    setBusy(false);
  };

  return (
    <span
      className={[
        'relative inline-flex items-center gap-1.5 rounded-full pl-2.5 pr-3 py-1.5 text-xs font-semibold transition-all',
        sparkled
          ? 'bg-purple-600 text-white shadow-sm shadow-purple-500/25'
          : 'bg-gray-50 dark:bg-gray-800/70 text-gray-500 dark:text-gray-400',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={toggle}
        aria-pressed={sparkled}
        aria-label={sparkled ? 'Remove Sparkle Drop' : 'Sparkle Drop this memory'}
        className="relative flex items-center focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none rounded-full"
      >
        <SparkleDrop key={popKey} size={14} className={`${sparkled ? 'fill-white' : ''} ${popKey > 0 ? 'animate-reaction-pop' : ''}`} aria-hidden="true" />
        {showFloat && (
          <SparkleDrop size={14} className="absolute left-0 top-0 fill-fuchsia-500 text-fuchsia-500 pointer-events-none animate-reaction-float" aria-hidden="true" />
        )}
      </button>
      <RecentLikersPopover contentType="drop" contentId={dropId} count={count} />
    </span>
  );
};
