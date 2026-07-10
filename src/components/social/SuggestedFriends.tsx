import React, { useEffect, useState } from 'react';
import { useSocial } from '../../hooks/useSocial';
import { UserList } from './UserList';
import type { SuggestedUser } from '../../types/social';

export const SuggestedFriends: React.FC = () => {
  const { getSuggestedFriends } = useSocial();
  const [users, setUsers] = useState<SuggestedUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getSuggestedFriends(10).then(data => { if (!cancelled) { setUsers(data); setLoading(false); } });
    return () => { cancelled = true; };
  }, [getSuggestedFriends]);

  return (
    <UserList
      users={users.map(u => ({ ...u, is_following: false, is_pending: false, is_followed_by: false }))}
      loading={loading}
      emptyVariant="suggestions"
      // mutual_count comes free with get_suggested_friends — showing it as
      // plain text here instead of the showMutuals prop avoids MutualFriends
      // firing two extra RPC calls per card in what can be a 10-row list.
      renderSubtitle={user => {
        const mutualCount = users.find(u => u.id === user.id)?.mutual_count ?? 0;
        return (
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            @{user.username}{mutualCount > 0 ? ` · ${mutualCount} mutual friend${mutualCount === 1 ? '' : 's'}` : ''}
          </p>
        );
      }}
    />
  );
};
