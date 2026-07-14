import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSocial } from '../../hooks/useSocial';
import { Skeleton } from '../ui/Skeleton';

interface SocialStatsProps {
  profileId: string;
  username: string;
}

// The two real cells in the stats row — Orbiting You and In Orbit now have
// an actual table behind them, unlike Capsules/Stories/Memory Streak
// (still placeholders; see StatsRow, which renders this alongside those).
export const SocialStats: React.FC<SocialStatsProps> = ({ profileId, username }) => {
  const { getSocialCounts } = useSocial();
  const [counts, setCounts] = useState<{ orbiting_count: number; in_orbit_count: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSocialCounts(profileId).then(c => { if (!cancelled) setCounts(c); });
    return () => { cancelled = true; };
  }, [profileId, getSocialCounts]);

  return (
    <>
      <Link to={`/u/${username}/orbiting-you`} className="text-center hover:opacity-70 transition-opacity">
        {counts ? <p className="font-bold text-gray-900 dark:text-gray-100">{counts.orbiting_count}</p> : <Skeleton className="h-4 w-6 mx-auto" />}
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Orbiting You</p>
      </Link>
      <Link to={`/u/${username}/in-orbit`} className="text-center hover:opacity-70 transition-opacity">
        {counts ? <p className="font-bold text-gray-900 dark:text-gray-100">{counts.in_orbit_count}</p> : <Skeleton className="h-4 w-6 mx-auto" />}
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">In Orbit</p>
      </Link>
    </>
  );
};
