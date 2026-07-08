import React from 'react';
import { MOOD_META, type Mood } from '../../types/feed';

interface MoodPickerProps {
  value: Mood | null;
  onChange: (mood: Mood | null) => void;
}

const MOODS = Object.keys(MOOD_META) as Mood[];

export const MoodPicker: React.FC<MoodPickerProps> = ({ value, onChange }) => (
  <div role="radiogroup" aria-label="Mood" className="flex flex-wrap gap-1.5">
    {MOODS.map(mood => {
      const meta = MOOD_META[mood];
      const selected = value === mood;
      return (
        <button
          key={mood}
          type="button"
          role="radio"
          aria-checked={selected}
          onClick={() => onChange(selected ? null : mood)}
          className={[
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
            'focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none',
            selected ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300',
          ].join(' ')}
        >
          <span aria-hidden="true">{meta.emoji}</span>
          {meta.label}
        </button>
      );
    })}
  </div>
);
