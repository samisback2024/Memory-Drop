import React from 'react';
import { getYearsActive } from '../../lib/profile';

interface StatsRowProps {
  createdAt: string;
}

// Followers/Following/Capsules/Stories/Memory Streak aren't real yet —
// those need tables that land in Phase 3+ (friend system) and later
// (capsules, stories, streaks). Shown as honest zeros rather than faked
// numbers, so the row is ready to wire up without a UI change once the
// data exists. Years Active is the one real value here — it's derived
// straight from created_at, no placeholder needed.
export const StatsRow: React.FC<StatsRowProps> = React.memo(({ createdAt }) => {
  const stats = [
    { key: 'followers', label: 'Followers', value: 0 },
    { key: 'following', label: 'Following', value: 0 },
    { key: 'capsules', label: 'Capsules', value: 0 },
    { key: 'stories', label: 'Stories', value: 0 },
    { key: 'streak', label: 'Memory Streak', value: 0 },
    { key: 'years', label: 'Years Active', value: getYearsActive(createdAt) },
  ];

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-y-3 gap-x-2 py-3 border-t border-b border-gray-100">
      {stats.map(({ key, label, value }) => (
        <div key={key} className="text-center">
          <p className="font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500 mt-0.5">{label}</p>
        </div>
      ))}
    </div>
  );
});

StatsRow.displayName = 'StatsRow';
