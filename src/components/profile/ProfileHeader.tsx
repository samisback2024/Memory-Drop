import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Edit3, Lock, Unlock, Flame, Package, Award, UserPlus, UserMinus } from 'lucide-react';
import type { Profile } from '../../types';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Badge, BADGE_LABELS } from '../ui/Badge';
import { useAuth } from '../../hooks/useAuth';
import { useFriends } from '../../hooks/useFriends';

interface ProfileHeaderProps {
  profile: Profile;
  isOwnProfile: boolean;
  capsuleCount?: number;
  unlockedCount?: number;
  lockedCount?: number;
  onEditAvatar?: () => void;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  profile,
  isOwnProfile,
  capsuleCount = 0,
  unlockedCount = 0,
  lockedCount = 0,
  onEditAvatar,
}) => {
  const navigate = useNavigate();
  const { isDemo } = useAuth();
  const { isFollowing, followUser, unfollowUser, sendFollowRequest } = useFriends();
  const following = isFollowing(profile.id);

  const handleFollow = async () => {
    if (following) {
      await unfollowUser(profile.id);
    } else if (profile.is_private && !isDemo) {
      await sendFollowRequest(profile.id);
    } else {
      await followUser(profile.id);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Cover gradient */}
      <div className="h-24 bg-gradient-to-r from-purple-600 to-blue-500" />

      <div className="px-5 pb-5">
        {/* Avatar */}
        <div className="flex items-end justify-between -mt-10 mb-4">
          <div className="relative">
            <Avatar
              src={profile.avatar_url}
              name={profile.full_name}
              size="2xl"
              ring
              ringColor="ring-white"
              className="border-4 border-white shadow-md"
            />
            {isOwnProfile && onEditAvatar && (
              <button
                onClick={onEditAvatar}
                className="absolute bottom-1 right-1 w-7 h-7 rounded-full bg-black flex items-center justify-center hover:bg-gray-800 transition-colors border-2 border-white"
              >
                <Camera size={12} className="text-white" />
              </button>
            )}
          </div>
          {isOwnProfile ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/settings')}
            >
              <Edit3 size={14} />
              Edit Profile
            </Button>
          ) : (
            <Button
              variant={following ? 'secondary' : 'primary'}
              size="sm"
              onClick={handleFollow}
            >
              {following ? <><UserMinus size={14} /> Following</> : <><UserPlus size={14} /> Follow</>}
            </Button>
          )}
        </div>

        {/* Name + bio */}
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-gray-900">{profile.full_name}</h2>
            {profile.is_private && (
              <Lock size={14} className="text-gray-400" />
            )}
          </div>
          <p className="text-sm text-gray-500">@{profile.username}</p>
          {profile.bio && (
            <p className="text-sm text-gray-700 mt-2 leading-relaxed">{profile.bio}</p>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 py-3 border-t border-b border-gray-100 mb-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <Flame size={14} className="text-orange-500" />
              <span className="font-bold text-gray-900">{profile.streak}</span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">Streak</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <Package size={14} className="text-purple-500" />
              <span className="font-bold text-gray-900">{capsuleCount}</span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">Capsules</p>
          </div>
          <div className="text-center">
            <span className="font-bold text-gray-900">{profile.follower_count}</span>
            <p className="text-xs text-gray-500 mt-0.5">Followers</p>
          </div>
          <div className="text-center">
            <span className="font-bold text-gray-900">{profile.following_count}</span>
            <p className="text-xs text-gray-500 mt-0.5">Following</p>
          </div>
        </div>

        {/* Capsule unlocked/locked mini stats */}
        <div className="flex gap-3 mb-4">
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <Unlock size={12} className="text-green-500" />
            <span>{unlockedCount} unlocked</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <Lock size={12} className="text-purple-500" />
            <span>{lockedCount} locked</span>
          </div>
        </div>

        {/* Badges */}
        {profile.badges.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <Award size={12} className="text-gray-400 self-center" />
            {profile.badges.map(badge => {
              const info = BADGE_LABELS[badge];
              return info ? (
                <Badge key={badge} variant={info.variant} size="sm">{info.label}</Badge>
              ) : null;
            })}
          </div>
        )}
      </div>
    </div>
  );
};
