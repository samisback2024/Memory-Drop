import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, X, Bookmark, Gem, Clock } from 'lucide-react';
import { useSaved } from '../hooks/useSaved';
import { useDrops } from '../hooks/useDrops';
import { useCapsules } from '../hooks/useCapsules';
import { useMemories } from '../hooks/useMemories';
import { SavedMemoryRow } from '../components/saved/SavedMemoryRow';
import { Feed } from '../components/feed/Feed';
import { GridView } from '../components/memories/GridView';
import { EmptyState } from '../components/ui/EmptyState';
import { EMPTY_MEMORY_FILTERS, type Memory, type SavedMemory } from '../types/memory';
import type { Drop } from '../types/feed';

type SavedTab = 'waiting' | 'memories' | 'favorites';
type TypeFilter = 'all' | 'drop' | 'capsule';
type SortOption = 'newest' | 'oldest';

const PAGE_SIZE = 20;

const TABS: { id: SavedTab; label: string; icon: typeof Bookmark }[] = [
  { id: 'waiting', label: 'Waiting to Unlock', icon: Clock },
  { id: 'memories', label: 'Saved Memories', icon: Bookmark },
  { id: 'favorites', label: 'Favorites', icon: Gem },
];

// Two distinct concepts, kept visibly separate rather than merged into
// one flat list: "Waiting to Unlock" is drop_interests' pre-unlock
// save_to_unlock marker (the same data Feed's own "Saved to Unlock" tab
// already reads via getDropsFeed) — you haven't seen this content yet.
// "Saved Memories" is a bookmark on something you HAVE already seen
// (saved_posts/capsule_saves, Phase 10c). Favorites reuses Memories'
// own mechanism unchanged — this page is a second, saved-content-
// focused entry point onto the same underlying data, not a competing
// system.
const VALID_TABS: SavedTab[] = ['waiting', 'memories', 'favorites'];

export const SavedPage: React.FC = () => {
  const { getSavedMemories } = useSaved();
  const { getDropsFeed, promoteUnlockedSaves, unsaveDrop } = useDrops();
  const { unsaveCapsule } = useCapsules();
  const { getMemories } = useMemories();
  const [searchParams] = useSearchParams();

  const requestedTab = searchParams.get('tab');
  const [tab, setTab] = useState<SavedTab>(
    (requestedTab && VALID_TABS.includes(requestedTab as SavedTab) ? requestedTab as SavedTab : 'waiting')
  );

  // Waiting to Unlock
  const [waiting, setWaiting] = useState<Drop[]>([]);
  const [waitingOffset, setWaitingOffset] = useState(0);
  const [waitingHasMore, setWaitingHasMore] = useState(true);
  const [waitingLoading, setWaitingLoading] = useState(true);
  const [waitingLoadingMore, setWaitingLoadingMore] = useState(false);

  // Saved Memories
  const [items, setItems] = useState<SavedMemory[]>([]);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [sort, setSort] = useState<SortOption>('newest');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Favorites
  const [favorites, setFavorites] = useState<Memory[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(true);

  // Catches up anything that unlocked while this tab wasn't open live to
  // watch its countdown (DropCard promotes on the spot when it is) —
  // otherwise a drop could sit unlocked-but-still-"waiting" until this
  // page happened to be revisited. Quiet, no toast: this is a background
  // catch-up pass, not the live "it just unlocked" moment.
  const loadWaiting = useCallback(() => {
    setWaitingLoading(true);
    promoteUnlockedSaves().finally(() => {
      getDropsFeed('saved_to_unlock', PAGE_SIZE, 0).then(data => {
        setWaiting(data);
        setWaitingOffset(data.length);
        setWaitingHasMore(data.length === PAGE_SIZE);
        setWaitingLoading(false);
      });
    });
  }, [getDropsFeed, promoteUnlockedSaves]);

  useEffect(() => { if (tab === 'waiting') loadWaiting(); }, [tab, loadWaiting]);

  const loadMoreWaiting = () => {
    setWaitingLoadingMore(true);
    getDropsFeed('saved_to_unlock', PAGE_SIZE, waitingOffset).then(data => {
      setWaiting(prev => [...prev, ...data]);
      setWaitingOffset(prev => prev + data.length);
      setWaitingHasMore(data.length === PAGE_SIZE);
      setWaitingLoadingMore(false);
    });
  };

  const loadMemories = useCallback(() => {
    setLoading(true);
    const contentTypes = typeFilter === 'all' ? null : [typeFilter];
    getSavedMemories(query, contentTypes, sort, PAGE_SIZE, 0).then(data => {
      setItems(data);
      setHasMore(data.length === PAGE_SIZE);
      setLoading(false);
    });
  }, [getSavedMemories, query, typeFilter, sort]);

  useEffect(() => {
    if (tab !== 'memories') return;
    const timer = setTimeout(loadMemories, 300);
    return () => clearTimeout(timer);
  }, [tab, loadMemories]);

  const loadMoreMemories = () => {
    setLoadingMore(true);
    const contentTypes = typeFilter === 'all' ? null : [typeFilter];
    getSavedMemories(query, contentTypes, sort, PAGE_SIZE, items.length).then(data => {
      setItems(prev => [...prev, ...data]);
      setHasMore(data.length === PAGE_SIZE);
      setLoadingMore(false);
    });
  };

  const unsave = async (memory: SavedMemory) => {
    setItems(prev => prev.filter(m => m.id !== memory.id));
    if (memory.memory_type === 'drop') await unsaveDrop(memory.id);
    else await unsaveCapsule(memory.id);
  };

  useEffect(() => {
    if (tab !== 'favorites') return;
    setFavoritesLoading(true);
    getMemories({ ...EMPTY_MEMORY_FILTERS, favoritesOnly: true }, 'newest', 50, 0).then(data => {
      setFavorites(data);
      setFavoritesLoading(false);
    });
  }, [tab, getMemories]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Saved</h1>

      <div role="tablist" aria-label="Saved content" className="flex bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl rounded-xl p-1 gap-1 border border-white/60 dark:border-gray-800/60 shadow-sm overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={[
              'flex items-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0',
              tab === id ? 'bg-gradient-to-r from-purple-600 to-blue-500 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200',
            ].join(' ')}
          >
            <Icon size={14} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'waiting' && (
        <Feed
          drops={waiting}
          loading={waitingLoading}
          hasMore={waitingHasMore}
          loadingMore={waitingLoadingMore}
          onLoadMore={loadMoreWaiting}
          onDeleted={id => setWaiting(prev => prev.filter(d => d.id !== id))}
          onHidden={id => setWaiting(prev => prev.filter(d => d.id !== id))}
          onRetry={loadWaiting}
          emptyVariant="saved"
        />
      )}

      {tab === 'memories' && (
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden="true" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search your saved memories..."
              aria-label="Search saved memories"
              className="w-full border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
                <X size={16} aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(['all', 'drop', 'capsule'] as TypeFilter[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${typeFilter === t ? 'bg-gradient-to-r from-purple-600 to-blue-500 text-white' : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
              >
                {t === 'all' ? 'All' : t === 'drop' ? 'Drops' : 'Capsules'}
              </button>
            ))}

            <select
              value={sort}
              onChange={e => setSort(e.target.value as SortOption)}
              aria-label="Sort saved memories"
              className="ml-auto px-2.5 py-1.5 rounded-full text-xs font-medium bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="newest">Newest saved</option>
              <option value="oldest">Oldest saved</option>
            </select>
          </div>

          <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-gray-800/60 shadow-sm px-4">
            {loading ? (
              <div className="flex flex-col gap-3 py-4">{[0, 1, 2].map(i => <div key={i} className="h-14 rounded-xl bg-gray-50 dark:bg-gray-800 animate-pulse" />)}</div>
            ) : items.length === 0 ? (
              <EmptyState icon={Bookmark} title="Nothing saved yet" description="Save an unlocked Drop or Capsule to find it here later." />
            ) : (
              <>
                {items.map(item => (
                  <SavedMemoryRow key={`${item.memory_type}-${item.id}`} memory={item} onUnsave={() => unsave(item)} />
                ))}
                {hasMore && (
                  <div className="py-3 flex justify-center">
                    <button type="button" onClick={loadMoreMemories} disabled={loadingMore} className="text-xs font-medium text-purple-600 hover:text-purple-700 disabled:opacity-50">
                      {loadingMore ? 'Loading...' : 'Load more'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'favorites' && (
        favoritesLoading ? (
          <div className="grid grid-cols-3 gap-1.5">{[0, 1, 2].map(i => <div key={i} className="aspect-square rounded-xl bg-gray-50 dark:bg-gray-800 animate-pulse" />)}</div>
        ) : favorites.length === 0 ? (
          <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-gray-800/60 shadow-sm">
            <EmptyState icon={Gem} title="No favorites yet" description="Tap the gem on any memory to keep it close." />
          </div>
        ) : (
          <GridView memories={favorites} />
        )
      )}
    </div>
  );
};
