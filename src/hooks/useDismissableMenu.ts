import { useEffect, useRef } from 'react';

// A production audit found this exact open/outside-click/Escape pattern
// implemented independently in 9 different components (Navbar,
// MobileNav, RelationshipMenu, DropCard, EmojiPicker,
// RecentLikersPopover, CapsuleCard, StickerPicker, NotificationBell) —
// same ~15 lines of boilerplate copy-pasted nine times, two of which
// (RecentLikersPopover, CapsuleCard) had silently dropped the Escape
// handler along the way. One shared hook, both bugs fixed as a side
// effect of not hand-copying the listener setup anymore.
export const useDismissableMenu = <T extends HTMLElement = HTMLDivElement>(
  open: boolean,
  onDismiss: () => void,
  options: { escape?: boolean } = {},
) => {
  const ref = useRef<T>(null);
  const escape = options.escape ?? true;

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onDismiss();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (escape && e.key === 'Escape') onDismiss();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onDismiss, escape]);

  return ref;
};
