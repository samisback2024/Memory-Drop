import React, { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { useDrops } from '../../hooks/useDrops';

interface LikeButtonProps {
  dropId: string;
  isLiked: boolean;
  likeCount: number;
  onChange: (isLiked: boolean, likeCount: number) => void;
}

// Post-unlock only — there's no locked-state version of this button; a
// still-sealed drop uses InterestActions instead.
export const LikeButton: React.FC<LikeButtonProps> = ({ dropId, isLiked, likeCount, onChange }) => {
  const { likeDrop, unlikeDrop } = useDrops();
  const [liked, setLiked] = useState(isLiked);
  const [count, setCount] = useState(likeCount);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setLiked(isLiked); setCount(likeCount); }, [isLiked, likeCount]);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    const nextLiked = !liked;
    const nextCount = Math.max(0, count + (nextLiked ? 1 : -1));
    setLiked(nextLiked);
    setCount(nextCount);
    onChange(nextLiked, nextCount);

    const { error } = nextLiked ? await likeDrop(dropId) : await unlikeDrop(dropId);
    if (error) {
      setLiked(liked);
      setCount(count);
      onChange(liked, count);
    }
    setBusy(false);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={liked}
      aria-label={liked ? 'Unlike this memory' : 'Like this memory'}
      className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-pink-600 transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none rounded-lg px-1.5 py-1 -mx-1.5"
    >
      <Heart size={16} className={liked ? 'fill-pink-600 text-pink-600' : ''} aria-hidden="true" />
      {count > 0 ? count : ''}
    </button>
  );
};
