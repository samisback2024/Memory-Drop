import React, { useCallback, useState } from 'react';
import { Smile } from 'lucide-react';
import { useDismissableMenu } from '../../hooks/useDismissableMenu';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
}

// A curated set rather than a full unicode emoji database/picker library —
// covers the common cases for a caption without pulling in a large
// dependency or building an exhaustive category-tabbed picker.
const EMOJIS = [
  '😀', '😂', '🥰', '😍', '🤔', '😎', '🥳', '😢', '😭', '😡',
  '👍', '👎', '❤️', '🔥', '✨', '🎉', '🙏', '💯', '👏', '😅',
  '😉', '😴', '🤩', '😇', '🫶', '💪', '🌟', '🌈', '☀️', '🌙',
];

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelect }) => {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismissableMenu<HTMLDivElement>(open, close);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        aria-label="Add emoji"
        aria-haspopup="true"
        aria-expanded={open}
        className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none"
      >
        <Smile size={18} aria-hidden="true" />
      </button>
      {open && (
        <div className="absolute right-0 bottom-10 w-60 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl z-30 p-2 grid grid-cols-6 gap-0.5 animate-fade-in">
          {EMOJIS.map(emoji => (
            <button
              key={emoji}
              type="button"
              onClick={() => { onSelect(emoji); setOpen(false); }}
              className="text-xl leading-none hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg p-1.5 transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
