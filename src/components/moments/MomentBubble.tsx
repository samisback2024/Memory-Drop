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

// A tall, thin capsule silhouette — a gradient "cap" over a lighter
// "body" with a seam between them, the same two-tone language this
// app's own Time Capsule art already uses (see avatarGenerator.ts's
// 'capsule' category). Moments are literally the thing this product is
// built around, so the tray that leads into them should look like one:
// the person's photo sits in a small circular window in the body,
// rather than filling the whole shape edge-to-edge.
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
        <span className="w-full h-full rounded-[13px] overflow-hidden flex flex-col shadow-inner">
          {/* Cap */}
          <span className="relative h-11 w-full flex-shrink-0 bg-gradient-to-br from-purple-600 to-blue-500">
            <span className="absolute inset-x-0 top-0 h-1/2 bg-white/15" aria-hidden="true" />
            <span className="absolute inset-x-0 bottom-0 h-[3px] bg-black/10" aria-hidden="true" />
          </span>
          {/* Body */}
          <span className="flex-1 w-full flex items-center justify-center bg-[#FAF7F2] dark:bg-gray-800">
            <span className="w-6 h-6 rounded-full overflow-hidden ring-2 ring-white dark:ring-gray-900 shadow-sm flex-shrink-0">
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
                <span className="w-full h-full flex items-center justify-center text-[9px] font-semibold text-white bg-gradient-to-br from-purple-400 to-blue-400">
                  {getInitials(name)}
                </span>
              )}
            </span>
          </span>
        </span>
      </span>
      <span className="text-xs text-gray-600 dark:text-gray-300 truncate w-full text-center">{label}</span>
    </button>
  );
};
