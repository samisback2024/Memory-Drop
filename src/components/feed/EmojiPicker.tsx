import React, { useEffect, useRef, useState } from 'react';
import { Smile } from 'lucide-react';

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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        aria-label="Add emoji"
        aria-haspopup="true"
        aria-expanded={open}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none"
      >
        <Smile size={18} aria-hidden="true" />
      </button>
      {open && (
        <div className="absolute right-0 bottom-10 w-60 bg-white border border-gray-100 rounded-2xl shadow-xl z-30 p-2 grid grid-cols-6 gap-0.5 animate-fade-in">
          {EMOJIS.map(emoji => (
            <button
              key={emoji}
              type="button"
              onClick={() => { onSelect(emoji); setOpen(false); }}
              className="text-xl leading-none hover:bg-gray-100 rounded-lg p-1.5 transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
