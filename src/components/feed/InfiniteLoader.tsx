import React, { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useInView } from '../../hooks/useInView';

interface InfiniteLoaderProps {
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
}

const OBSERVER_OPTIONS: IntersectionObserverInit = { rootMargin: '400px' };

// A sentinel div at the bottom of the list — fires onLoadMore once it
// scrolls near the viewport (400px early, so the next page is ready before
// the user hits the literal bottom) rather than a "Load more" button.
export const InfiniteLoader: React.FC<InfiniteLoaderProps> = ({ hasMore, loading, onLoadMore }) => {
  const { ref, inView } = useInView(OBSERVER_OPTIONS);

  useEffect(() => {
    if (inView && hasMore && !loading) onLoadMore();
  }, [inView, hasMore, loading, onLoadMore]);

  if (!hasMore) return null;

  return (
    <div ref={ref} className="flex justify-center py-6" aria-live="polite">
      {loading && <Loader2 size={20} className="text-gray-400 animate-spin" aria-label="Loading more posts" />}
    </div>
  );
};
