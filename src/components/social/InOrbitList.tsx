import React, { useEffect, useState } from 'react';
import { useSocial } from '../../hooks/useSocial';
import { UserList } from './UserList';
import { EmptySocialState } from './EmptySocialState';
import { RelationshipMenu } from './RelationshipMenu';
import type { SocialUserWithRelationship } from '../../types/social';

interface InOrbitListProps {
  profileId: string;
  isOwnProfile: boolean;
  canView: boolean;
}

export const InOrbitList: React.FC<InOrbitListProps> = ({ profileId, isOwnProfile, canView }) => {
  const { getOrbiting } = useSocial();
  const [users, setUsers] = useState<SocialUserWithRelationship[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canView) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    getOrbiting(profileId).then(data => { if (!cancelled) { setUsers(data); setLoading(false); } });
    return () => { cancelled = true; };
  }, [profileId, canView, getOrbiting]);

  if (!canView) return <EmptySocialState variant="private" />;

  return (
    <UserList
      users={users}
      loading={loading}
      emptyVariant="following"
      renderActions={isOwnProfile ? (user, _update, remove) => (
        <RelationshipMenu
          targetId={user.id}
          isMuted={user.is_muted ?? false}
          isRestricted={user.is_restricted ?? false}
          isBlocked={user.i_blocked ?? false}
          onChange={patch => { if (patch.isBlocked) remove(); }}
        />
      ) : undefined}
    />
  );
};
