import React from 'react';
import { Award, Trophy } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';
import { Skeleton } from '../ui/Skeleton';

// No badge or achievement system exists yet — these are placeholder
// sections per the Phase 2 spec, ready for Phase 3+ to fill in.
export const BadgesAndAchievements: React.FC = React.memo(() => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Badges</h2>
      <EmptyState icon={Award} title="No badges yet" description="Badges you earn will show up here." />
    </div>
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Achievements</h2>
      <EmptyState icon={Trophy} title="No achievements yet" description="Milestones you unlock will show up here." />
    </div>
  </div>
));

BadgesAndAchievements.displayName = 'BadgesAndAchievements';

export const BadgesAndAchievementsSkeleton: React.FC = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" aria-hidden="true">
    {[0, 1].map(i => (
      <div key={i} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
        <Skeleton className="h-4 w-20 mb-4" />
        <div className="flex flex-col items-center gap-2 py-6">
          <Skeleton className="w-10 h-10" rounded="2xl" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    ))}
  </div>
);
