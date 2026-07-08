import React, { useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { ProfileHeader } from '../components/profile/ProfileHeader';
import { ProfileHeaderSkeleton } from '../components/profile/ProfileHeaderSkeleton';
import { ProfileCompletionBar } from '../components/profile/ProfileCompletionBar';
import { BadgesAndAchievements, BadgesAndAchievementsSkeleton } from '../components/profile/BadgesAndAchievements';
import { ErrorState } from '../components/ui/ErrorState';
import { getProfileCompletion } from '../lib/profile';

export const ProfilePage: React.FC = () => {
  const { profile, loading, refreshUser } = useAuth();
  const completion = useMemo(() => (profile ? getProfileCompletion(profile) : null), [profile]);

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <ProfileHeaderSkeleton />
        <BadgesAndAchievementsSkeleton />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <ErrorState
          title="Couldn't load your profile"
          description="Something went wrong loading your profile data."
          onRetry={refreshUser}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ProfileHeader profile={profile} isOwnProfile />
      {completion && <ProfileCompletionBar completion={completion} />}
      <BadgesAndAchievements />
    </div>
  );
};
