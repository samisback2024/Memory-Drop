import React, { useEffect, useMemo, useState } from 'react';
import { X, Plus, Sparkles, PackageOpen } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useMoments } from '../../hooks/useMoments';
import { Avatar } from '../ui/Avatar';
import { MomentViewer } from './MomentViewer';
import { groupMomentTrayItems, seededFraction } from '../../utils/moments';
import type { MomentTrayItem } from '../../types/moment';

interface MomentPileGroundProps {
  onClose: () => void;
  onCreate: () => void;
  onViewed?: () => void;
  refreshKey?: number;
}

// The "big ground" MomentPileButton opens: every open moment piled up
// as its own glossy capsule instead of a row of avatars. Deliberately a
// one-time pile rather than a persistent list — once you've watched
// everything an author has right now, their capsule plays a quick
// "cracked open and gone" animation and drops out of the pile for the
// rest of this visit, same spirit as the moment itself expiring. Your
// own capsule (to review or add more) and the Add capsule always stay.
export const MomentPileGround: React.FC<MomentPileGroundProps> = ({ onClose, onCreate, onViewed, refreshKey }) => {
  const { user } = useAuth();
  const { getMomentsTray } = useMoments();
  const [items, setItems] = useState<MomentTrayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingAuthor, setViewingAuthor] = useState<string | null>(null);
  const [leavingUserId, setLeavingUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMomentsTray().then(data => { if (!cancelled) { setItems(data); setLoading(false); } });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const groups = useMemo(() => {
    const all = groupMomentTrayItems(items);
    // Only ever show authors with something you haven't seen yet — an
    // already-fully-viewed author has no business piling up in a "watch
    // what's new" view. Your own capsule is the one exception, since
    // it's also how you get back in to add another moment.
    return all.filter(g => g.hasUnviewed || g.userId === user?.id);
  }, [items, user?.id]);

  const handleCloseViewer = async () => {
    const authorId = viewingAuthor;
    setViewingAuthor(null);
    if (!authorId) return;
    const fresh = await getMomentsTray();
    const freshGroups = groupMomentTrayItems(fresh);
    const stillUnviewed = freshGroups.find(g => g.userId === authorId)?.hasUnviewed ?? false;
    if (authorId !== user?.id && !stillUnviewed) {
      // Keep the old (still-unviewed) data live for one more render so
      // the capsule can play its exit animation before it's actually
      // dropped from the pile — swapping `items` immediately would just
      // make it vanish with no transition.
      setLeavingUserId(authorId);
      setTimeout(() => { setItems(fresh); setLeavingUserId(null); }, 650);
    } else {
      setItems(fresh);
    }
    onViewed?.();
  };

  return (
    <div
      // Below Modal's z-50 (CreateMomentModal, opened from the Add
      // capsule, needs to sit on top of the ground, not under it) and
      // MomentViewer's z-70, but above the base app chrome (z-40).
      className="fixed inset-0 z-[45] flex flex-col animate-fade-in"
      style={{ background: 'radial-gradient(circle at 50% 25%, rgba(107,33,168,0.55), rgba(10,7,20,0.96) 65%)' }}
    >
      <div className="flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top)+1rem)] pb-2">
        <h1 className="text-white font-semibold flex items-center gap-1.5">
          <PackageOpen size={16} className="text-purple-300" aria-hidden="true" /> Moments
        </h1>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors tactile"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col items-center justify-end px-6 pb-10">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-label="Loading" />
          </div>
        ) : (
          <>
            {groups.length === 0 && (
              <p className="text-white/50 text-sm text-center mb-6 max-w-xs">
                Nothing new piled up right now — be the first to drop a moment.
              </p>
            )}

            <div className="relative w-full max-w-md">
              {/* The "ground" itself — a soft glowing surface the pile rests on. */}
              <div className="absolute inset-x-6 bottom-2 h-16 rounded-[50%] bg-purple-500/25 blur-2xl" aria-hidden="true" />

              <div className="relative z-10 flex flex-wrap items-end justify-center gap-4 pb-4">
                {/* Add capsule — always present, this is also how you post. */}
                <button
                  type="button"
                  onClick={onCreate}
                  aria-label="Add a moment"
                  className="flex flex-col items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:outline-none rounded-full"
                >
                  <span className="relative w-14 h-24 rounded-full border-2 border-dashed border-purple-300/70 bg-white/5 backdrop-blur-sm flex items-center justify-center animate-capsule-float tactile">
                    <Plus size={20} className="text-purple-200" aria-hidden="true" />
                  </span>
                  <span className="text-[11px] text-white/70">Add</span>
                </button>

                {groups.map(group => {
                  const isSelf = group.userId === user?.id;
                  const isLeaving = leavingUserId === group.userId;
                  const tilt = (seededFraction(group.userId) - 0.5) * 22;
                  const lift = seededFraction(group.userId + 'y') * 14;
                  const delay = seededFraction(group.userId + 'd') * 3;
                  const label = isSelf ? 'You' : group.name.split(' ')[0];

                  return (
                    <button
                      key={group.userId}
                      type="button"
                      onClick={() => setViewingAuthor(group.userId)}
                      aria-label={`View ${label}'s moments`}
                      className={[
                        'flex flex-col items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:outline-none rounded-full',
                        isLeaving ? 'animate-capsule-crack pointer-events-none' : 'animate-capsule-float',
                      ].join(' ')}
                      style={{ transform: `rotate(${tilt}deg) translateY(-${lift}px)`, animationDelay: `${delay}s` }}
                    >
                      <span
                        className={[
                          'relative w-14 h-24 rounded-full flex items-end justify-center pb-2 overflow-hidden tactile shadow-[0_14px_28px_-10px_rgba(124,58,237,0.6)]',
                          isSelf
                            ? 'bg-gradient-to-b from-blue-300 via-blue-500 to-purple-600'
                            : 'bg-gradient-to-b from-purple-300 via-fuchsia-500 to-blue-600',
                        ].join(' ')}
                      >
                        <span className="absolute -top-1 left-2 w-7 h-9 rounded-full bg-white/40 blur-[3px] rotate-[-18deg]" aria-hidden="true" />
                        <Sparkles size={9} className="absolute top-2 right-1.5 text-white/80 animate-sparkle-twinkle" style={{ animationDelay: `${delay}s` }} aria-hidden="true" />
                        <Avatar src={group.photoUrl} name={group.name} size="sm" className="border-2 border-white/80 relative" />
                      </span>
                      <span className="text-[11px] text-white/80 truncate max-w-[4rem]">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {viewingAuthor && <MomentViewer authorUserId={viewingAuthor} onClose={handleCloseViewer} />}
    </div>
  );
};
