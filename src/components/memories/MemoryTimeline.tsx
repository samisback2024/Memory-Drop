import React, { useCallback, useEffect, useState } from 'react';
import { List, LayoutGrid, BookOpen, GitCommitVertical, ArrowDownUp, Loader2, BookHeart } from 'lucide-react';
import { useMemories } from '../../hooks/useMemories';
import { MemorySearch } from './MemorySearch';
import { MemoryFilters } from './MemoryFilters';
import { ListView } from './ListView';
import { GridView } from './GridView';
import { JournalView } from './JournalView';
import { TimelineView } from './TimelineView';
import { EmptyState } from '../ui/EmptyState';
import { EMPTY_MEMORY_FILTERS, type Memory, type MemoryCollection, type MemoryLayout, type MemorySort } from '../../types/memory';

const PAGE_SIZE = 18;

const LAYOUTS: { id: MemoryLayout; icon: typeof List; label: string }[] = [
  { id: 'timeline', icon: GitCommitVertical, label: 'Timeline' },
  { id: 'journal', icon: BookOpen, label: 'Journal' },
  { id: 'grid', icon: LayoutGrid, label: 'Grid' },
  { id: 'list', icon: List, label: 'List' },
];

interface MemoryTimelineProps {
  collections: MemoryCollection[];
}

// The Timeline tab — search, filters, a layout switcher (List / Grid /
// Journal / Timeline, all reading the same underlying data), and
// infinite pagination via get_memories().
export const MemoryTimeline: React.FC<MemoryTimelineProps> = ({ collections }) => {
  const { getMemories, getMemoryYearCounts } = useMemories();
  const [filters, setFilters] = useState(EMPTY_MEMORY_FILTERS);
  const [sort, setSort] = useState<MemorySort>('newest');
  const [layout, setLayout] = useState<MemoryLayout>('timeline');
  const [memories, setMemories] = useState<Memory[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => { getMemoryYearCounts().then(rows => setYears(rows.map(r => r.year))); }, [getMemoryYearCounts]);

  const load = useCallback(async (reset: boolean, currentLength: number) => {
    if (reset) setLoading(true); else setLoadingMore(true);
    const offset = reset ? 0 : currentLength;
    const data = await getMemories(filters, sort, PAGE_SIZE, offset);
    setMemories(prev => (reset ? data : [...prev, ...data]));
    setHasMore(data.length === PAGE_SIZE);
    setLoading(false);
    setLoadingMore(false);
  }, [filters, sort, getMemories]);

  useEffect(() => { load(true, 0); }, [filters, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col gap-4">
      <MemorySearch value={filters.search} onChange={search => setFilters(f => ({ ...f, search }))} />
      <MemoryFilters filters={filters} onChange={setFilters} years={years} collections={collections} />

      <div className="flex items-center justify-between">
        <div className="flex bg-white/70 backdrop-blur-xl rounded-xl p-1 gap-1 border border-white/60 shadow-sm">
          {LAYOUTS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setLayout(id)}
              aria-label={label}
              aria-pressed={layout === id}
              className={[
                'p-2 rounded-lg transition-colors',
                layout === id ? 'bg-gradient-to-r from-purple-600 to-blue-500 text-white' : 'text-gray-500 hover:text-gray-800',
              ].join(' ')}
            >
              <Icon size={15} aria-hidden="true" />
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setSort(s => (s === 'newest' ? 'oldest' : 'newest'))}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 px-2"
        >
          <ArrowDownUp size={13} aria-hidden="true" /> {sort === 'newest' ? 'Newest first' : 'Oldest first'}
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-4">
          {[0, 1, 2].map(i => <div key={i} className="h-32 rounded-2xl bg-white/60 animate-pulse" />)}
        </div>
      ) : memories.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/60 shadow-sm">
          <EmptyState icon={BookHeart} title="No memories here yet" description="Once a capsule unlocks or a moment expires, it'll live here forever." />
        </div>
      ) : (
        <>
          {layout === 'timeline' && <TimelineView memories={memories} />}
          {layout === 'journal' && <JournalView memories={memories} />}
          {layout === 'grid' && <GridView memories={memories} />}
          {layout === 'list' && <ListView memories={memories} />}

          {hasMore && (
            <button
              type="button"
              onClick={() => load(false, memories.length)}
              disabled={loadingMore}
              className="self-center flex items-center gap-2 text-sm font-medium text-purple-600 hover:text-purple-700 disabled:opacity-50 py-2"
            >
              {loadingMore && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              Load more
            </button>
          )}
        </>
      )}
    </div>
  );
};
