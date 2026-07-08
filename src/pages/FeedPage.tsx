import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useFeed } from '../hooks/useFeed';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { FeedTabs } from '../components/feed/FeedTabs';
import { Feed } from '../components/feed/Feed';
import { PostComposer } from '../components/feed/PostComposer';
import { Avatar } from '../components/ui/Avatar';
import type { FeedPost, FeedTab } from '../types/feed';

const PAGE_SIZE = 10;
const ALL_TABS: FeedTab[] = ['following', 'discover', 'trending', 'recent'];

interface TabState {
  posts: FeedPost[];
  offset: number;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  loaded: boolean;
}

const emptyTabState = (): TabState => ({ posts: [], offset: 0, hasMore: true, loading: true, loadingMore: false, loaded: false });

export const FeedPage: React.FC = () => {
  const { profile } = useAuth();
  const { getFeed } = useFeed();
  const [activeTab, setActiveTab] = useState<FeedTab>('following');
  const [tabStates, setTabStates] = useState<Record<FeedTab, TabState>>({
    following: emptyTabState(), discover: emptyTabState(), trending: emptyTabState(), recent: emptyTabState(),
  });
  const [composerOpen, setComposerOpen] = useState(false);
  const scrollPositions = useRef<Record<FeedTab, number>>({ following: 0, discover: 0, trending: 0, recent: 0 });

  const loadTab = useCallback(async (tab: FeedTab) => {
    setTabStates(prev => ({ ...prev, [tab]: { ...prev[tab], loading: true } }));
    const data = await getFeed(tab, PAGE_SIZE, 0);
    setTabStates(prev => ({
      ...prev,
      [tab]: { posts: data, offset: data.length, hasMore: data.length === PAGE_SIZE, loading: false, loadingMore: false, loaded: true },
    }));
  }, [getFeed]);

  useEffect(() => {
    if (!tabStates[activeTab].loaded) loadTab(activeTab);
    // Only re-run when the tab itself changes — loadTab is stable, and
    // tabStates is intentionally excluded so this doesn't refire on every
    // load/loadMore update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Restores the previously-visited tab's scroll offset after its (already
  // cached) posts have painted, rather than resetting to the top every
  // time you switch tabs.
  useEffect(() => {
    const y = scrollPositions.current[activeTab];
    const frame = requestAnimationFrame(() => window.scrollTo(0, y));
    return () => cancelAnimationFrame(frame);
  }, [activeTab]);

  const handleTabChange = (tab: FeedTab) => {
    if (tab === activeTab) return;
    scrollPositions.current[activeTab] = window.scrollY;
    setActiveTab(tab);
  };

  const loadMore = useCallback(async () => {
    const state = tabStates[activeTab];
    if (state.loadingMore || !state.hasMore || state.loading) return;
    setTabStates(prev => ({ ...prev, [activeTab]: { ...prev[activeTab], loadingMore: true } }));
    const data = await getFeed(activeTab, PAGE_SIZE, state.offset);
    setTabStates(prev => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        posts: [...prev[activeTab].posts, ...data],
        offset: prev[activeTab].offset + data.length,
        hasMore: data.length === PAGE_SIZE,
        loadingMore: false,
      },
    }));
  }, [activeTab, tabStates, getFeed]);

  const refresh = useCallback(() => loadTab(activeTab), [activeTab, loadTab]);
  const { pulling, distance, refreshing } = usePullToRefresh(refresh, true);

  const handlePosted = (post: FeedPost) => {
    setTabStates(prev => {
      const next = { ...prev };
      for (const tab of ALL_TABS) {
        next[tab] = tab === activeTab
          ? { ...prev[tab], posts: [post, ...prev[tab].posts] }
          : { ...prev[tab], loaded: false }; // refetch next time that tab is opened
      }
      return next;
    });
  };

  const removeFromAllTabs = (postId: string) => {
    setTabStates(prev => {
      const next = { ...prev };
      for (const tab of ALL_TABS) next[tab] = { ...prev[tab], posts: prev[tab].posts.filter(p => p.id !== postId) };
      return next;
    });
  };

  const current = tabStates[activeTab];
  const displayName = profile?.display_name || profile?.username || 'there';

  return (
    <div className="flex flex-col gap-4">
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
        className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 text-left hover:border-gray-200 transition-colors"
      >
        <Avatar src={profile?.profile_photo_url} name={displayName} size="md" />
        <span className="flex-1 text-sm text-gray-400">What's on your mind, {displayName.split(' ')[0]}?</span>
        <ImageIcon size={18} className="text-purple-500 flex-shrink-0" aria-hidden="true" />
      </button>

      <FeedTabs active={activeTab} onChange={handleTabChange} />

      <Feed
        posts={current.posts}
        loading={current.loading}
        hasMore={current.hasMore}
        loadingMore={current.loadingMore}
        onLoadMore={loadMore}
        onDeleted={removeFromAllTabs}
        onHidden={removeFromAllTabs}
        emptyVariant={activeTab}
      />

      <PostComposer isOpen={composerOpen} onClose={() => setComposerOpen(false)} onPosted={handlePosted} />
    </div>
  );
};
