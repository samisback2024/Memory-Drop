import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Clock, Lock, Hourglass, Unlock, Archive as ArchiveIcon, LayoutList, Users, Globe2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useCapsules } from '../hooks/useCapsules';
import { useMemories } from '../hooks/useMemories';
import { Button } from '../components/ui/Button';
import { CapsuleArchive } from '../components/capsules/CapsuleArchive';
import { CapsuleTimeline } from '../components/capsules/CapsuleTimeline';
import { CapsuleWizard } from '../components/capsules/CapsuleWizard';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { EMPTY_CAPSULE_FILTERS, type Capsule } from '../types/capsule';

const SOON_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const PAGE_SIZE = 15;

type DiscoveryTab = 'in_orbit' | 'public';

interface SectionProps {
  title: string;
  icon: typeof Lock;
  capsules: Capsule[];
  loading: boolean;
  emptyLabel: string;
  onDeleted: (id: string) => void;
}

const CapsuleSection: React.FC<SectionProps> = ({ title, icon: Icon, capsules, loading, emptyLabel, onDeleted }) => (
  <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4 flex flex-col gap-3">
    <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
      <Icon size={15} className="text-purple-500" aria-hidden="true" />
      {title}
      {!loading && <span className="text-xs font-normal text-gray-400">({capsules.length})</span>}
    </h2>
    {loading ? (
      <div className="h-24 rounded-xl bg-gray-50 animate-pulse" />
    ) : capsules.length === 0 ? (
      <p className="text-xs text-gray-400">{emptyLabel}</p>
    ) : (
      <CapsuleTimeline capsules={capsules} onDeleted={onDeleted} />
    )}
  </div>
);

// "My Archive" — every capsule you've ever sealed. The default view is
// four labeled lifecycle sections (Locked / Unlocking Soon / Unlocked /
// Archived) rather than one flat list, so the countdown-to-open journey
// this app is built around is visible at a glance; "Browse & Search"
// switches to the full filterable timeline for when you need to find
// something specific.
export const CapsulesPage: React.FC = () => {
  const { user } = useAuth();
  const isOnline = useOnlineStatus();
  const { getUserCapsules, getCapsulesFeed } = useCapsules();
  const { getArchivedMemories } = useMemories();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [mode, setMode] = useState<'overview' | 'browse' | DiscoveryTab>('overview');

  const [locked, setLocked] = useState<Capsule[]>([]);
  const [unlocked, setUnlocked] = useState<Capsule[]>([]);
  const [archived, setArchived] = useState<Capsule[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOverview = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [lockedData, unlockedData, archivedData] = await Promise.all([
      getUserCapsules(user.id, { ...EMPTY_CAPSULE_FILTERS, lockStatus: 'locked' }, 50, 0),
      getUserCapsules(user.id, { ...EMPTY_CAPSULE_FILTERS, lockStatus: 'unlocked' }, 12, 0),
      getArchivedMemories(50, 0),
    ]);
    setLocked(lockedData);
    setUnlocked(unlockedData);
    setArchived(archivedData.filter(m => m.memory_type === 'capsule').map(m => ({
      id: m.id, user_id: m.user_id, username: m.username, display_name: m.display_name, profile_photo_url: m.profile_photo_url,
      is_private: false, title: m.title, memory_text: m.caption, memory_types: m.memory_types, media: m.media, mood: m.mood,
      visibility: m.visibility, unlock_date: m.matured_at, is_unlocked: m.is_unlocked, has_opened: true, is_owner: m.is_own,
      like_count: m.like_count, is_liked: false, comment_count: m.comment_count, save_count: 0, is_saved: false,
      share_count: 0, created_at: m.created_at,
    } satisfies Capsule)));
    setLoading(false);
  }, [user, getUserCapsules, getArchivedMemories]);

  useEffect(() => { if (mode === 'overview') loadOverview(); }, [mode, refreshKey, loadOverview]);

  // In Orbit / Public — a second, discovery-focused way into Capsules,
  // same shape as Feed's own tabs: fetched fresh per tab (not cached
  // across all of them at once, unlike Overview's own arrays above,
  // since these are lighter-weight and only one is ever visible).
  const [discoveryItems, setDiscoveryItems] = useState<Capsule[]>([]);
  const [discoveryLoading, setDiscoveryLoading] = useState(true);
  const [discoveryLoadingMore, setDiscoveryLoadingMore] = useState(false);
  const [discoveryHasMore, setDiscoveryHasMore] = useState(true);

  const isDiscoveryTab = (m: typeof mode): m is DiscoveryTab => m === 'in_orbit' || m === 'public';

  const loadDiscovery = useCallback(async (tab: DiscoveryTab) => {
    setDiscoveryLoading(true);
    const data = await getCapsulesFeed(tab, PAGE_SIZE, 0);
    setDiscoveryItems(data);
    setDiscoveryHasMore(data.length === PAGE_SIZE);
    setDiscoveryLoading(false);
  }, [getCapsulesFeed]);

  useEffect(() => { if (isDiscoveryTab(mode)) loadDiscovery(mode); }, [mode, loadDiscovery]);

  const loadMoreDiscovery = () => {
    if (!isDiscoveryTab(mode)) return;
    setDiscoveryLoadingMore(true);
    getCapsulesFeed(mode, PAGE_SIZE, discoveryItems.length).then(data => {
      setDiscoveryItems(prev => [...prev, ...data]);
      setDiscoveryHasMore(data.length === PAGE_SIZE);
      setDiscoveryLoadingMore(false);
    });
  };

  const now = Date.now();
  const unlockingSoon = locked.filter(c => new Date(c.unlock_date).getTime() - now <= SOON_WINDOW_MS);
  const stillLocked = locked.filter(c => new Date(c.unlock_date).getTime() - now > SOON_WINDOW_MS);

  const removeFrom = (setter: React.Dispatch<React.SetStateAction<Capsule[]>>) => (id: string) => setter(prev => prev.filter(c => c.id !== id));

  if (!user) return null;

  return (
    <div className="flex flex-col gap-4 -mx-4 px-4 -mt-6 pt-6 pb-6 bg-gradient-to-b from-purple-50/60 via-transparent to-transparent min-h-[calc(100vh-4rem)]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Clock size={20} className="text-purple-500" aria-hidden="true" />
            Time Capsules
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Memories you've sent into the future.</p>
        </div>
        <Button variant="accent" size="sm" onClick={() => setWizardOpen(true)}>
          <Plus size={15} aria-hidden="true" />
          New Capsule
        </Button>
      </div>

      <div role="tablist" aria-label="Capsules views" className="flex bg-white dark:bg-gray-900 rounded-xl p-1 gap-1 border border-gray-100 dark:border-gray-800 shadow-sm overflow-x-auto">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'overview'}
          onClick={() => setMode('overview')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${mode === 'overview' ? 'bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300' : 'text-gray-500'}`}
        >
          My Capsules
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'in_orbit'}
          onClick={() => setMode('in_orbit')}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${mode === 'in_orbit' ? 'bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300' : 'text-gray-500'}`}
        >
          <Users size={12} aria-hidden="true" /> In Orbit
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'public'}
          onClick={() => setMode('public')}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${mode === 'public' ? 'bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300' : 'text-gray-500'}`}
        >
          <Globe2 size={12} aria-hidden="true" /> Public
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'browse'}
          onClick={() => setMode('browse')}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${mode === 'browse' ? 'bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300' : 'text-gray-500'}`}
        >
          <LayoutList size={12} aria-hidden="true" /> Browse & Search
        </button>
      </div>

      {mode === 'browse' ? (
        <CapsuleArchive key={refreshKey} userId={user.id} isOwnArchive />
      ) : isDiscoveryTab(mode) ? (
        discoveryLoading ? (
          <div className="flex flex-col gap-3">{[0, 1, 2].map(i => <div key={i} className="h-32 rounded-2xl bg-white/60 animate-pulse" />)}</div>
        ) : discoveryItems.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
            {!isOnline ? (
              <ErrorState title="You're offline" description="Reconnect and try again." onRetry={() => loadDiscovery(mode)} />
            ) : mode === 'in_orbit' ? (
              <EmptyState icon={Users} title="No Orbit capsules yet" description="Capsules from people in your Orbit will show up here, sealed or open." />
            ) : (
              <EmptyState icon={Globe2} title="No public capsules yet" description="Public capsules from everyone will show up here, sealed or open." />
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <CapsuleTimeline capsules={discoveryItems} onDeleted={id => setDiscoveryItems(prev => prev.filter(c => c.id !== id))} />
            {discoveryHasMore ? (
              <Button variant="secondary" size="sm" onClick={loadMoreDiscovery} disabled={discoveryLoadingMore} className="self-center">
                {discoveryLoadingMore ? 'Loading...' : 'Load more'}
              </Button>
            ) : (
              <p className="text-center text-xs text-gray-400 py-2">You've reached the end.</p>
            )}
          </div>
        )
      ) : (
        <div className="flex flex-col gap-4">
          <CapsuleSection title="Unlocking Soon" icon={Hourglass} capsules={unlockingSoon} loading={loading} emptyLabel="Nothing unlocking in the next 7 days." onDeleted={removeFrom(setLocked)} />
          <CapsuleSection title="Locked" icon={Lock} capsules={stillLocked} loading={loading} emptyLabel="No capsules sealed further out." onDeleted={removeFrom(setLocked)} />
          <CapsuleSection title="Unlocked" icon={Unlock} capsules={unlocked} loading={loading} emptyLabel="Nothing opened yet." onDeleted={removeFrom(setUnlocked)} />
          {archived.length > 0 && (
            <CapsuleSection title="Archived" icon={ArchiveIcon} capsules={archived} loading={loading} emptyLabel="" onDeleted={removeFrom(setArchived)} />
          )}
          {!loading && locked.length === 0 && unlocked.length === 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
              {!isOnline ? (
                <ErrorState title="You're offline" description="Reconnect and try again." onRetry={loadOverview} />
              ) : (
                <EmptyState icon={Clock} title="No capsules yet" description="Create your first Time Capsule — a memory you send into the future." />
              )}
            </div>
          )}
        </div>
      )}

      <CapsuleWizard
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={() => setRefreshKey(k => k + 1)}
      />
    </div>
  );
};
