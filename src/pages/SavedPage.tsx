import React, { useCallback, useEffect, useState } from 'react';
import { Search, X, Bookmark } from 'lucide-react';
import { useSaved } from '../hooks/useSaved';
import { useDrops } from '../hooks/useDrops';
import { useCapsules } from '../hooks/useCapsules';
import { useMemories } from '../hooks/useMemories';
import { SavedMemoryRow } from '../components/saved/SavedMemoryRow';
import { EmptyState } from '../components/ui/EmptyState';
import type { MemoryCollection, SavedMemory } from '../types/memory';

type TypeFilter = 'all' | 'drop' | 'capsule';
type SortOption = 'newest' | 'oldest';

const PAGE_SIZE = 20;

// Unifies saved Drops (saved_posts) and saved Capsules (capsule_saves) —
// Phase 6 gave Capsules their own save/like/comment trio but nothing
// ever built a page to browse saved Capsules until this phase. Folders
// reuse Phase 7's existing Collections rather than a new parallel
// concept; Notes and Sort/Search are genuinely new (Phase 10c).
export const SavedPage: React.FC = () => {
  const { getSavedMemories } = useSaved();
  const { unsaveDrop } = useDrops();
  const { unsaveCapsule } = useCapsules();
  const { getCollections } = useMemories();

  const [items, setItems] = useState<SavedMemory[]>([]);
  const [collections, setCollections] = useState<MemoryCollection[]>([]);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [collectionFilter, setCollectionFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<SortOption>('newest');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => { getCollections().then(setCollections); }, [getCollections]);

  const load = useCallback(() => {
    setLoading(true);
    const contentTypes = typeFilter === 'all' ? null : [typeFilter];
    getSavedMemories(query, contentTypes, collectionFilter, sort, PAGE_SIZE, 0).then(data => {
      setItems(data);
      setHasMore(data.length === PAGE_SIZE);
      setLoading(false);
    });
  }, [getSavedMemories, query, typeFilter, collectionFilter, sort]);

  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [load]);

  const loadMore = () => {
    setLoadingMore(true);
    const contentTypes = typeFilter === 'all' ? null : [typeFilter];
    getSavedMemories(query, contentTypes, collectionFilter, sort, PAGE_SIZE, items.length).then(data => {
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

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold text-gray-900">Saved</h1>

      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden="true" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search your saved memories..."
          aria-label="Search saved memories"
          className="w-full border border-gray-200 rounded-xl bg-white text-gray-900 placeholder-gray-400 pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
        {query && (
          <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
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
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${typeFilter === t ? 'bg-gradient-to-r from-purple-600 to-blue-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {t === 'all' ? 'All' : t === 'drop' ? 'Drops' : 'Capsules'}
          </button>
        ))}

        <select
          value={collectionFilter ?? ''}
          onChange={e => setCollectionFilter(e.target.value || null)}
          aria-label="Filter by collection"
          className="px-2.5 py-1.5 rounded-full text-xs font-medium bg-white border border-gray-200 text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="">All folders</option>
          {collections.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </select>

        <select
          value={sort}
          onChange={e => setSort(e.target.value as SortOption)}
          aria-label="Sort saved memories"
          className="ml-auto px-2.5 py-1.5 rounded-full text-xs font-medium bg-white border border-gray-200 text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="newest">Newest saved</option>
          <option value="oldest">Oldest saved</option>
        </select>
      </div>

      <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/60 shadow-sm px-4">
        {loading ? (
          <div className="flex flex-col gap-3 py-4">{[0, 1, 2].map(i => <div key={i} className="h-14 rounded-xl bg-gray-50 animate-pulse" />)}</div>
        ) : items.length === 0 ? (
          <EmptyState icon={Bookmark} title="Nothing saved yet" description="Save a Drop or Capsule to find it here later." />
        ) : (
          <>
            {items.map(item => (
              <SavedMemoryRow key={`${item.memory_type}-${item.id}`} memory={item} collections={collections} onUnsave={() => unsave(item)} />
            ))}
            {hasMore && (
              <div className="py-3 flex justify-center">
                <button type="button" onClick={loadMore} disabled={loadingMore} className="text-xs font-medium text-purple-600 hover:text-purple-700 disabled:opacity-50">
                  {loadingMore ? 'Loading...' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
