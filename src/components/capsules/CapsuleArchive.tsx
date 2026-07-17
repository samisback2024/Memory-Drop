import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Archive } from 'lucide-react';
import { useCapsules } from '../../hooks/useCapsules';
import { CapsuleFilters } from './CapsuleFilters';
import { CapsuleTimeline } from './CapsuleTimeline';
import { EmptyState } from '../ui/EmptyState';
import { EMPTY_CAPSULE_FILTERS, type Capsule, type CapsuleArchiveFilters } from '../../types/capsule';

const PAGE_SIZE = 15;

interface CapsuleArchiveProps {
  userId: string;
  isOwnArchive?: boolean;
}

// The default browsing surface for capsules — no live feed tabs the way
// Drops has, since a vault is inherently personal. Filters + search only
// ever apply to your own archive (the RPC itself restricts search to the
// caller's own capsules), someone else's visible capsules just render
// as a plain chronological timeline.
export const CapsuleArchive: React.FC<CapsuleArchiveProps> = ({ userId, isOwnArchive = false }) => {
  const { getUserCapsules } = useCapsules();
  const [filters, setFilters] = useState<CapsuleArchiveFilters>(EMPTY_CAPSULE_FILTERS);
  const [capsules, setCapsules] = useState<Capsule[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  // Bug fix (Phase 13 bug bash): `load` is memoized on [userId, filters,
  // getUserCapsules] only, so reading `capsules.length` directly inside
  // it closed over a stale, frozen-at-creation array — every "Load more"
  // click computed offset from that stale length (usually 0), re-
  // fetching the same first page forever instead of advancing. A ref
  // that's always current sidesteps the staleness without forcing `load`
  // to be recreated (and the initial-load effect to re-fire) on every
  // page received.
  const capsulesRef = useRef<Capsule[]>([]);
  useEffect(() => { capsulesRef.current = capsules; }, [capsules]);

  const load = useCallback(async (reset: boolean) => {
    if (reset) setLoading(true); else setLoadingMore(true);
    const offset = reset ? 0 : capsulesRef.current.length;
    const data = await getUserCapsules(userId, filters, PAGE_SIZE, offset);
    setCapsules(prev => (reset ? data : [...prev, ...data]));
    setHasMore(data.length === PAGE_SIZE);
    setLoading(false);
    setLoadingMore(false);
  }, [userId, filters, getUserCapsules]);

  useEffect(() => { load(true); }, [userId, filters, getUserCapsules]); // eslint-disable-line react-hooks/exhaustive-deps

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const span = Array.from({ length: 7 }, (_, i) => currentYear - 1 + i);
    return span;
  }, []);

  const removeCapsule = (capsuleId: string) => setCapsules(prev => prev.filter(c => c.id !== capsuleId));

  return (
    <div className="flex flex-col gap-4">
      <CapsuleFilters filters={filters} onChange={setFilters} years={years} showSearch={isOwnArchive} />

      {loading ? (
        <div className="flex flex-col gap-4">
          {[0, 1, 2].map(i => <div key={i} className="h-40 rounded-2xl bg-white/60 animate-pulse" />)}
        </div>
      ) : capsules.length === 0 ? (
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/60 shadow-sm">
          <EmptyState
            icon={Archive}
            title={isOwnArchive ? 'No capsules yet' : 'No capsules to show'}
            description={isOwnArchive ? 'Create your first Time Capsule — a memory you send into the future.' : "Nothing here is visible to you yet."}
          />
        </div>
      ) : (
        <>
          <CapsuleTimeline capsules={capsules} onDeleted={removeCapsule} />
          {hasMore && (
            <button
              type="button"
              onClick={() => load(false)}
              disabled={loadingMore}
              className="self-center flex items-center gap-2 text-sm font-medium text-purple-600 hover:text-purple-700 disabled:opacity-50 py-2"
            >
              {loadingMore && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              Load more
            </button>
          )}
        </>
      )}
    </div>
  );
};
