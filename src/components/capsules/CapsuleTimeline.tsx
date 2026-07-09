import React, { useMemo } from 'react';
import { CapsuleCard } from './CapsuleCard';
import type { Capsule } from '../../types/capsule';

interface CapsuleTimelineProps {
  capsules: Capsule[];
  onDeleted: (capsuleId: string) => void;
}

// A connecting rail down the left edge, same visual language as the
// Drops feed, with a small year marker whenever the unlock year changes
// between consecutive capsules — your own path through time, not a flat
// list.
export const CapsuleTimeline: React.FC<CapsuleTimelineProps> = ({ capsules, onDeleted }) => {
  const withYearMarkers = useMemo(() => {
    let lastYear: number | null = null;
    return capsules.map(c => {
      const year = new Date(c.unlock_date).getFullYear();
      const showYear = year !== lastYear;
      lastYear = year;
      return { capsule: c, year, showYear };
    });
  }, [capsules]);

  return (
    <div className="flex flex-col gap-4">
      {withYearMarkers.map(({ capsule, year, showYear }) => (
        <React.Fragment key={capsule.id}>
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
              <CapsuleCard capsule={capsule} onDeleted={onDeleted} />
            </div>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
};
