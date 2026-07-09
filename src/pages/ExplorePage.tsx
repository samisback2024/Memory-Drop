import React, { useCallback, useEffect, useState } from 'react';
import { Compass } from 'lucide-react';
import { useSearch } from '../hooks/useSearch';
import { GridView } from '../components/memories/GridView';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import { Button } from '../components/ui/Button';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { EXPLORE_TABS, type ExploreTab, type Memory } from '../types/memory';

const PAGE_SIZE = 21;

// Discovery — Phase 10a. Every tab is a thin parameterization of
// get_explore_feed(), which itself is built on search_memories(): the
// same can_view_drop/can_view_capsule/can_view_moment visibility rules
// used everywhere else decide what's returned, so Explore never shows
// anything a given viewer wouldn't already be allowed to see elsewhere
// in the app.
export const ExplorePage: React.FC = () => {
  const { getExploreFeed } = useSearch();
  const isOnline = useOnlineStatus();
  const [tab, setTab] = useState<ExploreTab>('trending');
  const [items, setItems] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const load = useCallback((selectedTab: ExploreTab) => {
    setLoading(true);
    getExploreFeed(selectedTab, PAGE_SIZE, 0).then(data => {
      setItems(data);
      setHasMore(data.length === PAGE_SIZE);
      setLoading(false);
    });
  }, [getExploreFeed]);

  useEffect(() => { load(tab); }, [tab, load]);

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
      <div>
        <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Compass size={18} className="text-purple-500" aria-hidden="true" />
          Explore
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Public memories, from everyone you're allowed to see.</p>
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
              tab === id ? 'bg-gradient-to-r from-purple-600 to-blue-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-1.5">{Array.from({ length: 9 }, (_, i) => <div key={i} className="aspect-square rounded-xl bg-gray-50 animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          {!isOnline ? (
            <ErrorState title="You're offline" description="Reconnect and try again." onRetry={() => load(tab)} />
          ) : (
            <EmptyState icon={Compass} title="Nothing here yet" description="Nothing public matches this category right now — check back later." />
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <GridView memories={items} />
          {hasMore && (
            <Button variant="secondary" size="sm" onClick={loadMore} disabled={loadingMore} className="self-center">
              {loadingMore ? 'Loading...' : 'Load more'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
