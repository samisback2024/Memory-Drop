import React from 'react';
import { Globe2, Users, Heart, Lock } from 'lucide-react';
import { MOMENT_PRIVACY_META, type MomentPrivacy } from '../../types/moment';

interface MomentPrivacySelectorProps {
  value: MomentPrivacy;
  onChange: (privacy: MomentPrivacy) => void;
}

const OPTIONS: { value: MomentPrivacy; icon: typeof Globe2 }[] = [
  { value: 'everyone', icon: Globe2 },
  { value: 'followers', icon: Users },
  { value: 'close_friends', icon: Heart },
  { value: 'only_me', icon: Lock },
];

export const MomentPrivacySelector: React.FC<MomentPrivacySelectorProps> = ({ value, onChange }) => (
  <div role="radiogroup" aria-label="Who can see this moment?" className="flex flex-col gap-2">
    {OPTIONS.map(({ value: option, icon: Icon }) => {
      const meta = MOMENT_PRIVACY_META[option];
      const selected = value === option;
      return (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={selected}
          onClick={() => onChange(option)}
          className={[
            'flex items-start gap-3 px-3.5 py-2.5 rounded-xl border text-left transition-colors',
            'focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none',
            selected ? 'bg-purple-50 border-purple-300' : 'bg-white border-gray-200 hover:border-gray-300',
          ].join(' ')}
        >
          <span
            className={[
              'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
              selected ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-500',
            ].join(' ')}
          >
            <Icon size={15} aria-hidden="true" />
          </span>
          <span className="flex-1 min-w-0">
            <span className={`block text-sm font-medium ${selected ? 'text-purple-900' : 'text-gray-900'}`}>
              {meta.label}
            </span>
            <span className="block text-xs text-gray-500 mt-0.5">{meta.description}</span>
          </span>
        </button>
      );
    })}
  </div>
);
