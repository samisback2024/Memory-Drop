import React, { useEffect, useState } from 'react';
import { UserCard } from './UserCard';
import { FollowButton } from './FollowButton';
import { EmptySocialState } from './EmptySocialState';
import { Skeleton } from '../ui/Skeleton';
import type { SocialUserWithRelationship } from '../../types/social';

type RelationshipPatch = { isFollowing?: boolean; isPending?: boolean; iBlocked?: boolean };

interface UserListProps {
  users: SocialUserWithRelationship[];
  loading: boolean;
  emptyVariant: 'followers' | 'following' | 'requests' | 'sent-requests' | 'search' | 'suggestions' | 'private';
  hideFollowButton?: boolean;
  renderActions?: (user: SocialUserWithRelationship, update: (patch: RelationshipPatch) => void, remove: () => void) => React.ReactNode;
  renderSubtitle?: (user: SocialUserWithRelationship) => React.ReactNode;
}

export const UserListSkeleton: React.FC = () => (
  <div className="flex flex-col divide-y divide-gray-100" aria-hidden="true">
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

// The shared list-rendering shape behind search results, followers,
// following, and suggested friends — each of those is just "fetch a
// SocialUserWithRelationship[] from a different RPC" wrapped around this.
// Holds its own copy of the rows so a FollowButton's onChange (or a
// remove-follower action) can update one row in place without the parent
// re-fetching the whole list.
export const UserList: React.FC<UserListProps> = ({
  users, loading, emptyVariant, hideFollowButton = false, renderActions, renderSubtitle,
}) => {
  const [rows, setRows] = useState(users);

  useEffect(() => setRows(users), [users]);

  const updateRow = (id: string, patch: RelationshipPatch) => {
    setRows(prev => prev.map(u => (u.id === id ? {
      ...u,
      is_following: patch.isFollowing ?? u.is_following,
      is_pending: patch.isPending ?? u.is_pending,
    } : u)));
  };

  const removeRow = (id: string) => setRows(prev => prev.filter(u => u.id !== id));

  if (loading) return <UserListSkeleton />;
  if (rows.length === 0) return <EmptySocialState variant={emptyVariant} />;

  return (
    <div className="flex flex-col divide-y divide-gray-100">
      {rows.map(u => (
        <UserCard
          key={u.id}
          user={u}
          subtitle={renderSubtitle?.(u)}
          actions={
            <>
              {!hideFollowButton && (
                <FollowButton
                  targetId={u.id}
                  isPrivate={u.is_private}
                  isFollowing={u.is_following}
                  isPending={u.is_pending}
                  isFollowedBy={u.is_followed_by}
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
