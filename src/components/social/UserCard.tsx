import React from 'react';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { MutualFriends } from './MutualFriends';
import type { SocialUser } from '../../types/social';

interface UserCardProps {
  user: SocialUser;
  actions?: React.ReactNode;
  showMutuals?: boolean;
  subtitle?: React.ReactNode;
}

// The shared row layout behind every social list — search results,
// orbiters/orbiting, suggestions, and (via OrbitRequestCard) requests.
// `actions` is a slot so each context can drop in whatever's relevant
// (OrbitButton, Accept/Decline, RelationshipMenu) without UserCard needing
// to know about any of them.
export const UserCard: React.FC<UserCardProps> = ({ user, actions, showMutuals = false, subtitle }) => {
  const displayName = user.display_name || user.username;

  return (
    <div className="flex items-center gap-3 py-3">
      <Link to={`/u/${user.username}`} className="flex items-center gap-3 min-w-0 flex-1">
        <Avatar src={user.profile_photo_url} name={displayName} size="md" />
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{displayName}</p>
            {user.is_private && <Lock size={11} className="text-gray-400 dark:text-gray-500 flex-shrink-0" aria-label="Private account" />}
          </div>
          {subtitle ?? <p className="text-xs text-gray-500 dark:text-gray-400 truncate">@{user.username}</p>}
          {showMutuals && <MutualFriends targetId={user.id} />}
        </div>
      </Link>
      {actions && <div className="flex-shrink-0 flex items-center gap-2">{actions}</div>}
    </div>
  );
};
