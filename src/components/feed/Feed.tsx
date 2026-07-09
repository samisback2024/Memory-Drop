import React from 'react';
import { DropCard } from './DropCard';
import { FeedSkeleton } from './FeedSkeleton';
import { EmptyDropState } from './EmptyDropState';
import { InfiniteLoader } from './InfiniteLoader';
import { ErrorState } from '../ui/ErrorState';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
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
  onRetry?: () => void;
  emptyVariant: DropTab | 'saved';
}

// An empty result while offline is shown as a retry-able error rather
// than "nothing here" — see useOnlineStatus for why this is a
// deliberately narrow fix (real error-vs-empty reporting from the read
// hooks themselves would be a much bigger change) rather than a full
// error-surfacing rework.
export const Feed: React.FC<FeedProps> = ({ drops, loading, hasMore, loadingMore, onLoadMore, onDeleted, onHidden, onUnsaved, onRetry, emptyVariant }) => {
  const isOnline = useOnlineStatus();

  if (loading) return <FeedSkeleton />;
  if (drops.length === 0) {
    if (!isOnline && onRetry) return <ErrorState title="You're offline" description="Reconnect and try again." onRetry={onRetry} />;
    return <EmptyDropState variant={emptyVariant} />;
  }

  return (
    <div className="flex flex-col gap-4">
      {drops.map(drop => (
        <DropCard key={drop.id} drop={drop} onDeleted={onDeleted} onHidden={onHidden} onUnsaved={onUnsaved} />
      ))}
      <InfiniteLoader hasMore={hasMore} loading={loadingMore} onLoadMore={onLoadMore} />
    </div>
  );
};
