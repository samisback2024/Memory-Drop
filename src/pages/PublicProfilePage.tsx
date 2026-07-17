import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  UserX, Clock, Globe2, Users, UserPlus, Pin, Send, Activity as ActivityIcon,
  Lock, Unlock, Archive, Bookmark, Eye, KeyRound, MessageCircle, Share2, Sparkles, Star, Zap, Wand2,
} from 'lucide-react';
import { PROFILE_STAT_META, type ProfileStatKey } from '../types/settings';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useSocial } from '../hooks/useSocial';
import { useMoments } from '../hooks/useMoments';
import { useMemories } from '../hooks/useMemories';
import { useMessages } from '../hooks/useMessages';
import { useToast } from '../hooks/useToast';
import { PublicPageHeader } from '../components/layout/PublicPageHeader';
import { ProfileHeader } from '../components/profile/ProfileHeader';
import { ProfileHeaderSkeleton } from '../components/profile/ProfileHeaderSkeleton';
import { ActivityTimeline } from '../components/profile/ActivityTimeline';
import { MomentViewer } from '../components/moments/MomentViewer';
import { CapsuleArchive } from '../components/capsules/CapsuleArchive';
import { GridView } from '../components/memories/GridView';
import { OrbitButton } from '../components/social/OrbitButton';
import { RelationshipMenu } from '../components/social/RelationshipMenu';
import { MutualFriends } from '../components/social/MutualFriends';
import { ShareProfileModal } from '../components/social/ShareProfileModal';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { EMPTY_MEMORY_FILTERS, type Memory, type PinnedMemory, type PublicStats } from '../types/memory';
import type { Relationship } from '../types/social';
import { SparkleDrop } from '../components/icons/SparkleDrop';

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

// Icons matching ProfileStatsCard's own choices, for the same stats
// shown here only once their owner opts each one into public
// visibility (Settings → Privacy → Profile stats visibility).
// A Lucide icon's own type doesn't fit SparkleDrop (Memory Drop's own
// custom icon, not from Lucide) — this shape is the actual common
// surface every icon used below needs, Lucide or custom.
type IconComponent = React.ComponentType<{ size?: number | string; className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;

const EXTRA_STAT_ICONS: Record<ProfileStatKey, IconComponent> = {
  total_drops: Globe2,
  locked_items: Lock,
  unlocked_items: Unlock,
  expired_moments: Archive,
  saved_to_unlock: Bookmark,
  public_drops: Globe2,
  total_views: Eye,
  total_unlocks: KeyRound,
  total_reactions: SparkleDrop,
  total_comments: MessageCircle,
  total_moments: Sparkles,
  interested_received: Star,
  cant_wait_received: Zap,
  good_vibes_received: Wand2,
};

type FetchState = 'loading' | 'ready' | 'not_found' | 'error';

export const PublicProfilePage: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getRelationship } = useSocial();
  const { getUserMoments } = useMoments();
  const { getPublicStats, getMemories, getPinnedMemories } = useMemories();
  const { getOrCreateConversation } = useMessages();
  const { showToast } = useToast();
  const [data, setData] = useState<PublicProfile | null>(null);
  const [relationship, setRelationship] = useState<Relationship | null>(null);
  const [state, setState] = useState<FetchState>('loading');
  const [hasActiveMoments, setHasActiveMoments] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [publicStats, setPublicStats] = useState<PublicStats | null>(null);
  const [publicPool, setPublicPool] = useState<Memory[]>([]);
  const [pinned, setPinned] = useState<PinnedMemory[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [messaging, setMessaging] = useState(false);
  const [statsRefreshKey, setStatsRefreshKey] = useState(0);

  const handleMessage = async () => {
    if (!data || messaging) return;
    setMessaging(true);
    const { error, conversationId } = await getOrCreateConversation(data.id);
    setMessaging(false);
    if (error || !conversationId) { showToast(error || 'Could not start a conversation.', 'error'); return; }
    navigate(`/messages/${conversationId}`);
  };

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
    // Independent reads, none depending on another's result — fired
    // together rather than one `await` at a time (was previously
    // sequential: relationship, then moments, then stats/memories/pins).
    await Promise.all([
      user && !profile.is_own_profile ? getRelationship(profile.id).then(setRelationship) : Promise.resolve(),
      user ? getUserMoments(profile.id).then(moments => setHasActiveMoments(moments.length > 0)) : Promise.resolve(),
      user ? getPublicStats(profile.id).then(setPublicStats) : Promise.resolve(),
      user ? getMemories({ ...EMPTY_MEMORY_FILTERS, lockStatus: 'unlocked', visibility: 'public' }, 'newest', 30, 0, profile.id).then(setPublicPool) : Promise.resolve(),
      user ? getPinnedMemories(profile.id).then(setPinned) : Promise.resolve(),
    ]);
    setState('ready');
  }, [username, user, getRelationship, getUserMoments, getPublicStats, getMemories, getPinnedMemories]);

  useEffect(() => { load(); }, [load]);

  const publicMemories = publicPool.slice(0, 9);
  const publicCapsules = publicPool.filter(m => m.memory_type === 'capsule').slice(0, 6);
  const publicMoments = publicPool.filter(m => m.memory_type === 'moment').slice(0, 6);
  const pinnedMemories = pinned.filter(m => m.memory_type !== 'drop');
  const pinnedDrops = pinned.filter(m => m.memory_type === 'drop');

  const bioHidden = Boolean(data?.is_private && !data.is_own_profile && !relationship?.is_in_orbit);

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicPageHeader />

      <main className="max-w-2xl mx-auto px-4 py-6">
        {state === 'loading' && (
          <div className="flex flex-col gap-4">
            <ProfileHeaderSkeleton />
          </div>
        )}

        {state === 'not_found' && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
            <EmptyState icon={UserX} title="User not found" description={`No account with the username @${username}.`} />
          </div>
        )}

        {state === 'error' && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
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
              statsRefreshKey={statsRefreshKey}
            />

            {!data.is_own_profile && user && relationship && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4 flex items-center justify-between gap-3">
                <MutualFriends targetId={data.id} />
                <div className="flex items-center gap-2 ml-auto">
                  <OrbitButton
                    targetId={data.id}
                    isPrivate={data.is_private}
                    isInOrbit={relationship.is_in_orbit}
                    isPending={relationship.is_orbit_pending}
                    isOrbitingYou={relationship.is_orbiting_you}
                    iBlocked={relationship.i_blocked}
                    blockedMe={relationship.blocked_me}
                    onChange={patch => {
                      setRelationship(r => (r ? { ...r, is_in_orbit: patch.isInOrbit ?? r.is_in_orbit, is_orbit_pending: patch.isPending ?? r.is_orbit_pending, i_blocked: patch.iBlocked ?? r.i_blocked } : r));
                      // The orbiting/in-orbit counts shown in StatsRow and
                      // below are fetched once on mount — an orbit action
                      // doesn't touch either count's own state, so without
                      // this they'd stay stale until a full page reload.
                      setStatsRefreshKey(k => k + 1);
                      getPublicStats(data.id).then(setPublicStats);
                    }}
                  />
                  {relationship.is_in_orbit && relationship.is_orbiting_you && !relationship.blocked_me && (
                    <button
                      type="button"
                      onClick={handleMessage}
                      disabled={messaging}
                      aria-label={`Message ${data.display_name || data.username}`}
                      className="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none disabled:opacity-50"
                    >
                      <MessageCircle size={16} aria-hidden="true" />
                    </button>
                  )}
                  {!relationship.blocked_me && (
                    <button
                      type="button"
                      onClick={() => setShareOpen(true)}
                      aria-label={`Share ${data.display_name || data.username}'s profile`}
                      className="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none"
                    >
                      <Share2 size={16} aria-hidden="true" />
                    </button>
                  )}
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

            {user && publicStats && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  <div className="flex flex-col items-center gap-1 rounded-xl bg-gray-50 dark:bg-gray-800 py-3 px-1 text-center">
                    <Globe2 size={14} className="text-purple-500" aria-hidden="true" />
                    <span className="text-base font-bold text-gray-900 dark:text-gray-100">{publicStats.public_memories_count}</span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">Public memories</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 rounded-xl bg-gray-50 dark:bg-gray-800 py-3 px-1 text-center">
                    <Users size={14} className="text-purple-500" aria-hidden="true" />
                    <span className="text-base font-bold text-gray-900 dark:text-gray-100">{publicStats.orbiting_count}</span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">Orbiting You</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 rounded-xl bg-gray-50 dark:bg-gray-800 py-3 px-1 text-center">
                    <UserPlus size={14} className="text-purple-500" aria-hidden="true" />
                    <span className="text-base font-bold text-gray-900 dark:text-gray-100">{publicStats.in_orbit_count}</span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">In Orbit</span>
                  </div>
                  {(Object.keys(PROFILE_STAT_META) as ProfileStatKey[])
                    .filter(key => publicStats[key] !== null)
                    .map(key => {
                      const Icon = EXTRA_STAT_ICONS[key];
                      return (
                        <div key={key} className="flex flex-col items-center gap-1 rounded-xl bg-gray-50 dark:bg-gray-800 py-3 px-1 text-center">
                          <Icon size={14} className="text-purple-500" aria-hidden="true" />
                          <span className="text-base font-bold text-gray-900 dark:text-gray-100">{publicStats[key]}</span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">{PROFILE_STAT_META[key].label}</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {user && pinnedMemories.length > 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4 flex flex-col gap-3">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                  <Pin size={15} className="text-purple-500" aria-hidden="true" />
                  Pinned Memories
                </h2>
                <GridView memories={pinnedMemories} />
              </div>
            )}

            {user && pinnedDrops.length > 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4 flex flex-col gap-3">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                  <Pin size={15} className="text-purple-500" aria-hidden="true" />
                  Pinned Drops
                </h2>
                <GridView memories={pinnedDrops} />
              </div>
            )}

            {user && publicMemories.length > 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4 flex flex-col gap-3">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                  <Globe2 size={15} className="text-purple-500" aria-hidden="true" />
                  Public Memories
                </h2>
                <GridView memories={publicMemories} />
              </div>
            )}

            {user && publicCapsules.length > 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4 flex flex-col gap-3">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                  <Clock size={15} className="text-purple-500" aria-hidden="true" />
                  Public Capsules
                </h2>
                <GridView memories={publicCapsules} />
              </div>
            )}

            {user && publicMoments.length > 0 && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4 flex flex-col gap-3">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                  <Send size={15} className="text-purple-500" aria-hidden="true" />
                  Public Moments
                </h2>
                <GridView memories={publicMoments} />
              </div>
            )}

            {user && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4 flex flex-col gap-3">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                  <ActivityIcon size={15} className="text-purple-500" aria-hidden="true" />
                  Activity
                </h2>
                <ActivityTimeline userId={data.id} />
              </div>
            )}

            {user && (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4 flex flex-col gap-3">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                  <Clock size={15} className="text-purple-500" aria-hidden="true" />
                  Time Capsules
                </h2>
                <CapsuleArchive userId={data.id} isOwnArchive={data.is_own_profile} />
              </div>
            )}

            {viewerOpen && <MomentViewer authorUserId={data.id} onClose={() => setViewerOpen(false)} />}

            <ShareProfileModal
              isOpen={shareOpen}
              onClose={() => setShareOpen(false)}
              username={data.username}
              displayName={data.display_name || data.username}
            />
          </div>
        )}
      </main>
    </div>
  );
};
