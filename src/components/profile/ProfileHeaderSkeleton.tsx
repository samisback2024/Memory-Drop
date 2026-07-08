import React from 'react';
import { Skeleton } from '../ui/Skeleton';

// Shared by ProfilePage (own profile, while auth/session is resolving) and
// PublicProfilePage (someone else's, while the RPC call is in flight) —
// same layout either way, so one skeleton covers both.
export const ProfileHeaderSkeleton: React.FC = () => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden" aria-hidden="true">
    <Skeleton className="h-32 sm:h-40 md:h-48 w-full" rounded="md" />
    <div className="px-5 pb-5">
      <div className="flex items-end justify-between -mt-10 mb-4">
        <Skeleton className="w-24 h-24 border-4 border-white" rounded="full" />
        <Skeleton className="w-28 h-9" rounded="xl" />
      </div>
      <Skeleton className="h-5 w-40 mb-2" />
      <Skeleton className="h-4 w-24 mb-3" />
      <Skeleton className="h-4 w-full max-w-sm mb-4" />
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-y-3 gap-x-2 py-3 border-t border-b border-gray-100">
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
