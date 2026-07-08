import React, { useCallback, useEffect, useState } from 'react';
import { useFeed } from '../hooks/useFeed';
import { Feed } from '../components/feed/Feed';
import type { FeedPost } from '../types/feed';

const PAGE_SIZE = 10;

export const SavedPostsPage: React.FC = () => {
  const { getSavedPosts } = useFeed();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    getSavedPosts(PAGE_SIZE, 0).then(data => {
      setPosts(data);
      setOffset(data.length);
      setHasMore(data.length === PAGE_SIZE);
      setLoading(false);
    });
  }, [getSavedPosts]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const data = await getSavedPosts(PAGE_SIZE, offset);
    setPosts(prev => [...prev, ...data]);
    setOffset(prev => prev + data.length);
    setHasMore(data.length === PAGE_SIZE);
    setLoadingMore(false);
  }, [loadingMore, hasMore, offset, getSavedPosts]);

  const removePost = (postId: string) => setPosts(prev => prev.filter(p => p.id !== postId));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold text-gray-900">Saved posts</h1>
      <Feed
        posts={posts}
        loading={loading}
        hasMore={hasMore}
        loadingMore={loadingMore}
        onLoadMore={loadMore}
        onDeleted={removePost}
        onHidden={removePost}
        onUnsaved={removePost}
        emptyVariant="saved"
      />
    </div>
  );
};
