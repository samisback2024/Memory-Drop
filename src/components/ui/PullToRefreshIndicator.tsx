import React from 'react';
import { Loader2 } from 'lucide-react';

interface PullToRefreshIndicatorProps {
  pulling: boolean;
  distance: number;
  refreshing: boolean;
}

// The visual half of usePullToRefresh — extracted since FeedPage
// originated this exact markup and five more pages now reuse it
// verbatim rather than each hand-rolling their own copy.
export const PullToRefreshIndicator: React.FC<PullToRefreshIndicatorProps> = ({ pulling, distance, refreshing }) => {
  if (!pulling && !refreshing) return null;
  return (
    <div className="flex justify-center items-center overflow-hidden transition-[height]" style={{ height: refreshing ? 36 : distance }}>
      <Loader2
        size={20}
        className={refreshing ? 'text-purple-500 animate-spin' : 'text-purple-400'}
        style={{ opacity: refreshing ? 1 : Math.min(distance / 70, 1) }}
        aria-hidden="true"
      />
    </div>
  );
};
