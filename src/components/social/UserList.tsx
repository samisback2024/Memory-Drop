import React, { useEffect, useState } from 'react';
import { UserCard } from './UserCard';
import { OrbitButton } from './OrbitButton';
import { EmptySocialState } from './EmptySocialState';
import { Skeleton } from '../ui/Skeleton';
import type { SocialUserWithRelationship } from '../../types/social';

type RelationshipPatch = { isInOrbit?: boolean; isPending?: boolean; iBlocked?: boolean };

interface UserListProps {
  users: SocialUserWithRelationship[];
  loading: boolean;
  emptyVariant: 'followers' | 'following' | 'requests' | 'sent-requests' | 'search' | 'suggestions' | 'private';
  hideOrbitButton?: boolean;
  renderActions?: (user: SocialUserWithRelationship, update: (patch: RelationshipPatch) => void, remove: () => void) => React.ReactNode;
  renderSubtitle?: (user: SocialUserWithRelationship) => React.ReactNode;
}

export const UserListSkeleton: React.FC = () => (
  <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800" aria-hidden="true">
    {[0, 1, 2, 3].map(i => (
      <div key={i} className="flex items-center gap-3 py-3">
        <Skeleton className="w-10 h-10" rounded="full" />
        <div className="flex-1 flex flex-col gap-1.5">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-8 w-20" rounded="xl" />
      </div>
    ))}
  </div>
);

// The shared list-rendering shape behind search results, orbiters,
// orbiting, and suggested friends — each of those is just "fetch a
// SocialUserWithRelationship[] from a different RPC" wrapped around this.
// Holds its own copy of the rows so an OrbitButton's onChange (or a
// remove-from-orbit action) can update one row in place without the parent
// re-fetching the whole list.
export const UserList: React.FC<UserListProps> = ({
  users, loading, emptyVariant, hideOrbitButton = false, renderActions, renderSubtitle,
}) => {
  const [rows, setRows] = useState(users);

  useEffect(() => setRows(users), [users]);

  const updateRow = (id: string, patch: RelationshipPatch) => {
    setRows(prev => prev.map(u => (u.id === id ? {
      ...u,
      is_in_orbit: patch.isInOrbit ?? u.is_in_orbit,
      is_orbit_pending: patch.isPending ?? u.is_orbit_pending,
    } : u)));
  };

  const removeRow = (id: string) => setRows(prev => prev.filter(u => u.id !== id));

  if (loading) return <UserListSkeleton />;
  if (rows.length === 0) return <EmptySocialState variant={emptyVariant} />;

  return (
    <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
      {rows.map(u => (
        <UserCard
          key={u.id}
          user={u}
          subtitle={renderSubtitle?.(u)}
          actions={
            <>
              {!hideOrbitButton && (
                <OrbitButton
                  targetId={u.id}
                  isPrivate={u.is_private}
                  isInOrbit={u.is_in_orbit}
                  isPending={u.is_orbit_pending}
                  isOrbitingYou={u.is_orbiting_you}
                  onChange={patch => updateRow(u.id, patch)}
                  size="sm"
                />
              )}
              {renderActions?.(u, patch => updateRow(u.id, patch), () => removeRow(u.id))}
            </>
          }
        />
      ))}
    </div>
  );
};
