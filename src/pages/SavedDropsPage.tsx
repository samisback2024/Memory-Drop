import React, { useCallback, useEffect, useState } from 'react';
import { useDrops } from '../hooks/useDrops';
import { Feed } from '../components/feed/Feed';
import type { Drop } from '../types/feed';

const PAGE_SIZE = 10;

export const SavedDropsPage: React.FC = () => {
  const { getSavedDrops } = useDrops();
  const [drops, setDrops] = useState<Drop[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    getSavedDrops(PAGE_SIZE, 0).then(data => {
      setDrops(data);
      setOffset(data.length);
      setHasMore(data.length === PAGE_SIZE);
      setLoading(false);
    });
  }, [getSavedDrops]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const data = await getSavedDrops(PAGE_SIZE, offset);
    setDrops(prev => [...prev, ...data]);
    setOffset(prev => prev + data.length);
    setHasMore(data.length === PAGE_SIZE);
    setLoadingMore(false);
  }, [loadingMore, hasMore, offset, getSavedDrops]);

  const removeDrop = (dropId: string) => setDrops(prev => prev.filter(d => d.id !== dropId));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-bold text-gray-900">Saved memories</h1>
      <Feed
        drops={drops}
        loading={loading}
        hasMore={hasMore}
        loadingMore={loadingMore}
        onLoadMore={loadMore}
        onDeleted={removeDrop}
        onHidden={removeDrop}
        onUnsaved={removeDrop}
        emptyVariant="saved"
      />
    </div>
  );
};
