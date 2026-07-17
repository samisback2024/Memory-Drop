import React, { useMemo } from 'react';
import { MemoryCard } from './MemoryCard';
import type { Memory } from '../../types/memory';

// A connecting rail down the left edge with a year marker whenever the
// year changes between consecutive memories — the same visual language
// as CapsuleTimeline, now spanning both content types at once.
export const TimelineView: React.FC<{ memories: Memory[] }> = ({ memories }) => {
  const withYearMarkers = useMemo(() => {
    let lastYear: number | null = null;
    return memories.map(m => {
      const year = new Date(m.created_at).getFullYear();
      const showYear = year !== lastYear;
      lastYear = year;
      return { memory: m, year, showYear };
    });
  }, [memories]);

  return (
    <div className="flex flex-col gap-4">
      {withYearMarkers.map(({ memory, year, showYear }) => (
        <React.Fragment key={`${memory.memory_type}-${memory.id}`}>
          {showYear && (
            <div className="flex items-center gap-3 px-1">
              <span className="text-xs font-semibold text-gray-400 tracking-wide">{year}</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
          )}
          <div className="flex gap-3">
            <div className="flex flex-col items-center w-5 flex-shrink-0 pt-6" aria-hidden="true">
              <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 ring-4 ring-gray-50 shadow-sm flex-shrink-0" />
              <div className="w-px flex-1 bg-gradient-to-b from-purple-200 to-transparent mt-1" />
            </div>
            <div className="flex-1 min-w-0">
              <MemoryCard memory={memory} variant="timeline" />
            </div>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
};
