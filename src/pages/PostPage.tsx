import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FileX } from 'lucide-react';
import { useFeed } from '../hooks/useFeed';
import { PublicPageHeader } from '../components/layout/PublicPageHeader';
import { PostCard } from '../components/feed/PostCard';
import { FeedSkeleton } from '../components/feed/FeedSkeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import type { FeedPost } from '../types/feed';

type FetchState = 'loading' | 'ready' | 'not_found' | 'error';

// Exists mainly so ShareModal's "Copy link" has a real destination —
// renders the same PostCard the feed uses, just for one post.
export const PostPage: React.FC = () => {
  const { postId } = useParams<{ postId: string }>();
  const { getPost } = useFeed();
  const [post, setPost] = useState<FeedPost | null>(null);
  const [state, setState] = useState<FetchState>('loading');

  const load = useCallback(async () => {
    if (!postId) return;
    setState('loading');
    const data = await getPost(postId);
    if (!data) {
      setState('not_found');
      return;
    }
    setPost(data);
    setState('ready');
  }, [postId, getPost]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicPageHeader title="Post" />
      <main className="max-w-2xl mx-auto px-4 py-6">
        {state === 'loading' && <FeedSkeleton count={1} />}
        {state === 'not_found' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <EmptyState icon={FileX} title="Post not found" description="This post may have been deleted, or you don't have permission to view it." />
          </div>
        )}
        {state === 'error' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <ErrorState title="Couldn't load this post" description="Check your connection and try again." onRetry={load} />
          </div>
        )}
        {state === 'ready' && post && (
          <PostCard post={post} onDeleted={() => setState('not_found')} onHidden={() => setState('not_found')} />
        )}
      </main>
    </div>
  );
};
