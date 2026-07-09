import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, BookHeart, Lock, Globe2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useMoments } from '../hooks/useMoments';
import { useMemories } from '../hooks/useMemories';
import { ProfileHeader } from '../components/profile/ProfileHeader';
import { ProfileHeaderSkeleton } from '../components/profile/ProfileHeaderSkeleton';
import { ProfileCompletionBar } from '../components/profile/ProfileCompletionBar';
import { ProfileStatsCard } from '../components/profile/ProfileStatsCard';
import { BadgesAndAchievements, BadgesAndAchievementsSkeleton } from '../components/profile/BadgesAndAchievements';
import { MomentViewer } from '../components/moments/MomentViewer';
import { CapsuleArchive } from '../components/capsules/CapsuleArchive';
import { GridView } from '../components/memories/GridView';
import { ListView } from '../components/memories/ListView';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { getProfileCompletion } from '../lib/profile';
import { EMPTY_MEMORY_FILTERS, type Memory } from '../types/memory';

export const ProfilePage: React.FC = () => {
  const { profile, loading, refreshUser } = useAuth();
  const { getUserMoments } = useMoments();
  const { getMemories } = useMemories();
  const completion = useMemo(() => (profile ? getProfileCompletion(profile) : null), [profile]);
  const [hasActiveMoments, setHasActiveMoments] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [recentMemories, setRecentMemories] = useState<Memory[]>([]);
  const [lockedDrops, setLockedDrops] = useState<Memory[]>([]);
  const [publicMemories, setPublicMemories] = useState<Memory[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    getUserMoments(profile.id).then(data => setHasActiveMoments(data.length > 0));
  }, [profile, getUserMoments]);

  useEffect(() => {
    if (!profile) return;
    setRecentLoading(true);
    Promise.all([
      getMemories({ ...EMPTY_MEMORY_FILTERS, lockStatus: 'unlocked' }, 'newest', 9, 0),
      getMemories({ ...EMPTY_MEMORY_FILTERS, lockStatus: 'locked' }, 'newest', 20, 0),
      getMemories({ ...EMPTY_MEMORY_FILTERS, lockStatus: 'unlocked', visibility: 'public' }, 'newest', 9, 0),
    ]).then(([recent, locked, pub]) => {
      setRecentMemories(recent);
      setLockedDrops(locked.filter(m => m.memory_type === 'drop').slice(0, 5));
      setPublicMemories(pub);
      setRecentLoading(false);
    });
  }, [profile, getMemories]);

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
      <ProfileHeader
        profile={profile}
        isOwnProfile
        hasActiveMoments={hasActiveMoments}
        onViewMoments={() => setViewerOpen(true)}
      />
      {completion && <ProfileCompletionBar completion={completion} />}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
          <BookHeart size={15} className="text-purple-500" aria-hidden="true" />
          Memory Stats
        </h2>
        <ProfileStatsCard />
      </div>

      <BadgesAndAchievements />

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
            <BookHeart size={15} className="text-purple-500" aria-hidden="true" />
            Recent Memories
          </h2>
          <Link to="/memories" className="text-xs font-medium text-purple-600 hover:text-purple-700">See all</Link>
        </div>
        {recentLoading ? (
          <div className="grid grid-cols-3 gap-1.5">{[0, 1, 2].map(i => <div key={i} className="aspect-square rounded-xl bg-gray-50 animate-pulse" />)}</div>
        ) : recentMemories.length === 0 ? (
          <EmptyState icon={BookHeart} title="No memories yet" description="Unlocked Drops, Capsules, and expired Moments will show up here." />
        ) : (
          <GridView memories={recentMemories} />
        )}
      </div>

      {lockedDrops.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
            <Lock size={15} className="text-purple-500" aria-hidden="true" />
            Locked Drops
          </h2>
          <ListView memories={lockedDrops} />
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
          <Globe2 size={15} className="text-purple-500" aria-hidden="true" />
          Public Memories
        </h2>
        {recentLoading ? (
          <div className="grid grid-cols-3 gap-1.5">{[0, 1, 2].map(i => <div key={i} className="aspect-square rounded-xl bg-gray-50 animate-pulse" />)}</div>
        ) : publicMemories.length === 0 ? (
          <EmptyState icon={Globe2} title="Nothing public yet" description="Memories set to Public will show up here once unlocked." />
        ) : (
          <GridView memories={publicMemories} />
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
          <Clock size={15} className="text-purple-500" aria-hidden="true" />
          Time Capsules
        </h2>
        <CapsuleArchive userId={profile.id} isOwnArchive />
      </div>

      {viewerOpen && <MomentViewer authorUserId={profile.id} onClose={() => setViewerOpen(false)} />}
    </div>
  );
};
