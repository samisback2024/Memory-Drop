import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { ProfileHeader } from '../components/profile/ProfileHeader';
import { ProfileCompletionBar } from '../components/profile/ProfileCompletionBar';
import { BadgesAndAchievements } from '../components/profile/BadgesAndAchievements';
import { getProfileCompletion } from '../lib/profile';

export const ProfilePage: React.FC = () => {
  const { profile } = useAuth();

  if (!profile) return null;

  const completion = getProfileCompletion(profile);

  return (
    <div className="flex flex-col gap-4">
      <ProfileHeader profile={profile} isOwnProfile />
      <ProfileCompletionBar completion={completion} />
      <BadgesAndAchievements />
    </div>
  );
};
