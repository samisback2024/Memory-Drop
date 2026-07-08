import { useEffect, useRef, useState } from 'react';

interface PullState {
  pulling: boolean;
  distance: number;
  refreshing: boolean;
}

const THRESHOLD = 70;
const MAX_PULL = 100;

// Touch-only (mouse users get InfiniteLoader/tab-switch refetches instead).
// Only arms when the page is already scrolled to the very top, matching
// the native pull-to-refresh gesture apps are expected to have. `onRefresh`
// should be a useCallback from the caller — its identity is a dependency
// here, and a fresh function every render would tear down and resubscribe
// the touch listeners on every render, not just on drag.
export const usePullToRefresh = (onRefresh: () => Promise<void> | void, enabled = true) => {
  const [state, setState] = useState<PullState>({ pulling: false, distance: 0, refreshing: false });
  const startY = useRef<number | null>(null);
  const distanceRef = useRef(0);
  const refreshingRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0 && !refreshingRef.current) startY.current = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (startY.current === null) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0 && window.scrollY === 0) {
        const clamped = Math.min(delta, MAX_PULL);
        distanceRef.current = clamped;
        setState({ pulling: true, distance: clamped, refreshing: false });
      }
    };

    const handleTouchEnd = async () => {
      if (startY.current === null) return;
      startY.current = null;
      const shouldRefresh = distanceRef.current > THRESHOLD && !refreshingRef.current;
      distanceRef.current = 0;

      if (shouldRefresh) {
        refreshingRef.current = true;
        setState({ pulling: false, distance: 0, refreshing: true });
        await onRefresh();
        refreshingRef.current = false;
      }
      setState({ pulling: false, distance: 0, refreshing: false });
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, onRefresh]);

  return state;
};
