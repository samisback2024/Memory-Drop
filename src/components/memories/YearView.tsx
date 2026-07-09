import React, { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useMemories } from '../../hooks/useMemories';
import { TimelineView } from './TimelineView';
import { EmptyState } from '../ui/EmptyState';
import { CalendarRange } from 'lucide-react';
import { EMPTY_MEMORY_FILTERS, type Memory } from '../../types/memory';

// Every year you've made memories in, newest first, each expandable
// in place rather than navigating away — "2026 · 14 memories" reads
// like a shelf of yearbooks.
export const YearView: React.FC = () => {
  const { getMemoryYearCounts, getMemories } = useMemories();
  const [years, setYears] = useState<{ year: number; memory_count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [openYear, setOpenYear] = useState<number | null>(null);
  const [yearMemories, setYearMemories] = useState<Record<number, Memory[]>>({});

  useEffect(() => {
    getMemoryYearCounts().then(rows => { setYears(rows); setLoading(false); });
  }, [getMemoryYearCounts]);

  const toggleYear = async (year: number) => {
    if (openYear === year) { setOpenYear(null); return; }
    setOpenYear(year);
    if (!yearMemories[year]) {
      const data = await getMemories({ ...EMPTY_MEMORY_FILTERS, year }, 'newest', 100, 0);
      setYearMemories(prev => ({ ...prev, [year]: data }));
    }
  };

  if (loading) {
    return <div className="flex flex-col gap-3">{[0, 1, 2].map(i => <div key={i} className="h-16 rounded-2xl bg-white/60 animate-pulse" />)}</div>;
  }

  if (years.length === 0) {
    return (
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/60 shadow-sm">
        <EmptyState icon={CalendarRange} title="No years yet" description="Your memories will group themselves here as they arrive." />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {years.map(({ year, memory_count }) => (
        <div key={year} className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/60 shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => toggleYear(year)}
            className="w-full flex items-center justify-between p-4"
          >
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent">{year}</span>
              <span className="text-xs text-gray-400">{memory_count} {memory_count === 1 ? 'memory' : 'memories'}</span>
            </div>
            <ChevronDown size={16} className={`text-gray-400 transition-transform ${openYear === year ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
          {openYear === year && (
            <div className="px-4 pb-4">
              {yearMemories[year] ? <TimelineView memories={yearMemories[year]} /> : <div className="h-20 rounded-xl bg-gray-50 animate-pulse" />}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
