import React, { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { useDrops } from '../../hooks/useDrops';
import { RecentLikersPopover } from './RecentLikersPopover';

interface LikeButtonProps {
  dropId: string;
  isLiked: boolean;
  likeCount: number;
  onChange: (isLiked: boolean, likeCount: number) => void;
}

// Post-unlock only — there's no locked-state version of this button; a
// still-sealed drop uses InterestActions instead. Styled as the same
// gradient-chip pill InterestActions already uses for a locked drop's
// reactions, rather than a bare tinted icon — the unlocked action row
// should read as the same design system as the locked one, not a plain
// generic feed's like button. The heart toggle and the like-count (which
// RecentLikersPopover renders as its own tap target, for "who liked
// this") are two separate buttons sharing one pill so both stay
// independently clickable.
export const LikeButton: React.FC<LikeButtonProps> = ({ dropId, isLiked, likeCount, onChange }) => {
  const { likeDrop, unlikeDrop } = useDrops();
  const [liked, setLiked] = useState(isLiked);
  const [count, setCount] = useState(likeCount);
  const [busy, setBusy] = useState(false);
  const [popKey, setPopKey] = useState(0);
  const [showFloat, setShowFloat] = useState(false);

  useEffect(() => { setLiked(isLiked); setCount(likeCount); }, [isLiked, likeCount]);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    const nextLiked = !liked;
    const nextCount = Math.max(0, count + (nextLiked ? 1 : -1));
    setLiked(nextLiked);
    setCount(nextCount);
    onChange(nextLiked, nextCount);
    if (nextLiked) {
      setPopKey(k => k + 1);
      setShowFloat(true);
      setTimeout(() => setShowFloat(false), 600);
    }

    const { error } = nextLiked ? await likeDrop(dropId) : await unlikeDrop(dropId);
    if (error) {
      setLiked(liked);
      setCount(count);
      onChange(liked, count);
    }
    setBusy(false);
  };

  return (
    <span
      className={[
        'relative inline-flex items-center gap-1.5 rounded-full pl-2.5 pr-3 py-1.5 text-xs font-semibold transition-all',
        liked
          ? 'bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white shadow-sm shadow-purple-500/25'
          : 'bg-gray-50 dark:bg-gray-800/70 text-gray-500 dark:text-gray-400',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={toggle}
        aria-pressed={liked}
        aria-label={liked ? 'Unlike this memory' : 'Like this memory'}
        className="relative flex items-center focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none rounded-full"
      >
        <Heart key={popKey} size={14} className={`${liked ? 'fill-white' : ''} ${popKey > 0 ? 'animate-reaction-pop' : ''}`} aria-hidden="true" />
        {showFloat && (
          <Heart size={14} className="absolute left-0 top-0 fill-fuchsia-500 text-fuchsia-500 pointer-events-none animate-reaction-float" aria-hidden="true" />
        )}
      </button>
      <RecentLikersPopover contentType="drop" contentId={dropId} count={count} />
    </span>
  );
};
