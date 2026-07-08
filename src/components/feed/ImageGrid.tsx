import React from 'react';
import type { PostImage } from '../../types/feed';

interface ImageGridProps {
  images: PostImage[];
}

// A plain CSS-grid layout rather than a swipeable carousel — simplest thing
// that handles 1-10 images reasonably without adding a carousel dependency.
// A single image keeps its natural aspect ratio (capped height); 2+ images
// go into fixed-aspect tiles so the grid stays visually even, with a "+N"
// overlay on the last visible tile past four images.
export const ImageGrid: React.FC<ImageGridProps> = ({ images }) => {
  if (images.length === 0) return null;
  const sorted = [...images].sort((a, b) => a.position - b.position);

  if (sorted.length === 1) {
    return (
      <img
        src={sorted[0].url}
        alt=""
        loading="lazy"
        decoding="async"
        className="w-full max-h-[560px] object-cover"
      />
    );
  }

  const visible = sorted.slice(0, 4);
  const overflow = sorted.length - visible.length;
  const gridCols = visible.length === 3 ? 'grid-cols-3' : 'grid-cols-2';

  return (
    <div className={`grid ${gridCols} gap-0.5`}>
      {visible.map((img, i) => {
        const isLastWithOverflow = i === visible.length - 1 && overflow > 0;
        return (
          <div key={img.url} className="relative aspect-square overflow-hidden">
            <img src={img.url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
            {isLastWithOverflow && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <span className="text-white text-lg font-semibold">+{overflow}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
