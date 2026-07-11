import React, { useCallback, useState } from 'react';
import { Sticker as StickerIcon } from 'lucide-react';
import { STICKERS } from '../../types/message';
import { useDismissableMenu } from '../../hooks/useDismissableMenu';

interface StickerPickerProps {
  onSelect: (emoji: string) => void;
}

// Same popover shell/pattern as EmojiPicker (Phase 10d) — a curated set,
// not a full sticker-pack library or external asset pipeline. "Stickers"
// here means these render large with no bubble background once sent
// (see MessageBubble), not a different underlying send mechanism.
export const StickerPicker: React.FC<StickerPickerProps> = ({ onSelect }) => {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismissableMenu<HTMLDivElement>(open, close);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        aria-label="Send a sticker"
        aria-haspopup="true"
        aria-expanded={open}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none"
      >
        <StickerIcon size={18} aria-hidden="true" />
      </button>
      {open && (
        <div className="absolute left-0 bottom-10 w-64 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl z-30 p-2 grid grid-cols-5 gap-1 animate-fade-in">
          {STICKERS.map(emoji => (
            <button
              key={emoji}
              type="button"
              onClick={() => { onSelect(emoji); setOpen(false); }}
              className="text-3xl leading-none hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl p-2 transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
