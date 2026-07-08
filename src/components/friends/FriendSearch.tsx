import React, { useState } from 'react';
import { Search, UserPlus, UserCheck } from 'lucide-react';
import type { Profile } from '../../types';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { useFriends } from '../../hooks/useFriends';

interface FriendSearchProps {
  onStartChat?: (userId: string) => void;
}

export const FriendSearch: React.FC<FriendSearchProps> = ({ onStartChat }) => {
  const { searchResults, searching, searchUsers, isFollowing, followUser, unfollowUser } = useFriends();
  const [query, setQuery] = useState('');

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v);
    searchUsers(v);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          value={query}
          onChange={handleSearch}
          placeholder="Search by name or username..."
          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      {searching && (
        <div className="flex items-center justify-center py-4">
          <div className="w-5 h-5 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
        </div>
      )}

      {!searching && query && searchResults.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-4">No users found for "{query}"</p>
      )}

      <div className="flex flex-col gap-2">
        {searchResults.map(user => (
          <UserRow
            key={user.id}
            user={user}
            isFollowing={isFollowing(user.id)}
            onFollow={() => followUser(user.id)}
            onUnfollow={() => unfollowUser(user.id)}
            onChat={onStartChat ? () => onStartChat(user.id) : undefined}
          />
        ))}
      </div>
    </div>
  );
};

interface UserRowProps {
  user: Profile;
  isFollowing: boolean;
  onFollow: () => void;
  onUnfollow: () => void;
  onChat?: () => void;
}

export const UserRow: React.FC<UserRowProps> = ({
  user,
  isFollowing,
  onFollow,
  onUnfollow,
  onChat,
}) => {
  return (
    <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 p-3">
      <Avatar src={user.avatar_url} name={user.full_name} size="md" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-gray-900 truncate">{user.full_name}</p>
        <p className="text-xs text-gray-500">@{user.username}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {onChat && (
          <Button variant="outline" size="sm" onClick={onChat}>Chat</Button>
        )}
        <Button
          variant={isFollowing ? 'secondary' : 'primary'}
          size="sm"
          onClick={isFollowing ? onUnfollow : onFollow}
        >
          {isFollowing ? <><UserCheck size={13} /> Following</> : <><UserPlus size={13} /> Follow</>}
        </Button>
      </div>
    </div>
  );
};
