import React from 'react';
import { getYearsActive } from '../../lib/profile';
import { SocialStats } from '../social/SocialStats';

interface StatsRowProps {
  profileId: string;
  username: string;
  createdAt: string;
}

// Followers/Following are real now (Phase 3) — rendered by SocialStats.
// Capsules/Stories/Memory Streak still don't have tables behind them, so
// they stay honest zeros here until later phases. Years Active is derived
// straight from created_at, no placeholder needed.
export const StatsRow: React.FC<StatsRowProps> = React.memo(({ profileId, username, createdAt }) => {
  const placeholders = [
    { key: 'capsules', label: 'Capsules', value: 0 },
    { key: 'stories', label: 'Stories', value: 0 },
    { key: 'streak', label: 'Memory Streak', value: 0 },
    { key: 'years', label: 'Years Active', value: getYearsActive(createdAt) },
  ];

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-y-3 gap-x-2 py-3 border-t border-b border-gray-100">
      <SocialStats profileId={profileId} username={username} />
      {placeholders.map(({ key, label, value }) => (
        <div key={key} className="text-center">
          <p className="font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500 mt-0.5">{label}</p>
        </div>
      ))}
    </div>
  );
});

StatsRow.displayName = 'StatsRow';
