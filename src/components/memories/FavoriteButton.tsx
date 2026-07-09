import React, { useState } from 'react';
import { Heart } from 'lucide-react';
import { useMemories } from '../../hooks/useMemories';
import type { MemorySourceType } from '../../types/memory';

interface FavoriteButtonProps {
  memoryType: MemorySourceType;
  memoryId: string;
  isFavorited: boolean;
  onChange?: (isFavorited: boolean) => void;
  size?: number;
}

export const FavoriteButton: React.FC<FavoriteButtonProps> = ({ memoryType, memoryId, isFavorited, onChange, size = 16 }) => {
  const { favoriteMemory, unfavoriteMemory } = useMemories();
  const [favorited, setFavorited] = useState(isFavorited);
  const [busy, setBusy] = useState(false);

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    const next = !favorited;
    setFavorited(next);
    onChange?.(next);
    const { error } = next ? await favoriteMemory(memoryType, memoryId) : await unfavoriteMemory(memoryType, memoryId);
    if (error) { setFavorited(!next); onChange?.(!next); }
    setBusy(false);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={favorited}
      aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
      className="p-1.5 rounded-full bg-black/30 backdrop-blur-sm hover:bg-black/50 transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
    >
      <Heart size={size} className={favorited ? 'fill-pink-500 text-pink-500' : 'text-white'} aria-hidden="true" />
    </button>
  );
};
