import React, { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { useFeed } from '../../hooks/useFeed';

interface LikeButtonProps {
  postId: string;
  isLiked: boolean;
  count: number;
  onChange?: (next: { isLiked: boolean; count: number }) => void;
}

export const LikeButton: React.FC<LikeButtonProps> = ({ postId, isLiked, count, onChange }) => {
  const { likePost, unlikePost } = useFeed();
  const [liked, setLiked] = useState(isLiked);
  const [displayCount, setDisplayCount] = useState(count);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setLiked(isLiked); }, [isLiked]);
  useEffect(() => { setDisplayCount(count); }, [count]);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    // Optimistic update: flip immediately, revert only if the write fails.
    const nextLiked = !liked;
    const nextCount = Math.max(0, displayCount + (nextLiked ? 1 : -1));
    setLiked(nextLiked);
    setDisplayCount(nextCount);
    onChange?.({ isLiked: nextLiked, count: nextCount });

    const { error } = nextLiked ? await likePost(postId) : await unlikePost(postId);
    if (error) {
      setLiked(liked);
      setDisplayCount(displayCount);
      onChange?.({ isLiked: liked, count: displayCount });
    }
    setBusy(false);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={liked}
      aria-label={liked ? 'Unlike' : 'Like'}
      className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-red-500 transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none rounded-lg px-1.5 py-1 -mx-1.5"
    >
      <Heart
        size={19}
        className={liked ? 'fill-red-500 text-red-500 scale-110 transition-transform' : 'transition-transform'}
        aria-hidden="true"
      />
      <span className={liked ? 'text-red-500' : ''}>{displayCount > 0 ? displayCount : ''}</span>
    </button>
  );
};
