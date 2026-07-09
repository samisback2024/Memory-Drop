import React from 'react';
import { MOMENT_DURATIONS, type MomentDurationHours } from '../../types/moment';

interface MomentDurationSelectorProps {
  value: MomentDurationHours;
  onChange: (hours: MomentDurationHours) => void;
}

export const MomentDurationSelector: React.FC<MomentDurationSelectorProps> = ({ value, onChange }) => (
  <div role="radiogroup" aria-label="How long should this moment last?" className="flex gap-2">
    {MOMENT_DURATIONS.map(hours => {
      const selected = value === hours;
      return (
        <button
          key={hours}
          type="button"
          role="radio"
          aria-checked={selected}
          onClick={() => onChange(hours)}
          className={[
            'flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors',
            'focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none',
            selected
              ? 'bg-gradient-to-r from-purple-600 to-blue-500 border-transparent text-white shadow-sm'
              : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300',
          ].join(' ')}
        >
          {hours}h
        </button>
      );
    })}
  </div>
);
