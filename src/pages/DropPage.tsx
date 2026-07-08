import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FileX } from 'lucide-react';
import { useDrops } from '../hooks/useDrops';
import { PublicPageHeader } from '../components/layout/PublicPageHeader';
import { DropCard } from '../components/feed/DropCard';
import { FeedSkeleton } from '../components/feed/FeedSkeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import type { Drop } from '../types/feed';

type FetchState = 'loading' | 'ready' | 'not_found' | 'error';

// Exists mainly so ShareModal's "Copy link" has a real destination —
// renders the same DropCard the feed uses, just for one drop.
export const DropPage: React.FC = () => {
  const { dropId } = useParams<{ dropId: string }>();
  const { getDrop } = useDrops();
  const [drop, setDrop] = useState<Drop | null>(null);
  const [state, setState] = useState<FetchState>('loading');

  const load = useCallback(async () => {
    if (!dropId) return;
    setState('loading');
    const data = await getDrop(dropId);
    if (!data) {
      setState('not_found');
      return;
    }
    setDrop(data);
    setState('ready');
  }, [dropId, getDrop]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50/60 via-gray-50 to-gray-50">
      <PublicPageHeader title="Memory Drop" />
      <main className="max-w-2xl mx-auto px-4 py-6">
        {state === 'loading' && <FeedSkeleton count={1} />}
        {state === 'not_found' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <EmptyState icon={FileX} title="Drop not found" description="This memory may have been deleted, or you don't have permission to view it." />
          </div>
        )}
        {state === 'error' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <ErrorState title="Couldn't load this drop" description="Check your connection and try again." onRetry={load} />
          </div>
        )}
        {state === 'ready' && drop && (
          <DropCard drop={drop} onDeleted={() => setState('not_found')} onHidden={() => setState('not_found')} />
        )}
      </main>
    </div>
  );
};
