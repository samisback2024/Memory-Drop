import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import { UserCard } from './UserCard';
import { Button } from '../ui/Button';
import type { PendingRequest } from '../../types/social';

interface FriendRequestCardProps {
  user: PendingRequest;
  direction: 'received' | 'sent';
  onAccept?: () => Promise<void> | void;
  onDecline?: () => Promise<void> | void;
  onCancel?: () => Promise<void> | void;
}

// Requests get their own card rather than going through UserList/FollowButton:
// there's no follow state to toggle here, just a decision (accept/decline)
// or a way to undo one you sent (cancel) — different enough from every
// other social list to not force through the same shape.
export const FriendRequestCard: React.FC<FriendRequestCardProps> = ({ user, direction, onAccept, onDecline, onCancel }) => {
  const [busy, setBusy] = useState<'accept' | 'decline' | 'cancel' | null>(null);

  const run = async (action: 'accept' | 'decline' | 'cancel', fn?: () => Promise<void> | void) => {
    if (!fn) return;
    setBusy(action);
    await fn();
    setBusy(null);
  };

  return (
    <UserCard
      user={user}
      showMutuals
      actions={
        direction === 'received' ? (
          <>
            <Button size="sm" variant="primary" onClick={() => run('accept', onAccept)} loading={busy === 'accept'} disabled={busy !== null && busy !== 'accept'}>
              <Check size={14} aria-hidden="true" />
              Accept
            </Button>
            <Button size="sm" variant="outline" onClick={() => run('decline', onDecline)} loading={busy === 'decline'} disabled={busy !== null && busy !== 'decline'}>
              <X size={14} aria-hidden="true" />
              Decline
            </Button>
          </>
        ) : (
          <Button size="sm" variant="outline" onClick={() => run('cancel', onCancel)} loading={busy === 'cancel'}>
            Cancel
          </Button>
        )
      }
    />
  );
};
