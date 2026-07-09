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
// still-sealed drop uses InterestActions instead. Phase 10d added the
// animated pop + floating heart on like (undo/unlike already worked —
// the toggle itself hasn't changed).
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
    <span className="relative inline-flex items-center gap-1.5 text-sm font-medium text-gray-600">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={liked}
        aria-label={liked ? 'Unlike this memory' : 'Like this memory'}
        className="relative flex items-center hover:text-pink-600 transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none rounded-lg px-1.5 py-1 -mx-1.5"
      >
        <Heart key={popKey} size={16} className={`${liked ? 'fill-pink-600 text-pink-600' : ''} ${popKey > 0 ? 'animate-reaction-pop' : ''}`} aria-hidden="true" />
        {showFloat && (
          <Heart size={14} className="absolute left-0 top-0 fill-pink-500 text-pink-500 pointer-events-none animate-reaction-float" aria-hidden="true" />
        )}
      </button>
      <RecentLikersPopover contentType="drop" contentId={dropId} count={count} />
    </span>
  );
};
