import React from 'react';
import { UserX } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';

interface UserNotFoundStateProps {
  username?: string | null;
}

export const UserNotFoundState: React.FC<UserNotFoundStateProps> = ({ username }) => (
  <EmptyState icon={UserX} title="User not found" description={`No account with the username @${username}.`} />
);
