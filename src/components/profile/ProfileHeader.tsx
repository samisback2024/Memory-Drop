import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Edit3, CalendarDays } from 'lucide-react';
import type { Profile } from '../../types';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { StatsRow } from './StatsRow';
import { formatDate } from '../../utils/date';

interface ProfileHeaderProps {
  profile: Pick<Profile, 'username' | 'display_name' | 'bio' | 'profile_photo_url' | 'is_private' | 'created_at'>;
  isOwnProfile: boolean;
  bioHidden?: boolean;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({ profile, isOwnProfile, bioHidden = false }) => {
  const navigate = useNavigate();
  const displayName = profile.display_name || profile.username || 'Memory Drop user';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="h-24 bg-gradient-to-r from-purple-600 to-blue-500" />

      <div className="px-5 pb-5">
        <div className="flex items-end justify-between -mt-10 mb-4">
          <Avatar
            src={profile.profile_photo_url}
            name={displayName}
            size="2xl"
            ring
            ringColor="ring-white"
            className="border-4 border-white shadow-md"
          />
          {isOwnProfile && (
            <Button variant="outline" size="sm" onClick={() => navigate('/profile/edit')}>
              <Edit3 size={14} />
              Edit Profile
            </Button>
          )}
        </div>

        <div className="mb-3">
          <div className="flex items-center gap-1.5">
            <h1 className="text-xl font-bold text-gray-900">{displayName}</h1>
            {profile.is_private && <Lock size={14} className="text-gray-400" />}
          </div>
          {profile.username && <p className="text-sm text-gray-500">@{profile.username}</p>}
          {profile.created_at && (
            <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
              <CalendarDays size={12} />
              Joined {formatDate(profile.created_at)}
            </p>
          )}
        </div>

        {bioHidden ? (
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
            <Lock size={13} />
            This account is private.
          </div>
        ) : profile.bio ? (
          <p className="text-sm text-gray-700 leading-relaxed mb-1 whitespace-pre-wrap">{profile.bio}</p>
        ) : isOwnProfile ? (
          <p className="text-sm text-gray-400 italic mb-1">Add a bio to tell people about yourself.</p>
        ) : null}

        <StatsRow />
      </div>
    </div>
  );
};
