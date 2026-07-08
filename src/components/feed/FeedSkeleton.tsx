import React from 'react';
import { Skeleton } from '../ui/Skeleton';

const DropCardSkeleton: React.FC = () => (
  <div className="flex gap-3">
    <div className="flex flex-col items-center w-5 flex-shrink-0 pt-6">
      <Skeleton className="w-2.5 h-2.5" rounded="full" />
      <div className="w-px flex-1 bg-gray-100 mt-1" />
    </div>
    <div className="flex-1 bg-white/80 backdrop-blur-xl rounded-2xl border border-white/60 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <Skeleton className="w-10 h-10" rounded="full" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="px-4 pb-3">
        <Skeleton className="w-full h-32" rounded="2xl" />
      </div>
      <div className="px-4 pb-4 flex items-center gap-4">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-14" />
        <Skeleton className="h-4 w-10" />
      </div>
    </div>
  </div>
);

export const FeedSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <div className="flex flex-col gap-4" aria-hidden="true">
    {Array.from({ length: count }).map((_, i) => <DropCardSkeleton key={i} />)}
  </div>
);
