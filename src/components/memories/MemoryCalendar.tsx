import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, Unlock, Star, CalendarDays } from 'lucide-react';
import { useMemories } from '../../hooks/useMemories';
import { MemoryCard } from './MemoryCard';
import { EmptyState } from '../ui/EmptyState';
import { MONTH_NAMES, type MemoryActivity, type MemoryActivityType } from '../../types/memory';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const ACTIVITY_META: Record<MemoryActivityType, { icon: typeof Sparkles; label: string }> = {
  dropped: { icon: Sparkles, label: 'Dropped' },
  unlocked: { icon: Unlock, label: 'Unlocked' },
  saved: { icon: Star, label: 'Saved to unlock' },
};

// A month grid with a dot on any day with activity — dropping something,
// something unlocking (yours, an orbit's, or a public account's — past
// or still-upcoming), or saving a Drop to unlock later. Tapping a day
// fetches just that day's activity and groups it by type underneath,
// rather than pre-loading the whole month client-side.
export const MemoryCalendar: React.FC = () => {
  const { getMemoryActivityCalendar, getMemoryActivityDay } = useMemories();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [indicators, setIndicators] = useState<Record<number, MemoryActivityType[]>>({});
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [dayActivities, setDayActivities] = useState<MemoryActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [dayLoading, setDayLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSelectedDay(null);
    getMemoryActivityCalendar(year, month).then(map => {
      if (cancelled) return;
      setIndicators(map);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [year, month, getMemoryActivityCalendar]);

  const goPrevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const goNextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const selectDay = (day: number) => {
    if (selectedDay === day) { setSelectedDay(null); return; }
    setSelectedDay(day);
    setDayLoading(true);
    getMemoryActivityDay(year, month, day).then(items => {
      setDayActivities(items);
      setDayLoading(false);
    });
  };

  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const groups: Array<{ type: MemoryActivityType; items: MemoryActivity[] }> = (['dropped', 'unlocked', 'saved'] as const)
    .map(type => ({ type, items: dayActivities.filter(a => a.activity_type === type) }))
    .filter(g => g.items.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-gray-800/60 shadow-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <button type="button" onClick={goPrevMonth} aria-label="Previous month" className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{MONTH_NAMES[month - 1]} {year}</p>
          <button type="button" onClick={goNextMonth} aria-label="Next month" className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="flex items-center justify-center gap-3 mb-2">
          {[year - 1, year, year + 1].map(y => (
            <button
              key={y}
              type="button"
              onClick={() => setYear(y)}
              className={`text-xs px-2 py-1 rounded-lg transition-colors ${y === year ? 'bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-medium' : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              {y}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 text-center mb-1">
          {WEEKDAY_LABELS.map((d, i) => <span key={i} className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">{d}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (day === null) return <div key={i} />;
            const types = indicators[day];
            const hasActivity = Boolean(types?.length);
            const isSelected = selectedDay === day;
            return (
              <button
                key={i}
                type="button"
                onClick={() => selectDay(day)}
                disabled={!hasActivity}
                className={[
                  'aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5 text-xs transition-colors',
                  isSelected ? 'bg-gradient-to-br from-purple-600 to-blue-500 text-white font-semibold' : hasActivity ? 'text-gray-900 dark:text-gray-100 hover:bg-purple-50 dark:hover:bg-purple-950/40' : 'text-gray-300 dark:text-gray-700',
                ].join(' ')}
              >
                {day}
                {hasActivity && (
                  <span className="flex items-center gap-0.5">
                    {types!.slice(0, 3).map(t => (
                      <span key={t} className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-purple-500'}`} />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {loading && <div className="h-24 rounded-2xl bg-white/60 dark:bg-gray-900/60 animate-pulse" />}

      {!loading && selectedDay && (
        dayLoading ? (
          <div className="h-24 rounded-2xl bg-white/60 dark:bg-gray-900/60 animate-pulse" />
        ) : groups.length > 0 ? (
          <div className="flex flex-col gap-3">
            {groups.map(group => {
              const { icon: Icon, label } = ACTIVITY_META[group.type];
              return (
                <div key={group.type} className="flex flex-col gap-1.5">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 px-1">
                    <Icon size={13} aria-hidden="true" /> {label}
                  </p>
                  <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-gray-800/60 shadow-sm px-3">
                    {group.items.map(item => (
                      <MemoryCard key={`${group.type}-${item.memory_type}-${item.id}`} memory={item} variant="list" />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-gray-800/60 shadow-sm">
            <EmptyState icon={CalendarDays} title="Nothing on this day" description="No activity from this date yet." />
          </div>
        )
      )}
    </div>
  );
};
