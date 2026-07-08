import React from 'react';
import { UserList } from './UserList';
import type { SocialUserWithRelationship } from '../../types/social';

interface UserSearchResultsProps {
  users: SocialUserWithRelationship[];
  loading: boolean;
}

export const UserSearchResults: React.FC<UserSearchResultsProps> = ({ users, loading }) => (
  <UserList users={users} loading={loading} emptyVariant="search" />
);
