import React from 'react';
import { Skeleton } from '../ui/Skeleton';

// Shared by ProfilePage (own profile, while auth/session is resolving) and
// PublicProfilePage (someone else's, while the RPC call is in flight) —
// same layout either way, so one skeleton covers both.
export const ProfileHeaderSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden" aria-hidden="true">
    <div className="relative h-32 sm:h-40 md:h-48">
      <Skeleton className="w-full h-full" rounded="md" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
        <Skeleton className="w-24 h-24 border-4 border-white dark:border-gray-900" rounded="2xl" />
      </div>
    </div>
    <div className="px-5 pt-3 pb-5">
      <Skeleton className="h-5 w-40 mb-2 mt-1" />
      <Skeleton className="h-4 w-24 mb-3" />
      <Skeleton className="h-4 w-full max-w-sm mb-4" />
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-y-3 gap-x-2 py-3 border-t border-b border-gray-100 dark:border-gray-800">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <Skeleton className="h-4 w-6" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
    </div>
  </div>
);
