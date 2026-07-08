import React from 'react';
import type { FeedTab } from '../../types/feed';

interface FeedTabsProps {
  active: FeedTab;
  onChange: (tab: FeedTab) => void;
}

const TABS: Array<{ key: FeedTab; label: string }> = [
  { key: 'following', label: 'Following' },
  { key: 'discover', label: 'Discover' },
  { key: 'trending', label: 'Trending' },
  { key: 'recent', label: 'Recent' },
];

export const FeedTabs: React.FC<FeedTabsProps> = ({ active, onChange }) => (
  <div role="tablist" aria-label="Feed" className="flex bg-gray-100 rounded-xl p-1 gap-1">
    {TABS.map(tab => (
      <button
        key={tab.key}
        role="tab"
        aria-selected={active === tab.key}
        onClick={() => onChange(tab.key)}
        className={[
          'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
          'focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none',
          active === tab.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
        ].join(' ')}
      >
        {tab.label}
      </button>
    ))}
  </div>
);
