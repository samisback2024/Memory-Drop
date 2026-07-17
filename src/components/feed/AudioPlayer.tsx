import React from 'react';
import { Mic } from 'lucide-react';
import { useInView } from '../../hooks/useInView';

interface AudioPlayerProps {
  src: string;
}

const OBSERVER_OPTIONS: IntersectionObserverInit = { rootMargin: '200px' };

// Same lazy-load convention as VideoPlayer — the <audio> source isn't set
// until it's about to be on screen.
export const AudioPlayer: React.FC<AudioPlayerProps> = ({ src }) => {
  const { ref, inView } = useInView(OBSERVER_OPTIONS);

  return (
    <div ref={ref} className="mx-4 mb-1 rounded-2xl bg-purple-50 dark:bg-purple-950/20 border border-purple-100/60 dark:border-purple-900/40 p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center flex-shrink-0">
        <Mic size={16} className="text-purple-500" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-500 mb-1">Voice memory</p>
        {inView ? (
          <audio src={src} controls preload="metadata" className="w-full h-9" />
        ) : (
          <div className="h-9" aria-hidden="true" />
        )}
      </div>
    </div>
  );
};
