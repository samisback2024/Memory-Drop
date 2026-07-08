import React from 'react';

// Followers/Following/Capsules/Stories aren't real yet — those tables land
// in Phase 3+ (friend system) and later (capsules, stories). Shown as
// honest zeros rather than faked numbers, so the row is ready to wire up
// without a UI change once the data exists.
const STATS = [
  { key: 'followers', label: 'Followers' },
  { key: 'following', label: 'Following' },
  { key: 'capsules', label: 'Capsules' },
  { key: 'stories', label: 'Stories' },
] as const;

export const StatsRow: React.FC = () => (
  <div className="grid grid-cols-4 gap-2 py-3 border-t border-b border-gray-100">
    {STATS.map(({ key, label }) => (
      <div key={key} className="text-center">
        <p className="font-bold text-gray-900">0</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      </div>
    ))}
  </div>
);
