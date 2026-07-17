import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Edit3, CalendarDays, MapPin, Link2, CheckCircle2 } from 'lucide-react';
import type { Profile } from '../../types';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { StatsRow } from './StatsRow';
import { formatDate } from '../../utils/date';
import { displayWebsite } from '../../lib/validators';
import { getProfileCompletion } from '../../lib/profile';

type HeaderProfile = Pick<
  Profile,
  | 'id' | 'username' | 'display_name' | 'bio' | 'profile_photo_url' | 'cover_photo_url'
  | 'website' | 'location' | 'pronouns' | 'is_private' | 'profile_completed' | 'created_at'
>;

interface ProfileHeaderProps {
  profile: HeaderProfile;
  isOwnProfile: boolean;
  bioHidden?: boolean;
  hasActiveMoments?: boolean;
  onViewMoments?: () => void;
  statsRefreshKey?: number;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = React.memo(({ profile, isOwnProfile, bioHidden = false, hasActiveMoments = false, onViewMoments, statsRefreshKey }) => {
  const navigate = useNavigate();
  const displayName = profile.display_name || profile.username || 'Memory Drop user';
  const completion = isOwnProfile ? getProfileCompletion(profile) : null;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
      <div className="relative h-32 sm:h-40 md:h-48 bg-gradient-to-r from-purple-600 to-blue-500">
        {profile.cover_photo_url && (
          <img
            src={profile.cover_photo_url}
            alt=""
            className="w-full h-full object-cover"
            loading="eager"
            decoding="async"
          />
        )}
        {isOwnProfile && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/profile/edit')}
            className="absolute top-3 right-3 shadow-sm"
          >
            <Edit3 size={14} aria-hidden="true" />
            Edit Profile
          </Button>
        )}

        {/* Fully on the cover photo, centered, its bottom edge flush with
            the cover's own bottom edge — not straddling the seam. */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
          {hasActiveMoments ? (
            <button
              type="button"
              onClick={onViewMoments}
              aria-label={isOwnProfile ? 'View your moments' : `View ${displayName}'s moments`}
              className="rounded-2xl p-[3px] bg-gradient-to-br from-purple-500 via-fuchsia-500 to-blue-500 focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none"
            >
              <Avatar
                src={profile.profile_photo_url}
                name={displayName}
                size="2xl"
                shape="square"
                className="border-4 border-white dark:border-gray-900 shadow-md"
              />
            </button>
          ) : (
            <Avatar
              src={profile.profile_photo_url}
              name={displayName}
              size="2xl"
              shape="square"
              ring
              ringColor="ring-white"
              className="border-4 border-white dark:border-gray-900 shadow-md"
            />
          )}
        </div>
      </div>

      <div className="px-5 pt-3 pb-5">
        <div className="mb-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{displayName}</h1>
            {profile.pronouns && <span className="text-sm text-gray-400 dark:text-gray-500">({profile.pronouns})</span>}
          </div>
          {profile.username && <p className="text-sm text-gray-500 dark:text-gray-400">@{profile.username}</p>}

          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <Badge
              variant={profile.is_private ? 'default' : 'success'}
              icon={<Lock size={11} aria-hidden="true" />}
            >
              {profile.is_private ? 'Private' : 'Public'}
            </Badge>
            {completion && (
              <Badge
                variant={completion.percentage >= 100 ? 'success' : 'purple'}
                icon={completion.percentage >= 100 ? <CheckCircle2 size={11} aria-hidden="true" /> : undefined}
              >
                {completion.percentage >= 100 ? 'Profile complete' : `${completion.percentage}% complete`}
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-gray-400 dark:text-gray-500">
            {profile.created_at && (
              <span className="flex items-center gap-1">
                <CalendarDays size={12} aria-hidden="true" />
                Joined {formatDate(profile.created_at)}
              </span>
            )}
            {profile.location && !bioHidden && (
              <span className="flex items-center gap-1">
                <MapPin size={12} aria-hidden="true" />
                {profile.location}
              </span>
            )}
            {profile.website && !bioHidden && (
              <a
                href={profile.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
              >
                <Link2 size={12} aria-hidden="true" />
                {displayWebsite(profile.website)}
              </a>
            )}
          </div>
        </div>

        {bioHidden ? (
          <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500 mb-1">
            <Lock size={13} aria-hidden="true" />
            This account is private.
          </div>
        ) : profile.bio ? (
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-1 whitespace-pre-wrap">{profile.bio}</p>
        ) : isOwnProfile ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 italic mb-1">Add a bio to tell people about yourself.</p>
        ) : null}

        {profile.username && <StatsRow profileId={profile.id} username={profile.username} isOwnProfile={isOwnProfile} refreshKey={statsRefreshKey} />}
      </div>
    </div>
  );
});

ProfileHeader.displayName = 'ProfileHeader';
