import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// iOS/Android's edge-swipe-back gesture: touch starting within a thin
// strip of the left screen edge, dragged right past a threshold, goes
// back — same convention as the native back gesture on both platforms.
// Only arms from that edge strip specifically (not "swipe anywhere"), so
// it never fights a component's own horizontal swipe (e.g. MediaViewer's
// photo carousel) — those can still opt all the way out by putting
// `data-no-swipe-back` on their own container, which this checks before
// arming at all.
const EDGE_ZONE_PX = 24;
const DISMISS_DRAG_PX = 90;

export const useSwipeBack = () => {
  const navigate = useNavigate();
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef<number | null>(null);
  const armed = useRef(false);

  const onTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const target = e.target as HTMLElement;
    if (touch.clientX > EDGE_ZONE_PX || target.closest('[data-no-swipe-back]')) {
      armed.current = false;
      return;
    }
    armed.current = true;
    startX.current = touch.clientX;
    setDragging(true);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!armed.current || startX.current === null) return;
    const delta = e.touches[0].clientX - startX.current;
    if (delta > 0) setDragX(delta);
  };

  const onTouchEnd = () => {
    if (!armed.current) return;
    armed.current = false;
    startX.current = null;
    setDragging(false);
    if (dragX > DISMISS_DRAG_PX) navigate(-1);
    setDragX(0);
  };

  return { dragX, dragging, onTouchStart, onTouchMove, onTouchEnd };
};
