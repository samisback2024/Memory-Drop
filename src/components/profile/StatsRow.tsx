import React, { useEffect, useState } from 'react';
import { useMemories } from '../../hooks/useMemories';
import { SocialStats } from '../social/SocialStats';

interface StatsRowProps {
  profileId: string;
  username: string;
  isOwnProfile: boolean;
  refreshKey?: number;
}

// Orbiting You/In Orbit are real (Phase 3), rendered by SocialStats.
// Moments is real too (Phase 17) — the caller's own true count via
// get_memory_stats, or, for someone else's profile, get_public_stats'
// privacy-gated total_moments (null, and hidden here, unless that person
// opted it into their public stats in Settings → Privacy). Capsules is
// still a placeholder — no table wired up for it yet. Memory Streak and
// Years Active were removed outright, not just unwired: neither ever
// mapped to a real, meaningful count.
export const StatsRow: React.FC<StatsRowProps> = React.memo(({ profileId, username, isOwnProfile, refreshKey }) => {
  const { getMemoryStats, getPublicStats } = useMemories();
  const [moments, setMoments] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (isOwnProfile ? getMemoryStats() : getPublicStats(profileId)).then(stats => {
      if (!cancelled) setMoments(stats?.total_moments ?? null);
    });
    return () => { cancelled = true; };
  }, [profileId, isOwnProfile, getMemoryStats, getPublicStats, refreshKey]);

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-y-3 gap-x-2 py-3 border-t border-b border-gray-100 dark:border-gray-800">
      <SocialStats profileId={profileId} username={username} refreshKey={refreshKey} />
      <div className="text-center">
        <p className="font-bold text-gray-900 dark:text-gray-100">0</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Capsules</p>
      </div>
      {moments !== null && (
        <div className="text-center">
          <p className="font-bold text-gray-900 dark:text-gray-100">{moments}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Moments</p>
        </div>
      )}
    </div>
  );
});

StatsRow.displayName = 'StatsRow';
