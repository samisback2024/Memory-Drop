import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Globe2, MoreHorizontal, Flag, EyeOff, User, Trash2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useDrops } from '../../hooks/useDrops';
import { Avatar } from '../ui/Avatar';
import { ImageGrid } from './ImageGrid';
import { VideoPlayer } from './VideoPlayer';
import { AudioPlayer } from './AudioPlayer';
import { DropActions } from './DropActions';
import { CommentSection } from './CommentSection';
import { ShareModal } from './ShareModal';
import { ReportModal } from './ReportModal';
import { ReflectionModal } from './ReflectionModal';
import { LockedDropPlaceholder, MEMORY_TYPE_ICONS } from './LockedDropPlaceholder';
import { formatRelativeTime } from '../../utils/date';
import { MOOD_META, MEMORY_TYPE_LABELS, type Drop } from '../../types/feed';

interface DropCardProps {
  drop: Drop;
  onDeleted?: (dropId: string) => void;
  onHidden?: (dropId: string) => void;
  onUnsaved?: (dropId: string) => void;
}

export const DropCard: React.FC<DropCardProps> = ({ drop, onDeleted, onHidden, onUnsaved }) => {
  const { user } = useAuth();
  const { deleteDrop, hideDrop, getDrop } = useDrops();
  const isOwn = drop.user_id === user?.id;
  const displayName = drop.display_name || drop.username;
  const MemoryIcon = MEMORY_TYPE_ICONS[drop.post_type];
  const moodMeta = drop.mood ? MOOD_META[drop.mood] : null;

  const [content, setContent] = useState(drop);
  const [commentCount, setCommentCount] = useState(drop.comment_count);
  const [isSaved, setIsSaved] = useState(drop.is_saved);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reflectOpen, setReflectOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [menuOpen]);

  const handleDelete = async () => {
    setMenuOpen(false);
    setDeleting(true);
    const { error } = await deleteDrop(content);
    if (!error) onDeleted?.(content.id);
    else setDeleting(false);
  };

  const handleHide = async () => {
    setMenuOpen(false);
    const { error } = await hideDrop(content.id);
    if (!error) onHidden?.(content.id);
  };

  // The server won't hand over caption/media until unlock_date has passed
  // — this re-fetches the drop once the countdown reaches zero so the real
  // content can actually be shown, rather than the client trying to reveal
  // data it was never sent.
  const handleUnlocked = async () => {
    const fresh = await getDrop(content.id);
    if (fresh) setContent(fresh);
  };

  if (deleting) return null;

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center w-5 flex-shrink-0 pt-6" aria-hidden="true">
        <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 ring-4 ring-gray-50 shadow-sm flex-shrink-0" />
        <div className="w-px flex-1 bg-gradient-to-b from-purple-200 to-transparent mt-1" />
      </div>

      <article className="flex-1 min-w-0 bg-white/80 backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(124,58,237,0.12)] overflow-hidden">
        <div className="flex items-center gap-3 p-4">
          <Link to={`/u/${content.username}`} className="flex-shrink-0">
            <Avatar src={content.profile_photo_url} name={displayName} size="md" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Link to={`/u/${content.username}`} className="text-sm font-semibold text-gray-900 hover:underline truncate">
                {displayName}
              </Link>
            </div>
            <p className="text-xs text-gray-500 flex items-center gap-1.5 flex-wrap">
              <Link to={`/u/${content.username}`} className="hover:underline">@{content.username}</Link>
              <span>·</span>
              <span>{formatRelativeTime(content.created_at)}</span>
              <span className="inline-flex items-center gap-0.5 text-gray-400" title={MEMORY_TYPE_LABELS[content.post_type]}>
                <MemoryIcon size={11} aria-hidden="true" />
              </span>
              {moodMeta && <span aria-label={moodMeta.label}>{moodMeta.emoji}</span>}
              <span className="text-gray-300" title={content.visibility === 'private' ? 'Private drop' : 'Public drop'}>
                {content.visibility === 'private' ? <Lock size={10} aria-hidden="true" /> : <Globe2 size={10} aria-hidden="true" />}
              </span>
            </p>
          </div>

          <div className="relative flex-shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen(p => !p)}
              aria-label="More options"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none"
            >
              <MoreHorizontal size={16} aria-hidden="true" />
            </button>
            {menuOpen && (
              <div role="menu" className="absolute right-0 top-11 w-48 bg-white border border-gray-100 rounded-2xl shadow-xl z-20 overflow-hidden py-1 animate-fade-in">
                <Link
                  to={`/u/${content.username}`}
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <User size={15} aria-hidden="true" /> View profile
                </Link>
                {isOwn ? (
                  <button role="menuitem" onClick={handleDelete} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                    <Trash2 size={15} aria-hidden="true" /> Delete drop
                  </button>
                ) : (
                  <>
                    <button role="menuitem" onClick={handleHide} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <EyeOff size={15} aria-hidden="true" /> Hide drop
                    </button>
                    <button role="menuitem" onClick={() => { setMenuOpen(false); setReportOpen(true); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                      <Flag size={15} aria-hidden="true" /> Report drop
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="px-4 pb-3">
          {!content.is_unlocked ? (
            <LockedDropPlaceholder
              memoryType={content.post_type}
              mood={content.mood}
              unlockDate={content.unlock_date}
              onUnlocked={handleUnlocked}
            />
          ) : content.post_type === 'text' ? (
            content.caption && (
              <div className="rounded-2xl bg-gradient-to-br from-purple-50/60 to-blue-50/60 p-6 text-center">
                <p className="text-[15px] italic text-gray-700 leading-relaxed whitespace-pre-wrap">{content.caption}</p>
              </div>
            )
          ) : (
            content.caption && <p className="text-sm text-gray-800 whitespace-pre-wrap break-words mb-1">{content.caption}</p>
          )}
        </div>

        {content.is_unlocked && content.post_type === 'photo' && content.images.length > 0 && <ImageGrid images={content.images} />}
        {content.is_unlocked && content.post_type === 'video' && content.video_url && <VideoPlayer src={content.video_url} />}
        {content.is_unlocked && content.post_type === 'audio' && content.audio_url && <AudioPlayer src={content.audio_url} />}

        <DropActions
          dropId={content.id}
          isUnlocked={content.is_unlocked}
          isSaved={isSaved}
          commentCount={commentCount}
          onSaveChange={next => { setIsSaved(next); if (!next) onUnsaved?.(content.id); }}
          onReflect={() => setReflectOpen(true)}
          onCommentToggle={() => setCommentsOpen(p => !p)}
          onShare={() => setShareOpen(true)}
        />

        {content.is_unlocked && commentsOpen && <CommentSection dropId={content.id} onCountChange={setCommentCount} />}

        <ShareModal
          isOpen={shareOpen}
          onClose={() => setShareOpen(false)}
          dropId={content.id}
          onShared={() => setContent(c => ({ ...c, share_count: c.share_count + 1 }))}
        />
        <ReportModal isOpen={reportOpen} onClose={() => setReportOpen(false)} dropId={content.id} />
        <ReflectionModal isOpen={reflectOpen} onClose={() => setReflectOpen(false)} dropId={content.id} />
      </article>
    </div>
  );
};
