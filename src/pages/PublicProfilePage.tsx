import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { UserX } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useSocial } from '../hooks/useSocial';
import { useMoments } from '../hooks/useMoments';
import { PublicPageHeader } from '../components/layout/PublicPageHeader';
import { ProfileHeader } from '../components/profile/ProfileHeader';
import { ProfileHeaderSkeleton } from '../components/profile/ProfileHeaderSkeleton';
import { BadgesAndAchievements, BadgesAndAchievementsSkeleton } from '../components/profile/BadgesAndAchievements';
import { MomentViewer } from '../components/moments/MomentViewer';
import { FollowButton } from '../components/social/FollowButton';
import { RelationshipMenu } from '../components/social/RelationshipMenu';
import { MutualFriends } from '../components/social/MutualFriends';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import type { Relationship } from '../types/social';

interface PublicProfile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  profile_photo_url: string | null;
  cover_photo_url: string | null;
  website: string | null;
  location: string | null;
  pronouns: string | null;
  is_private: boolean;
  profile_completed: boolean;
  created_at: string;
  is_own_profile: boolean;
}

type FetchState = 'loading' | 'ready' | 'not_found' | 'error';

export const PublicProfilePage: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const { user } = useAuth();
  const { getRelationship } = useSocial();
  const { getUserMoments } = useMoments();
  const [data, setData] = useState<PublicProfile | null>(null);
  const [relationship, setRelationship] = useState<Relationship | null>(null);
  const [state, setState] = useState<FetchState>('loading');
  const [hasActiveMoments, setHasActiveMoments] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  const load = useCallback(async () => {
    if (!username) return;
    setState('loading');
    setRelationship(null);

    const { data: rows, error } = await supabase.rpc('get_profile_by_username', { p_username: username });
    if (error) {
      setState('error');
      return;
    }
    if (!rows || rows.length === 0) {
      setState('not_found');
      return;
    }
    const profile = rows[0] as PublicProfile;
    setData(profile);
    if (user && !profile.is_own_profile) {
      const rel = await getRelationship(profile.id);
      setRelationship(rel);
    }
    if (user) {
      const moments = await getUserMoments(profile.id);
      setHasActiveMoments(moments.length > 0);
    }
    setState('ready');
  }, [username, user, getRelationship, getUserMoments]);

  useEffect(() => { load(); }, [load]);

  const bioHidden = Boolean(data?.is_private && !data.is_own_profile && !relationship?.is_following);

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicPageHeader />

      <main className="max-w-2xl mx-auto px-4 py-6">
        {state === 'loading' && (
          <div className="flex flex-col gap-4">
            <ProfileHeaderSkeleton />
            <BadgesAndAchievementsSkeleton />
          </div>
        )}

        {state === 'not_found' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <EmptyState icon={UserX} title="User not found" description={`No account with the username @${username}.`} />
          </div>
        )}

        {state === 'error' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <ErrorState title="Couldn't load this profile" description="Check your connection and try again." onRetry={load} />
          </div>
        )}

        {state === 'ready' && data && (
          <div className="flex flex-col gap-4">
            <ProfileHeader
              profile={data}
              isOwnProfile={data.is_own_profile}
              bioHidden={bioHidden}
              hasActiveMoments={hasActiveMoments}
              onViewMoments={() => setViewerOpen(true)}
            />

            {!data.is_own_profile && user && relationship && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between gap-3">
                <MutualFriends targetId={data.id} />
                <div className="flex items-center gap-2 ml-auto">
                  <FollowButton
                    targetId={data.id}
                    isPrivate={data.is_private}
                    isFollowing={relationship.is_following}
                    isPending={relationship.is_pending}
                    isFollowedBy={relationship.is_followed_by}
                    iBlocked={relationship.i_blocked}
                    blockedMe={relationship.blocked_me}
                    onChange={patch => setRelationship(r => (r ? { ...r, is_following: patch.isFollowing ?? r.is_following, is_pending: patch.isPending ?? r.is_pending, i_blocked: patch.iBlocked ?? r.i_blocked } : r))}
                  />
                  {!relationship.blocked_me && (
                    <RelationshipMenu
                      targetId={data.id}
                      isMuted={relationship.i_muted}
                      isRestricted={relationship.i_restricted}
                      isBlocked={relationship.i_blocked}
                      onChange={patch => { if (patch.isBlocked) load(); }}
                    />
                  )}
                </div>
              </div>
            )}

            <BadgesAndAchievements />

            {viewerOpen && <MomentViewer authorUserId={data.id} onClose={() => setViewerOpen(false)} />}
          </div>
        )}
      </main>
    </div>
  );
};
