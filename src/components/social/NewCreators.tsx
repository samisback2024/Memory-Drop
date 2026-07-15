import React, { useEffect, useState } from 'react';
import { useSocial } from '../../hooks/useSocial';
import { UserList } from './UserList';
import type { SuggestedUser } from '../../types/social';

// Explore's "New Creators" tab (Phase 10g) — get_new_creators returns
// the same SuggestedUser shape SuggestedFriends does, real relationship
// fields included (Phase 20), so no client-side patching needed.
export const NewCreators: React.FC = () => {
  const { getNewCreators } = useSocial();
  const [users, setUsers] = useState<SuggestedUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getNewCreators(20).then(data => { if (!cancelled) { setUsers(data); setLoading(false); } });
    return () => { cancelled = true; };
  }, [getNewCreators]);

  return (
    <UserList
      users={users}
      loading={loading}
      emptyVariant="suggestions"
      renderSubtitle={user => <p className="text-xs text-gray-500 dark:text-gray-400 truncate">@{user.username}</p>}
    />
  );
};
