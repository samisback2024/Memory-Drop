import React from 'react';
import { PostCard } from './PostCard';
import { FeedSkeleton } from './FeedSkeleton';
import { EmptyFeed } from './EmptyFeed';
import { InfiniteLoader } from './InfiniteLoader';
import type { FeedPost, FeedTab } from '../../types/feed';

interface FeedProps {
  posts: FeedPost[];
  loading: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onDeleted: (postId: string) => void;
  onHidden: (postId: string) => void;
  onUnsaved?: (postId: string) => void;
  emptyVariant: FeedTab | 'saved';
}

export const Feed: React.FC<FeedProps> = ({ posts, loading, hasMore, loadingMore, onLoadMore, onDeleted, onHidden, onUnsaved, emptyVariant }) => {
  if (loading) return <FeedSkeleton />;
  if (posts.length === 0) return <EmptyFeed variant={emptyVariant} />;

  return (
    <div className="flex flex-col gap-4">
      {posts.map(post => (
        <PostCard key={post.id} post={post} onDeleted={onDeleted} onHidden={onHidden} onUnsaved={onUnsaved} />
      ))}
      <InfiniteLoader hasMore={hasMore} loading={loadingMore} onLoadMore={onLoadMore} />
    </div>
  );
};
