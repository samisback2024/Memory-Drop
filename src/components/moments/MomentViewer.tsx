import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, Trash2, Eye, MapPin, AtSign } from 'lucide-react';
import { useMoments } from '../../hooks/useMoments';
import { useConfirm } from '../../hooks/useConfirm';
import { Avatar } from '../ui/Avatar';
import { MomentProgressBar } from './MomentProgressBar';
import { MomentReactionBar } from './MomentReactionBar';
import { MomentReplyInput } from './MomentReplyInput';
import { MomentSeenList } from './MomentSeenList';
import { MOOD_META } from '../../types/feed';
import { formatRelativeTime } from '../../utils/date';
import type { Moment } from '../../types/moment';

const PHOTO_TEXT_DISPLAY_MS = 6000;

const formatExpiry = (expiresAt: string): string => {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'moments';
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${Math.max(minutes, 1)}m`;
};

interface MomentViewerProps {
  authorUserId: string;
  includeExpired?: boolean;
  startAtMomentId?: string;
  onClose: () => void;
}

// Deliberately scoped to one author's stack — closing (or running off
// either end) always exits back to wherever the tray/archive lives,
// rather than auto-chaining into the next person's moments the way
// Instagram does. Tap the left/right half to step back/forward, hold to
// pause.
export const MomentViewer: React.FC<MomentViewerProps> = ({ authorUserId, includeExpired, startAtMomentId, onClose }) => {
  const { getUserMoments, deleteMoment, recordMomentView } = useMoments();
  const { confirm } = useConfirm();
  const [moments, setMoments] = useState<Moment[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [seenListOpen, setSeenListOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const viewedRef = useRef<Set<string>>(new Set());
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getUserMoments(authorUserId, includeExpired).then(data => {
      if (cancelled) return;
      setMoments(data);
      const startIndex = startAtMomentId ? Math.max(0, data.findIndex(m => m.id === startAtMomentId)) : 0;
      setIndex(startIndex);
      setLoading(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorUserId]);

  const current = moments[index];

  // onClose is a plain top-level call here, not nested inside the
  // setIndex updater — calling a parent's setState from inside another
  // component's state-updater function trips React's "setState while
  // rendering a different component" warning (updater functions can be
  // invoked during render, e.g. Strict Mode's double-invoke check).
  const goNext = useCallback(() => {
    if (index >= moments.length - 1) { onClose(); return; }
    setProgress(0);
    setIndex(i => i + 1);
  }, [index, moments.length, onClose]);

  const goPrev = () => {
    if (index <= 0) { onClose(); return; }
    setProgress(0);
    setIndex(i => i - 1);
  };

  // Record the view once per moment per mount — never for your own.
  useEffect(() => {
    if (!current || current.is_owner || viewedRef.current.has(current.id)) return;
    viewedRef.current.add(current.id);
    recordMomentView(current.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  // Photo/text auto-advance on a fixed on-screen timer.
  useEffect(() => {
    if (!current || paused || current.media_type === 'video') return;
    startRef.current = performance.now() - progress * PHOTO_TEXT_DISPLAY_MS;
    const tick = () => {
      const elapsed = performance.now() - startRef.current;
      const next = Math.min(elapsed / PHOTO_TEXT_DISPLAY_MS, 1);
      setProgress(next);
      if (next >= 1) { goNext(); return; }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, paused]);

  // Video auto-advances on its own real duration instead of the fixed timer.
  useEffect(() => {
    if (!current || current.media_type !== 'video') return;
    const videoEl = videoRef.current;
    if (!videoEl) return;
    const handleTimeUpdate = () => { if (videoEl.duration) setProgress(Math.min(videoEl.currentTime / videoEl.duration, 1)); };
    const handleEnded = () => goNext();
    videoEl.addEventListener('timeupdate', handleTimeUpdate);
    videoEl.addEventListener('ended', handleEnded);
    if (paused) videoEl.pause(); else videoEl.play().catch(() => {});
    return () => {
      videoEl.removeEventListener('timeupdate', handleTimeUpdate);
      videoEl.removeEventListener('ended', handleEnded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, paused]);

  const handleDelete = async () => {
    if (!current) return;
    setPaused(true);
    const ok = await confirm({ title: 'Delete this moment?', confirmLabel: 'Delete' });
    if (!ok) { setPaused(false); return; }
    setDeleting(true);
    const { error } = await deleteMoment(current);
    setDeleting(false);
    if (!error) {
      const remaining = moments.filter(m => m.id !== current.id);
      if (remaining.length === 0) { onClose(); return; }
      setMoments(remaining);
      setIndex(i => Math.min(i, remaining.length - 1));
      setProgress(0);
    }
  };

  const pause = () => setPaused(true);
  const resume = () => setPaused(false);

  if (loading) {
    return (
      <div className="fixed inset-0 z-[70] bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-label="Loading" />
      </div>
    );
  }

  if (!current) {
    return (
      <div className="fixed inset-0 z-[70] bg-black flex flex-col items-center justify-center gap-3 text-white/70 text-sm">
        <p>No active moments here.</p>
        <button type="button" onClick={onClose} className="text-white underline">Close</button>
      </div>
    );
  }

  const moodMeta = current.mood ? MOOD_META[current.mood] : null;

  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col select-none">
      <MomentProgressBar count={moments.length} activeIndex={index} progress={progress} />

      <div className="flex items-center gap-2.5 px-4 pt-3 pb-2">
        <Avatar src={current.profile_photo_url} name={current.display_name || current.username} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white truncate">{current.display_name || current.username}</p>
          <p className="text-xs text-white/60">{formatRelativeTime(current.created_at)} · Expires in {formatExpiry(current.expires_at)}</p>
        </div>
        {current.is_owner && (
          <button type="button" onClick={handleDelete} disabled={deleting} aria-label="Delete moment" className="p-2 text-white/70 hover:text-white transition-colors disabled:opacity-40">
            <Trash2 size={17} aria-hidden="true" />
          </button>
        )}
        <button type="button" onClick={onClose} aria-label="Close" className="p-2 text-white/70 hover:text-white transition-colors">
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <div className="relative flex-1 flex items-center justify-center overflow-hidden">
        <button
          type="button"
          aria-label="Previous moment"
          onPointerDown={pause}
          onPointerUp={resume}
          onPointerLeave={resume}
          onClick={goPrev}
          className="absolute left-0 top-0 bottom-0 w-1/2 z-10"
        />
        <button
          type="button"
          aria-label="Next moment"
          onPointerDown={pause}
          onPointerUp={resume}
          onPointerLeave={resume}
          onClick={goNext}
          className="absolute right-0 top-0 bottom-0 w-1/2 z-10"
        />

        {current.media_type === 'photo' && current.media_url && (
          <img src={current.media_url} alt={`Moment shared by ${current.display_name || current.username}`} className="max-h-full max-w-full object-contain" />
        )}
        {current.media_type === 'video' && current.media_url && (
          <video ref={videoRef} src={current.media_url} className="max-h-full max-w-full object-contain" playsInline autoPlay />
        )}
        {current.media_type === 'text' && (
          <div className="w-full h-full flex items-center justify-center p-10 bg-purple-700">
            <p className="text-white text-2xl font-medium text-center leading-relaxed whitespace-pre-wrap">{current.text_content}</p>
          </div>
        )}

        {current.media_type !== 'text' && current.text_content && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 pt-10 pointer-events-none">
            <p className="text-white text-sm">{current.text_content}</p>
          </div>
        )}

        {(current.location_text || current.mentioned_username || moodMeta) && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 flex flex-wrap justify-center gap-1.5 pointer-events-none px-4">
            {moodMeta && <span className="bg-black/40 text-white text-xs rounded-full px-2.5 py-1">{moodMeta.emoji} {moodMeta.label}</span>}
            {current.location_text && (
              <span className="bg-black/40 text-white text-xs rounded-full px-2.5 py-1 flex items-center gap-1">
                <MapPin size={10} aria-hidden="true" /> {current.location_text}
              </span>
            )}
            {current.mentioned_username && (
              <span className="bg-black/40 text-white text-xs rounded-full px-2.5 py-1 flex items-center gap-1">
                <AtSign size={10} aria-hidden="true" /> {current.mentioned_username}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col gap-3">
        {current.is_owner ? (
          <button
            type="button"
            onClick={() => setSeenListOpen(true)}
            className="self-start flex items-center gap-1.5 text-sm text-white/80 hover:text-white transition-colors"
          >
            <Eye size={15} aria-hidden="true" />
            Seen by {current.view_count}
          </button>
        ) : (
          <>
            <MomentReplyInput momentId={current.id} />
            <MomentReactionBar
              momentId={current.id}
              myReaction={current.my_reaction}
              onChange={emoji => setMoments(prev => prev.map((m, i) => (i === index ? { ...m, my_reaction: emoji } : m)))}
            />
          </>
        )}
      </div>

      <MomentSeenList isOpen={seenListOpen} onClose={() => setSeenListOpen(false)} momentId={current.id} viewCount={current.view_count} />
    </div>
  );
};
