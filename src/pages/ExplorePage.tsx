import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Compass, RefreshCw } from 'lucide-react';
import { useSearch } from '../hooks/useSearch';
import { GridView } from '../components/memories/GridView';
import { SuggestedFriends } from '../components/social/SuggestedFriends';
import { NewCreators } from '../components/social/NewCreators';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Button } from '../components/ui/Button';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { EXPLORE_TABS, PERSON_TABS, type ExploreTab, type Memory } from '../types/memory';

const PAGE_SIZE = 21;

// Discovery — revised Phase 10 spec's exact section list. Every memory
// tab is a thin parameterization of get_explore_feed(), built on
// search_memories(): the same can_view_drop/can_view_capsule visibility
// rules used everywhere else decide what's returned, so Explore never
// shows anything a given viewer wouldn't already be allowed to see
// elsewhere in the app. The two person tabs (New Creators, Suggested
// People) render entirely different components — they return accounts,
// not memories — rather than forcing both shapes through one type.
export const ExplorePage: React.FC = () => {
  const { getExploreFeed } = useSearch();
  const isOnline = useOnlineStatus();
  const [tab, setTab] = useState<ExploreTab>('unlocking_soon');
  const [items, setItems] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const isPersonTab = PERSON_TABS.includes(tab);

  // Guards against rapid tab switching letting an older, slower response
  // overwrite a newer, faster one's result — same `cancelled` convention
  // used throughout the app (e.g. PublicProfilePage's load()), adapted
  // with a ref since `load` here is shared between the effect below and
  // manual triggers (the refresh button, the error-state retry).
  const cancelledRef = useRef(false);

  const load = useCallback((selectedTab: ExploreTab) => {
    cancelledRef.current = false;
    setLoading(true);
    getExploreFeed(selectedTab, PAGE_SIZE, 0).then(data => {
      if (cancelledRef.current) return;
      setItems(data);
      setHasMore(data.length === PAGE_SIZE);
      setLoading(false);
    });
  }, [getExploreFeed]);

  useEffect(() => {
    if (!isPersonTab) load(tab);
    return () => { cancelledRef.current = true; };
  }, [tab, isPersonTab, load]);

  const loadMore = () => {
    setLoadingMore(true);
    getExploreFeed(tab, PAGE_SIZE, items.length).then(data => {
      setItems(prev => [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
      setLoadingMore(false);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Compass size={18} className="text-purple-500" aria-hidden="true" />
            Explore
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Public memories and people, from everyone you're allowed to see.</p>
        </div>
        {!isPersonTab && (
          <button
            type="button"
            onClick={() => load(tab)}
            disabled={loading}
            aria-label="Refresh"
            className="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
          </button>
        )}
      </div>

      <div role="tablist" aria-label="Explore categories" className="flex gap-1.5 overflow-x-auto pb-0.5">
        {EXPLORE_TABS.map(({ id, label }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={[
              'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0',
              tab === id ? 'bg-gradient-to-r from-purple-600 to-blue-500 text-white' : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'suggested_people' ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
          <SuggestedFriends />
        </div>
      ) : tab === 'new_creators' ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
          <NewCreators />
        </div>
      ) : loading ? (
        <div className="grid grid-cols-3 gap-1.5">{Array.from({ length: 9 }, (_, i) => <div key={i} className="aspect-square rounded-xl bg-gray-50 dark:bg-gray-800 animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          {!isOnline ? (
            <ErrorState title="You're offline" description="Reconnect and try again." onRetry={() => load(tab)} />
          ) : (
            <EmptyState icon={Compass} title="Nothing here yet" description="Nothing public matches this category right now — check back later." />
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <GridView memories={items} />
          {hasMore ? (
            <Button variant="secondary" size="sm" onClick={loadMore} disabled={loadingMore} className="self-center">
              {loadingMore ? 'Loading...' : 'Load more'}
            </Button>
          ) : (
            <p className="text-center text-xs text-gray-400 dark:text-gray-500 py-2">You've reached the end.</p>
          )}
        </div>
      )}
    </div>
  );
};
