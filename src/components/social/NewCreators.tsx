import React, { useEffect, useState } from 'react';
import { useSocial } from '../../hooks/useSocial';
import { UserList } from './UserList';
import type { SuggestedUser } from '../../types/social';

// Explore's "New Creators" tab (Phase 10g) — mirrors SuggestedFriends'
// exact shape-adaptation pattern (get_new_creators returns the same
// SuggestedUser shape, no relationship fields, so UserList needs the
// same false-filled patch).
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
      users={users.map(u => ({ ...u, is_following: false, is_pending: false, is_followed_by: false }))}
      loading={loading}
      emptyVariant="suggestions"
      renderSubtitle={user => <p className="text-xs text-gray-500 truncate">@{user.username}</p>}
    />
  );
};
