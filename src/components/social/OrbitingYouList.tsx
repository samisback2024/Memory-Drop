import React, { useEffect, useState } from 'react';
import { useSocial } from '../../hooks/useSocial';
import { UserList } from './UserList';
import { EmptySocialState } from './EmptySocialState';
import { RelationshipMenu } from './RelationshipMenu';
import type { SocialUserWithRelationship } from '../../types/social';

interface OrbitingYouListProps {
  profileId: string;
  isOwnProfile: boolean;
  canView: boolean;
}

export const OrbitingYouList: React.FC<OrbitingYouListProps> = ({ profileId, isOwnProfile, canView }) => {
  const { getOrbiters, removeFromOrbit } = useSocial();
  const [users, setUsers] = useState<SocialUserWithRelationship[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canView) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    getOrbiters(profileId).then(data => { if (!cancelled) { setUsers(data); setLoading(false); } });
    return () => { cancelled = true; };
  }, [profileId, canView, getOrbiters]);

  if (!canView) return <EmptySocialState variant="private" />;

  return (
    <UserList
      users={users}
      loading={loading}
      emptyVariant="followers"
      renderActions={isOwnProfile ? (user, _update, remove) => (
        <RelationshipMenu
          targetId={user.id}
          isMuted={user.is_muted ?? false}
          isRestricted={user.is_restricted ?? false}
          isBlocked={user.i_blocked ?? false}
          showRemoveFromOrbit
          onRemoveFromOrbit={async () => {
            const { error } = await removeFromOrbit(user.id);
            if (!error) remove();
          }}
          onChange={patch => { if (patch.isBlocked) remove(); }}
        />
      ) : undefined}
    />
  );
};
