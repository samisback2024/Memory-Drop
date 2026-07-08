import React from 'react';
import { Skeleton } from '../ui/Skeleton';

const PostCardSkeleton: React.FC = () => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
    <div className="flex items-center gap-3 p-4">
      <Skeleton className="w-10 h-10" rounded="full" />
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
    <Skeleton className="w-full h-80" rounded="md" />
    <div className="p-4 flex flex-col gap-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-3.5 w-full" />
      <Skeleton className="h-3.5 w-2/3" />
    </div>
  </div>
);

export const FeedSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <div className="flex flex-col gap-4" aria-hidden="true">
    {Array.from({ length: count }).map((_, i) => <PostCardSkeleton key={i} />)}
  </div>
);
