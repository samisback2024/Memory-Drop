import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemories } from '../../hooks/useMemories';
import { ListView } from './ListView';
import { EmptyState } from '../ui/EmptyState';
import { CalendarDays } from 'lucide-react';
import { MONTH_NAMES, EMPTY_MEMORY_FILTERS, type Memory } from '../../types/memory';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// A month grid with a dot on any day that has at least one memory —
// tapping a day shows just that day's memories underneath, rather than
// navigating away.
export const MemoryCalendar: React.FC = () => {
  const { getMemoryCalendar, getMemories } = useMemories();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [indicators, setIndicators] = useState<Record<number, number>>({});
  const [monthMemories, setMonthMemories] = useState<Memory[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSelectedDay(null);
    Promise.all([
      getMemoryCalendar(year, month),
      getMemories({ ...EMPTY_MEMORY_FILTERS, year, month }, 'newest', 200, 0),
    ]).then(([dayMap, memories]) => {
      if (cancelled) return;
      setIndicators(dayMap);
      setMonthMemories(memories);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [year, month, getMemoryCalendar, getMemories]);

  const goPrevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const goNextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const dayMemories = selectedDay ? monthMemories.filter(m => new Date(m.created_at).getDate() === selectedDay) : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/60 shadow-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <button type="button" onClick={goPrevMonth} aria-label="Previous month" className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <p className="text-sm font-semibold text-gray-900">{MONTH_NAMES[month - 1]} {year}</p>
          <button type="button" onClick={goNextMonth} aria-label="Next month" className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors">
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="flex items-center justify-center gap-3 mb-2">
          {[year - 1, year, year + 1].map(y => (
            <button
              key={y}
              type="button"
              onClick={() => setYear(y)}
              className={`text-xs px-2 py-1 rounded-lg transition-colors ${y === year ? 'bg-purple-100 text-purple-700 font-medium' : 'text-gray-400 hover:text-gray-700'}`}
            >
              {y}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 text-center mb-1">
          {WEEKDAY_LABELS.map((d, i) => <span key={i} className="text-[10px] text-gray-400 font-medium">{d}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (day === null) return <div key={i} />;
            const hasMemories = Boolean(indicators[day]);
            const isSelected = selectedDay === day;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setSelectedDay(isSelected ? null : day)}
                disabled={!hasMemories}
                className={[
                  'aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5 text-xs transition-colors',
                  isSelected ? 'bg-gradient-to-br from-purple-600 to-blue-500 text-white font-semibold' : hasMemories ? 'text-gray-900 hover:bg-purple-50' : 'text-gray-300',
                ].join(' ')}
              >
                {day}
                {hasMemories && <span className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-purple-500'}`} />}
              </button>
            );
          })}
        </div>
      </div>

      {loading && <div className="h-24 rounded-2xl bg-white/60 animate-pulse" />}

      {!loading && selectedDay && (
        dayMemories.length > 0 ? (
          <ListView memories={dayMemories} />
        ) : (
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/60 shadow-sm">
            <EmptyState icon={CalendarDays} title="Nothing on this day" description="No memories from this date yet." />
          </div>
        )
      )}
    </div>
  );
};
