import React from 'react';
import type { DropTab } from '../../types/feed';

interface DropTabsProps {
  active: DropTab;
  onChange: (tab: DropTab) => void;
}

const TABS: Array<{ key: DropTab; label: string }> = [
  { key: 'my_drops', label: 'My Drops' },
  { key: 'following', label: 'Following' },
  { key: 'public_drops', label: 'Public Drops' },
  { key: 'saved_to_unlock', label: 'Saved to Unlock' },
];

export const DropTabs: React.FC<DropTabsProps> = ({ active, onChange }) => (
  <div role="tablist" aria-label="Memory Drop feed" className="flex bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl rounded-xl p-1 gap-1 border border-white/60 dark:border-gray-800/60 shadow-sm overflow-x-auto">
    {TABS.map(tab => (
      <button
        key={tab.key}
        role="tab"
        aria-selected={active === tab.key}
        onClick={() => onChange(tab.key)}
        className={[
          'flex-1 py-2 px-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
          'focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none',
          active === tab.key
            ? 'bg-gradient-to-r from-purple-600 to-blue-500 text-white shadow-sm'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200',
        ].join(' ')}
      >
        {tab.label}
      </button>
    ))}
  </div>
);
