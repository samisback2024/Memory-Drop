import React, { useState } from 'react';

interface MomentBubbleProps {
  name: string;
  photoUrl: string | null;
  hasUnviewed: boolean;
  label: string;
  onClick: () => void;
}

const getInitials = (name: string): string => {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

// A tall, thin rounded-rectangle "story bar" (2:8 width:height) rather
// than Instagram's circular ring — same unviewed-signal gradient
// treatment as before, just a different silhouette. Not built on the
// shared Avatar component here: Avatar's size presets are all fixed
// squares, and this shape needs the photo to fill the bar edge-to-edge
// (object-cover) rather than sit as a small circle floating inside a
// much larger frame.
export const MomentBubble: React.FC<MomentBubbleProps> = ({ name, photoUrl, hasUnviewed, label, onClick }) => {
  const [imgError, setImgError] = useState(false);
  const showFallback = !photoUrl || imgError;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 w-11 flex-shrink-0 focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none rounded-2xl py-1"
    >
      <span
        className={[
          'w-8 h-32 rounded-2xl flex items-center justify-center p-[2.5px]',
          hasUnviewed ? 'bg-gradient-to-b from-purple-500 via-fuchsia-500 to-blue-500' : 'bg-gray-200 dark:bg-gray-700',
        ].join(' ')}
      >
        <span className="w-full h-full rounded-[13px] overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
          {!showFallback ? (
            <img
              src={photoUrl!}
              alt={name}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <span className="w-full h-full flex items-center justify-center text-xs font-semibold text-white bg-gradient-to-br from-purple-400 to-blue-400">
              {getInitials(name)}
            </span>
          )}
        </span>
      </span>
      <span className="text-xs text-gray-600 dark:text-gray-300 truncate w-full text-center">{label}</span>
    </button>
  );
};
