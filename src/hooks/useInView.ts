import { useEffect, useRef, useState } from 'react';

// Backs both VideoPlayer (don't load a video's source until it's about to
// be on screen) and InfiniteLoader (fire "load more" when the sentinel at
// the bottom of the list scrolls into view). Callers should pass a stable
// `options` object (module-level constant or useMemo) — a fresh object
// literal every render would re-subscribe the observer every render.
export const useInView = (options?: IntersectionObserverInit) => {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), options);
    observer.observe(el);
    return () => observer.disconnect();
  }, [options]);

  return { ref, inView };
};
