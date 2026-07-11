import React, { useEffect, useState } from 'react';
import { GitCommitVertical, CalendarDays, CalendarRange, Unlock, Lock } from 'lucide-react';
import { useMemories } from '../hooks/useMemories';
import { MemoryTimeline } from '../components/memories/MemoryTimeline';
import { MemoryCalendar } from '../components/memories/MemoryCalendar';
import { YearView } from '../components/memories/YearView';
import { ListView } from '../components/memories/ListView';
import { EMPTY_MEMORY_FILTERS, type Memory, type MemoryCollection } from '../types/memory';

type MemoriesTab = 'timeline' | 'calendar' | 'years';

const TABS: { id: MemoriesTab; label: string; icon: typeof GitCommitVertical }[] = [
  { id: 'timeline', label: 'Timeline', icon: GitCommitVertical },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'years', label: 'Years', icon: CalendarRange },
];

// The emotional heart of the app once someone's accumulated months and
// years of memories — a journal/scrapbook, not a profile grid. Every
// unlocked Capsule and expired Moment lives here, forever, across three
// ways of looking back at them (Collections/Favorites/Flashbacks/
// Highlights/Archive were removed as tabs — too much surface for a
// first launch; MemoryTimeline's own collection filter still works for
// anyone who already created one).
export const MemoriesPage: React.FC = () => {
  const { getMemories, getCollections } = useMemories();
  const [tab, setTab] = useState<MemoriesTab>('timeline');
  const [collections, setCollections] = useState<MemoryCollection[]>([]);
  const [recentlyUnlocked, setRecentlyUnlocked] = useState<Memory[]>([]);
  const [lockedUntilLater, setLockedUntilLater] = useState<Memory[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(true);

  useEffect(() => { getCollections().then(setCollections); }, [getCollections]);

  useEffect(() => {
    if (tab !== 'timeline') return;
    setOverviewLoading(true);
    Promise.all([
      getMemories({ ...EMPTY_MEMORY_FILTERS, lockStatus: 'unlocked' }, 'newest', 5, 0),
      // Fetched wider than needed and re-sorted client-side by matured_at
      // (soonest unlock first) — get_memories only sorts by created_at,
      // which isn't the same ordering "what's coming up next" needs.
      getMemories({ ...EMPTY_MEMORY_FILTERS, lockStatus: 'locked' }, 'newest', 20, 0),
    ]).then(([unlocked, locked]) => {
      setRecentlyUnlocked(unlocked);
      setLockedUntilLater([...locked].sort((a, b) => new Date(a.matured_at).getTime() - new Date(b.matured_at).getTime()).slice(0, 5));
      setOverviewLoading(false);
    });
  }, [tab, getMemories]);

  return (
    <div className="flex flex-col gap-4 -mx-4 px-4 -mt-6 pt-6 pb-6 bg-gradient-to-b from-purple-50/60 via-transparent to-transparent min-h-[calc(100vh-4rem)]">
      <div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Memories</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Every memory you've ever unlocked, in one place, forever.</p>
      </div>

      <div role="tablist" aria-label="Memories views" className="flex bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl rounded-xl p-1 gap-1 border border-white/60 dark:border-gray-800/60 shadow-sm overflow-x-auto">
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

      {tab === 'timeline' && (
        <div className="flex flex-col gap-4">
          {!overviewLoading && recentlyUnlocked.length > 0 && (
            <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-gray-800/60 shadow-sm p-4 flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                <Unlock size={15} className="text-purple-500" aria-hidden="true" />
                Recently Unlocked
              </h2>
              <ListView memories={recentlyUnlocked} />
            </div>
          )}

          {!overviewLoading && lockedUntilLater.length > 0 && (
            <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-gray-800/60 shadow-sm p-4 flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                <Lock size={15} className="text-purple-500" aria-hidden="true" />
                Locked Until Later
              </h2>
              <ListView memories={lockedUntilLater} />
            </div>
          )}

          <MemoryTimeline collections={collections} />
        </div>
      )}

      {tab === 'calendar' && <MemoryCalendar />}

      {tab === 'years' && <YearView />}
    </div>
  );
};
