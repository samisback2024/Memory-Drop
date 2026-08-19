import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSocial } from '../hooks/useSocial';
import { UserList } from '../components/social/UserList';
import { SuggestedFriends } from '../components/social/SuggestedFriends';
import { PullToRefreshIndicator } from '../components/ui/PullToRefreshIndicator';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import type { SocialUserWithRelationship } from '../types/social';

// "Friends" = people you orbit who orbit you back — computed client-side
// by filtering your own in-orbit list on is_orbiting_you, rather than a
// dedicated RPC, since get_orbiting already returns that flag per row.
export const FriendsPage: React.FC = () => {
  const { profile } = useAuth();
  const { getOrbiting } = useSocial();
  const [friends, setFriends] = useState<SocialUserWithRelationship[]>([]);
  const [loading, setLoading] = useState(true);

  // Ref-based cancel guard (not a local closure flag) so the same
  // function can be called both from the mount effect below and from
  // pull-to-refresh without two separate copies of this fetch existing.
  const cancelledRef = React.useRef(false);
  const loadFriends = useCallback(() => {
    if (!profile) return Promise.resolve();
    cancelledRef.current = false;
    return getOrbiting(profile.id).then(data => {
      if (cancelledRef.current) return;
      setFriends(data.filter(u => u.is_orbiting_you));
      setLoading(false);
    });
  }, [profile, getOrbiting]);

  useEffect(() => {
    loadFriends();
    return () => { cancelledRef.current = true; };
  }, [loadFriends]);

  const { pulling, distance, refreshing } = usePullToRefresh(loadFriends, true);

  return (
    <div className="flex flex-col gap-4">
      <PullToRefreshIndicator pulling={pulling} distance={distance} refreshing={refreshing} />
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Friends</h1>
        <nav className="flex items-center gap-2 text-sm">
          <Link to="/orbiting-you" className="text-purple-600 hover:text-purple-700 font-medium">Orbiting You</Link>
          <span className="text-gray-300">·</span>
          <Link to="/in-orbit" className="text-purple-600 hover:text-purple-700 font-medium">Your Orbit</Link>
          <span className="text-gray-300">·</span>
          <Link to="/friends/orbit-requests" className="text-purple-600 hover:text-purple-700 font-medium">Orbit requests</Link>
        </nav>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
        <UserList users={friends} loading={loading} emptyVariant="followers" />
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Suggested for you</h2>
        <SuggestedFriends />
      </div>
    </div>
  );
};
