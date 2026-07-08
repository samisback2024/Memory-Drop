import React from 'react';
import { DropCard } from './DropCard';
import { FeedSkeleton } from './FeedSkeleton';
import { EmptyDropState } from './EmptyDropState';
import { InfiniteLoader } from './InfiniteLoader';
import type { Drop, DropTab } from '../../types/feed';

interface FeedProps {
  drops: Drop[];
  loading: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onDeleted: (dropId: string) => void;
  onHidden: (dropId: string) => void;
  onUnsaved?: (dropId: string) => void;
  emptyVariant: DropTab | 'saved';
}

export const Feed: React.FC<FeedProps> = ({ drops, loading, hasMore, loadingMore, onLoadMore, onDeleted, onHidden, onUnsaved, emptyVariant }) => {
  if (loading) return <FeedSkeleton />;
  if (drops.length === 0) return <EmptyDropState variant={emptyVariant} />;

  return (
    <div className="flex flex-col gap-4">
      {drops.map(drop => (
        <DropCard key={drop.id} drop={drop} onDeleted={onDeleted} onHidden={onHidden} onUnsaved={onUnsaved} />
      ))}
      <InfiniteLoader hasMore={hasMore} loading={loadingMore} onLoadMore={onLoadMore} />
    </div>
  );
};
