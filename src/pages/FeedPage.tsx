import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, Sparkles, LayoutGrid, ArrowUp } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useDrops } from '../hooks/useDrops';
import { supabase } from '../lib/supabase';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { DropTabs } from '../components/feed/DropTabs';
import { Feed } from '../components/feed/Feed';
import { DropComposer } from '../components/feed/DropComposer';
import { MomentPileButton } from '../components/moments/MomentPileButton';
import { MomentPileGround } from '../components/moments/MomentPileGround';
import { CreateMomentModal } from '../components/moments/CreateMomentModal';
import { Avatar } from '../components/ui/Avatar';
import { MEMORY_TYPE_ICONS } from '../components/feed/LockedDropPlaceholder';
import type { Drop, DropTab, MemoryType } from '../types/feed';

const PAGE_SIZE = 10;
const ALL_TABS: DropTab[] = ['my_drops', 'in_orbit', 'public_drops', 'saved_to_unlock'];
// 'audio' stays a valid MemoryType (existing audio drops still need to
// render), it's just not offered as a filter option anymore — Drops no
// longer support creating one, see DropComposer.tsx.
const MEDIA_FILTER_LABELS: Record<MemoryType, string> = { photo: 'Photo', video: 'Video', text: 'Text', audio: 'Voice' };
const MEDIA_FILTERS: MemoryType[] = ['photo', 'video', 'text'];

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
// opening today, out in the world) rather than "in orbit/discover/
// trending." See DropCard for how a locked drop renders — no content is
// ever sent to the client early, so there's nothing to blur, just a
// sealed capsule and a countdown.
const isDropTab = (value: string | null): value is DropTab => value !== null && (ALL_TABS as string[]).includes(value);

export const FeedPage: React.FC = () => {
  const { user, profile } = useAuth();
  const { getDropsFeed } = useDrops();
  const [searchParams, setSearchParams] = useSearchParams();
  // Persisted in the URL (?tab=) rather than plain useState — a hard
  // refresh on, say, the In Orbit tab used to always land back on My
  // Drops since nothing remembered which tab you'd been on.
  const [activeTab, setActiveTab] = useState<DropTab>(() => {
    const requested = searchParams.get('tab');
    return isDropTab(requested) ? requested : 'my_drops';
  });
  const [tabStates, setTabStates] = useState<Record<DropTab, TabState>>({
    my_drops: emptyTabState(), in_orbit: emptyTabState(), public_drops: emptyTabState(),
    saved_to_unlock: emptyTabState(),
  });
  const [composerOpen, setComposerOpen] = useState(false);
  const [mediaFilter, setMediaFilter] = useState<MemoryType | null>(null);
  const [newDropsAvailable, setNewDropsAvailable] = useState(false);

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
  const [momentTrayKey, setMomentTrayKey] = useState(0);
  const [pileOpen, setPileOpen] = useState(false);
  const scrollPositions = useRef<Record<DropTab, number>>({
    my_drops: 0, in_orbit: 0, public_drops: 0, saved_to_unlock: 0,
  });

  const loadTab = useCallback(async (tab: DropTab) => {
    setTabStates(prev => ({ ...prev, [tab]: { ...prev[tab], loading: true } }));
    const data = await getDropsFeed(tab, PAGE_SIZE, 0, mediaFilter);
    setTabStates(prev => ({
      ...prev,
      [tab]: { drops: data, offset: data.length, hasMore: data.length === PAGE_SIZE, loading: false, loadingMore: false, loaded: true },
    }));
  }, [getDropsFeed, mediaFilter]);

  useEffect(() => {
    if (!tabStates[activeTab].loaded) loadTab(activeTab);
    // Re-runs on either the tab or the media filter changing — loadTab
    // is recreated with the current mediaFilter closure whenever the
    // filter changes, and handleMediaFilterChange below resets the
    // active tab's `loaded` flag, so this picks the refetch up. tabStates
    // is intentionally excluded so this doesn't refire on every
    // load/loadMore update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, mediaFilter]);

  // Changing the media filter invalidates every tab's cached results
  // (they were fetched under the old filter) — refetch the one visible
  // now, mark the rest to refetch next time they're opened, same
  // pattern handleDropped already uses for a new drop landing.
  const handleMediaFilterChange = (next: MemoryType | null) => {
    if (next === mediaFilter) return;
    setMediaFilter(next);
    setTabStates(prev => {
      const result: Record<DropTab, TabState> = { ...prev };
      for (const tab of ALL_TABS) result[tab] = tab === activeTab ? emptyTabState() : { ...prev[tab], loaded: false };
      return result;
    });
  };

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
    setNewDropsAvailable(false);
    setSearchParams(params => {
      if (tab === 'my_drops') params.delete('tab'); // default tab, keep the URL clean
      else params.set('tab', tab);
      return params;
    }, { replace: true });
  };

  // A new Drop from someone else used to only ever appear after a manual
  // refresh — posts was never in the realtime publication (see
  // supabase/phase14q_feed_realtime.sql). Rather than splicing a raw
  // postgres_changes payload straight into the list (it doesn't tell us
  // which tab it actually belongs in — RLS only guarantees the row is
  // visible to us *somehow*, not specifically that its author is in our orbit),
  // this surfaces a lightweight "new drops" pill and lets tapping it
  // trigger the real, correct getDropsFeed refetch for the active tab.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`feed-drops:${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, payload => {
        const newPost = payload.new as { user_id: string };
        if (newPost.user_id === user.id) return; // own drop already handled by handleDropped
        if (activeTab === 'in_orbit' || activeTab === 'public_drops') setNewDropsAvailable(true);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, activeTab]);

  const handleRefreshNewDrops = () => {
    setNewDropsAvailable(false);
    loadTab(activeTab);
  };

  const loadMore = useCallback(async () => {
    const state = tabStates[activeTab];
    if (state.loadingMore || !state.hasMore || state.loading) return;
    setTabStates(prev => ({ ...prev, [activeTab]: { ...prev[activeTab], loadingMore: true } }));
    const data = await getDropsFeed(activeTab, PAGE_SIZE, state.offset, mediaFilter);
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
  }, [activeTab, tabStates, getDropsFeed, mediaFilter]);

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

      <button
        type="button"
        onClick={() => setComposerOpen(true)}
        className="glass-panel tactile rounded-2xl p-4 flex items-center gap-3 text-left"
      >
        <Avatar src={profile?.profile_photo_url} name={displayName} size="md" />
        <span className="flex-1 text-sm text-gray-400 dark:text-gray-500">What moment do you want to save, {displayName.split(' ')[0]}?</span>
        <span className="flex items-center gap-1.5 text-sm font-medium text-purple-600 flex-shrink-0">
          <Sparkles size={15} aria-hidden="true" />
          Create Drop
        </span>
      </button>

      <DropTabs active={activeTab} onChange={handleTabChange} />

      <div role="radiogroup" aria-label="Filter by media type" className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
        <button
          type="button"
          role="radio"
          aria-checked={mediaFilter === null}
          onClick={() => handleMediaFilterChange(null)}
          className={[
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap flex-shrink-0 tactile transition-colors',
            mediaFilter === null ? 'bg-purple-600 text-white' : 'glass-panel text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200',
          ].join(' ')}
        >
          <LayoutGrid size={12} aria-hidden="true" /> All
        </button>
        {MEDIA_FILTERS.map(type => {
          const Icon = MEMORY_TYPE_ICONS[type];
          const active = mediaFilter === type;
          return (
            <button
              key={type}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => handleMediaFilterChange(type)}
              className={[
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap flex-shrink-0 tactile transition-colors',
                active ? 'bg-purple-600 text-white' : 'glass-panel text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200',
              ].join(' ')}
            >
              <Icon size={12} aria-hidden="true" /> {MEDIA_FILTER_LABELS[type]}
            </button>
          );
        })}
      </div>

      {newDropsAvailable && (
        <div className="flex justify-center -mt-1 sticky top-[4.5rem] z-10">
          <button
            type="button"
            onClick={handleRefreshNewDrops}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-purple-600 to-blue-500 text-white text-xs font-semibold tactile animate-fade-in"
          >
            <ArrowUp size={13} aria-hidden="true" /> New drops — tap to refresh
          </button>
        </div>
      )}

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

      <MomentPileButton onClick={() => setPileOpen(true)} />

      <CreateMomentModal
        isOpen={momentComposerOpen}
        onClose={() => setMomentComposerOpen(false)}
        onCreated={() => setMomentTrayKey(k => k + 1)}
      />

      {pileOpen && (
        <MomentPileGround
          refreshKey={momentTrayKey}
          onClose={() => setPileOpen(false)}
          onCreate={() => setMomentComposerOpen(true)}
          onViewed={() => setMomentTrayKey(k => k + 1)}
        />
      )}
    </div>
  );
};
