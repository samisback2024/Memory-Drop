import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useDrops } from '../hooks/useDrops';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { DropTabs } from '../components/feed/DropTabs';
import { Feed } from '../components/feed/Feed';
import { DropComposer } from '../components/feed/DropComposer';
import { MomentTray } from '../components/moments/MomentTray';
import { CreateMomentModal } from '../components/moments/CreateMomentModal';
import { MomentViewer } from '../components/moments/MomentViewer';
import { Avatar } from '../components/ui/Avatar';
import type { Drop, DropTab } from '../types/feed';

const PAGE_SIZE = 10;
const ALL_TABS: DropTab[] = ['my_drops', 'following', 'public_drops', 'saved_to_unlock'];

interface TabState {
  drops: Drop[];
  offset: number;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  loaded: boolean;
}

const emptyTabState = (): TabState => ({ drops: [], offset: 0, hasMore: true, loading: true, loadingMore: false, loaded: false });

// The feed as Memory Drop's actual identity, not a generic social wall:
// four tabs built around the lifecycle of a memory (dropped, sealed,
// opening today, out in the world) rather than "following/discover/
// trending." See DropCard for how a locked drop renders — no content is
// ever sent to the client early, so there's nothing to blur, just a
// sealed capsule and a countdown.
export const FeedPage: React.FC = () => {
  const { profile } = useAuth();
  const { getDropsFeed } = useDrops();
  const [activeTab, setActiveTab] = useState<DropTab>('my_drops');
  const [tabStates, setTabStates] = useState<Record<DropTab, TabState>>({
    my_drops: emptyTabState(), following: emptyTabState(), public_drops: emptyTabState(),
    saved_to_unlock: emptyTabState(),
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const [composerOpen, setComposerOpen] = useState(false);

  // Backs the "New Drop" PWA manifest shortcut (public/site.webmanifest)
  // — a shortcut that lands on a plain /feed with no visible effect
  // would be a broken-feeling promise, so this actually opens the
  // composer on arrival, once, then cleans the URL up.
  useEffect(() => {
    if (searchParams.get('compose') === 'drop') {
      setComposerOpen(true);
      setSearchParams(params => { params.delete('compose'); return params; }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [momentComposerOpen, setMomentComposerOpen] = useState(false);
  const [viewingMomentsFor, setViewingMomentsFor] = useState<string | null>(null);
  const [momentTrayKey, setMomentTrayKey] = useState(0);
  const scrollPositions = useRef<Record<DropTab, number>>({
    my_drops: 0, following: 0, public_drops: 0, saved_to_unlock: 0,
  });

  const loadTab = useCallback(async (tab: DropTab) => {
    setTabStates(prev => ({ ...prev, [tab]: { ...prev[tab], loading: true } }));
    const data = await getDropsFeed(tab, PAGE_SIZE, 0);
    setTabStates(prev => ({
      ...prev,
      [tab]: { drops: data, offset: data.length, hasMore: data.length === PAGE_SIZE, loading: false, loadingMore: false, loaded: true },
    }));
  }, [getDropsFeed]);

  useEffect(() => {
    if (!tabStates[activeTab].loaded) loadTab(activeTab);
    // Only re-run when the tab itself changes — loadTab is stable, and
    // tabStates is intentionally excluded so this doesn't refire on every
    // load/loadMore update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Restores the previously-visited tab's scroll offset after its (already
  // cached) drops have painted, rather than resetting to the top every
  // time you switch tabs.
  useEffect(() => {
    const y = scrollPositions.current[activeTab];
    const frame = requestAnimationFrame(() => window.scrollTo(0, y));
    return () => cancelAnimationFrame(frame);
  }, [activeTab]);

  const handleTabChange = (tab: DropTab) => {
    if (tab === activeTab) return;
    scrollPositions.current[activeTab] = window.scrollY;
    setActiveTab(tab);
  };

  const loadMore = useCallback(async () => {
    const state = tabStates[activeTab];
    if (state.loadingMore || !state.hasMore || state.loading) return;
    setTabStates(prev => ({ ...prev, [activeTab]: { ...prev[activeTab], loadingMore: true } }));
    const data = await getDropsFeed(activeTab, PAGE_SIZE, state.offset);
    setTabStates(prev => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        drops: [...prev[activeTab].drops, ...data],
        offset: prev[activeTab].offset + data.length,
        hasMore: data.length === PAGE_SIZE,
        loadingMore: false,
      },
    }));
  }, [activeTab, tabStates, getDropsFeed]);

  const refresh = useCallback(() => loadTab(activeTab), [activeTab, loadTab]);
  const { pulling, distance, refreshing } = usePullToRefresh(refresh, true);

  const handleDropped = (drop: Drop) => {
    setTabStates(prev => {
      const next = { ...prev };
      for (const tab of ALL_TABS) {
        next[tab] = tab === activeTab
          ? { ...prev[tab], drops: [drop, ...prev[tab].drops] }
          : { ...prev[tab], loaded: false }; // refetch next time that tab is opened
      }
      return next;
    });
  };

  const removeFromAllTabs = (dropId: string) => {
    setTabStates(prev => {
      const next = { ...prev };
      for (const tab of ALL_TABS) next[tab] = { ...prev[tab], drops: prev[tab].drops.filter(d => d.id !== dropId) };
      return next;
    });
  };

  const current = tabStates[activeTab];
  const displayName = profile?.display_name || profile?.username || 'there';

  return (
    <div className="flex flex-col gap-4 -mx-4 px-4 -mt-6 pt-6 pb-6 bg-gradient-to-b from-purple-50/60 via-transparent to-transparent min-h-[calc(100vh-4rem)]">
      {(pulling || refreshing) && (
        <div className="flex justify-center items-center overflow-hidden transition-[height]" style={{ height: refreshing ? 36 : distance }}>
          <Loader2
            size={20}
            className={refreshing ? 'text-purple-500 animate-spin' : 'text-purple-400'}
            style={{ opacity: refreshing ? 1 : Math.min(distance / 70, 1) }}
            aria-hidden="true"
          />
        </div>
      )}

      <MomentTray
        onCreate={() => setMomentComposerOpen(true)}
        onOpenAuthor={setViewingMomentsFor}
        refreshKey={momentTrayKey}
      />

      <button
        type="button"
        onClick={() => setComposerOpen(true)}
        className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-gray-800/60 shadow-sm p-4 flex items-center gap-3 text-left hover:shadow-md transition-shadow"
      >
        <Avatar src={profile?.profile_photo_url} name={displayName} size="md" />
        <span className="flex-1 text-sm text-gray-400 dark:text-gray-500">What moment do you want to save, {displayName.split(' ')[0]}?</span>
        <span className="flex items-center gap-1.5 text-sm font-medium text-purple-600 flex-shrink-0">
          <Sparkles size={15} aria-hidden="true" />
          Create Drop
        </span>
      </button>

      <DropTabs active={activeTab} onChange={handleTabChange} />

      <Feed
        drops={current.drops}
        loading={current.loading}
        hasMore={current.hasMore}
        loadingMore={current.loadingMore}
        onLoadMore={loadMore}
        onDeleted={removeFromAllTabs}
        onHidden={removeFromAllTabs}
        onRetry={() => loadTab(activeTab)}
        emptyVariant={activeTab}
      />

      <DropComposer isOpen={composerOpen} onClose={() => setComposerOpen(false)} onDropped={handleDropped} />

      <CreateMomentModal
        isOpen={momentComposerOpen}
        onClose={() => setMomentComposerOpen(false)}
        onCreated={() => setMomentTrayKey(k => k + 1)}
      />

      {viewingMomentsFor && (
        <MomentViewer
          authorUserId={viewingMomentsFor}
          onClose={() => { setViewingMomentsFor(null); setMomentTrayKey(k => k + 1); }}
        />
      )}
    </div>
  );
};
