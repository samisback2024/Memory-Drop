import React, { useCallback, useEffect, useState } from 'react';
import {
  GitCommitVertical, CalendarDays, CalendarRange, FolderHeart, Heart, Sparkles, Flame, Archive, Unlock, Lock,
} from 'lucide-react';
import { useMemories } from '../hooks/useMemories';
import { MemoryTimeline } from '../components/memories/MemoryTimeline';
import { MemoryCalendar } from '../components/memories/MemoryCalendar';
import { YearView } from '../components/memories/YearView';
import { CollectionGrid } from '../components/memories/CollectionGrid';
import { FlashbackCard } from '../components/memories/FlashbackCard';
import { HighlightCard } from '../components/memories/HighlightCard';
import { TimelineView } from '../components/memories/TimelineView';
import { ListView } from '../components/memories/ListView';
import { EmptyState } from '../components/ui/EmptyState';
import { EMPTY_MEMORY_FILTERS, type Flashback, type HighlightType, type Memory, type MemoryCollection } from '../types/memory';

type MemoriesTab = 'timeline' | 'calendar' | 'years' | 'collections' | 'favorites' | 'flashbacks' | 'highlights' | 'archive';

const TABS: { id: MemoriesTab; label: string; icon: typeof GitCommitVertical }[] = [
  { id: 'timeline', label: 'Timeline', icon: GitCommitVertical },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'years', label: 'Years', icon: CalendarRange },
  { id: 'collections', label: 'Collections', icon: FolderHeart },
  { id: 'favorites', label: 'Favorites', icon: Heart },
  { id: 'flashbacks', label: 'Flashbacks', icon: Sparkles },
  { id: 'highlights', label: 'Highlights', icon: Flame },
  { id: 'archive', label: 'Archive', icon: Archive },
];

const HIGHLIGHT_TYPES: HighlightType[] = ['best_month', 'most_viewed', 'most_reacted'];

// The emotional heart of the app once someone's accumulated months and
// years of memories — a journal/scrapbook, not a profile grid. Every
// unlocked Capsule and expired Moment lives here, forever, across eight
// ways of looking back at them.
export const MemoriesPage: React.FC = () => {
  const { getMemories, getCollections, getFlashbacks, getArchivedMemories } = useMemories();
  const [tab, setTab] = useState<MemoriesTab>('timeline');
  const [collections, setCollections] = useState<MemoryCollection[]>([]);
  const [collectionsKey, setCollectionsKey] = useState(0);
  const [favorites, setFavorites] = useState<Memory[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(true);
  const [flashbacks, setFlashbacks] = useState<Flashback[]>([]);
  const [flashbacksLoading, setFlashbacksLoading] = useState(true);
  const [archived, setArchived] = useState<Memory[]>([]);
  const [archivedLoading, setArchivedLoading] = useState(true);
  const [recentlyUnlocked, setRecentlyUnlocked] = useState<Memory[]>([]);
  const [lockedUntilLater, setLockedUntilLater] = useState<Memory[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(true);

  useEffect(() => { getCollections().then(setCollections); }, [getCollections, collectionsKey]);

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

  useEffect(() => {
    if (tab !== 'favorites') return;
    setFavoritesLoading(true);
    getMemories({ ...EMPTY_MEMORY_FILTERS, favoritesOnly: true }, 'newest', 50, 0).then(data => { setFavorites(data); setFavoritesLoading(false); });
  }, [tab, getMemories]);

  useEffect(() => {
    if (tab !== 'flashbacks') return;
    setFlashbacksLoading(true);
    getFlashbacks().then(data => { setFlashbacks(data); setFlashbacksLoading(false); });
  }, [tab, getFlashbacks]);

  useEffect(() => {
    if (tab !== 'archive') return;
    setArchivedLoading(true);
    getArchivedMemories(50, 0).then(data => { setArchived(data); setArchivedLoading(false); });
  }, [tab, getArchivedMemories]);

  const dismissFlashbackCard = useCallback((id: string) => {
    setTimeout(() => setFlashbacks(prev => prev.filter(f => f.id !== id)), 300);
  }, []);

  return (
    <div className="flex flex-col gap-4 -mx-4 px-4 -mt-6 pt-6 pb-6 bg-gradient-to-b from-purple-50/60 via-transparent to-transparent min-h-[calc(100vh-4rem)]">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Memories</h1>
        <p className="text-sm text-gray-500 mt-0.5">Every memory you've ever unlocked, in one place, forever.</p>
      </div>

      <div role="tablist" aria-label="Memories views" className="flex bg-white/70 backdrop-blur-xl rounded-xl p-1 gap-1 border border-white/60 shadow-sm overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={[
              'flex items-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0',
              tab === id ? 'bg-gradient-to-r from-purple-600 to-blue-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-800',
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
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/60 shadow-sm p-4 flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                <Unlock size={15} className="text-purple-500" aria-hidden="true" />
                Recently Unlocked
              </h2>
              <ListView memories={recentlyUnlocked} />
            </div>
          )}

          {!overviewLoading && lockedUntilLater.length > 0 && (
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/60 shadow-sm p-4 flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
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

      {tab === 'collections' && (
        <CollectionGrid collections={collections} onCollectionsChanged={() => setCollectionsKey(k => k + 1)} />
      )}

      {tab === 'favorites' && (
        favoritesLoading ? (
          <div className="h-32 rounded-2xl bg-white/60 animate-pulse" />
        ) : favorites.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/60 shadow-sm">
            <EmptyState icon={Heart} title="No favorites yet" description="Tap the heart on any memory to keep it close." />
          </div>
        ) : (
          <TimelineView memories={favorites} />
        )
      )}

      {tab === 'flashbacks' && (
        flashbacksLoading ? (
          <div className="h-24 rounded-2xl bg-white/60 animate-pulse" />
        ) : flashbacks.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/60 shadow-sm">
            <EmptyState icon={Sparkles} title="Nothing to look back on today" description="Come back another day — flashbacks appear once you have memories from a year or more ago." />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {flashbacks.map(f => <FlashbackCard key={`${f.memory_type}-${f.id}`} flashback={f} onDismissed={dismissFlashbackCard} />)}
          </div>
        )
      )}

      {tab === 'highlights' && (
        <div className="flex flex-col gap-3">
          {HIGHLIGHT_TYPES.map(type => <HighlightCard key={type} type={type} />)}
        </div>
      )}

      {tab === 'archive' && (
        archivedLoading ? (
          <div className="h-32 rounded-2xl bg-white/60 animate-pulse" />
        ) : archived.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/60 shadow-sm">
            <EmptyState icon={Archive} title="Nothing archived" description="Memories you hide show up here — nothing is ever truly gone unless you delete it permanently." />
          </div>
        ) : (
          <TimelineView memories={archived} />
        )
      )}
    </div>
  );
};
