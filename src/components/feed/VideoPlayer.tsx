import React from 'react';
import { useInView } from '../../hooks/useInView';

interface VideoPlayerProps {
  src: string;
}

const OBSERVER_OPTIONS: IntersectionObserverInit = { rootMargin: '200px' };

// The <video> element's `src` isn't set until the player scrolls near the
// viewport — a feed with several video posts loading all of them at once
// would be a real bandwidth hit. `preload="metadata"` on top of that means
// even the in-view one only pulls enough to show the first frame and
// duration until the user actually presses play.
export const VideoPlayer: React.FC<VideoPlayerProps> = ({ src }) => {
  const { ref, inView } = useInView(OBSERVER_OPTIONS);

  return (
    <div ref={ref} className="bg-black">
      {inView ? (
        <video src={src} controls preload="metadata" playsInline className="w-full max-h-[560px]" />
      ) : (
        <div className="w-full aspect-video" aria-hidden="true" />
      )}
    </div>
  );
};
