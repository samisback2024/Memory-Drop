import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Globe2, Users, MoreHorizontal, Flag, EyeOff, User, Trash2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useDrops } from '../../hooks/useDrops';
import { useToast } from '../../hooks/useToast';
import { useDismissableMenu } from '../../hooks/useDismissableMenu';
import { Avatar } from '../ui/Avatar';
import { ImageGrid } from './ImageGrid';
import { VideoPlayer } from './VideoPlayer';
import { AudioPlayer } from './AudioPlayer';
import { DropActions } from './DropActions';
import { CommentSection } from './CommentSection';
import { ShareModal } from './ShareModal';
import { ReportModal } from './ReportModal';
import { LockedDropPlaceholder, MEMORY_TYPE_ICONS } from './LockedDropPlaceholder';
import { formatRelativeTime } from '../../utils/date';
import { MOOD_META, MEMORY_TYPE_LABELS, VISIBILITY_META, type Drop } from '../../types/feed';

interface DropCardProps {
  drop: Drop;
  onDeleted?: (dropId: string) => void;
  onHidden?: (dropId: string) => void;
  onUnsaved?: (dropId: string) => void;
}

const DropCardImpl: React.FC<DropCardProps> = ({ drop, onDeleted, onHidden, onUnsaved }) => {
  const { user } = useAuth();
  const { deleteDrop, hideDrop, getDrop, recordUnlockView, promoteUnlockedSaves } = useDrops();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const isOwn = drop.user_id === user?.id;
  const displayName = drop.display_name || drop.username;
  const MemoryIcon = MEMORY_TYPE_ICONS[drop.post_type];
  const moodMeta = drop.mood ? MOOD_META[drop.mood] : null;

  const [content, setContent] = useState(drop);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [justUnlocked, setJustUnlocked] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const menuRef = useDismissableMenu<HTMLDivElement>(menuOpen, closeMenu);
  const viewRecorded = useRef(false);

  const patchContent = (patch: Partial<Drop>) => setContent(c => ({ ...c, ...patch }));

  // Groundwork for a future "X unlocked your drop" notification (Phase 9)
  // — best-effort, fire-and-forget, once per mount. Never fires for your
  // own drops (recordUnlockView's RLS would reject it anyway).
  useEffect(() => {
    if (isOwn || !content.is_unlocked || viewRecorded.current) return;
    viewRecorded.current = true;
    recordUnlockView(content.id);
  }, [isOwn, content.is_unlocked, content.id, recordUnlockView]);

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
    if (fresh) {
      setContent(fresh);
      setJustUnlocked(true);
    }
    // A drop you'd tapped "Save to Unlock" on while it was still locked
    // now moves into the real Saved Memories bookmark — see
    // supabase/phase14o_save_to_unlock_promotion.sql.
    if (content.is_saved_to_unlock) {
      const promoted = await promoteUnlockedSaves();
      if (promoted.includes(content.id)) {
        showToast('Moved to My Memory in your Dashboard', 'success', {
          label: 'View',
          onClick: () => navigate('/saved?tab=memories'),
        });
      }
    }
  };

  if (deleting) return null;

  return (
    <div className="flex gap-3 cv-auto">
      <div className="flex flex-col items-center w-5 flex-shrink-0 pt-6" aria-hidden="true">
        <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 ring-4 ring-gray-50 shadow-sm flex-shrink-0" />
        <div className="w-px flex-1 bg-gradient-to-b from-purple-200 to-transparent mt-1" />
      </div>

      <article className="flex-1 min-w-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-2xl border border-white/60 dark:border-gray-800/60 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(124,58,237,0.12)] overflow-hidden">
        <div className="flex items-center gap-3 p-4">
          <Link to={`/u/${content.username}`} className="flex-shrink-0">
            <Avatar src={content.profile_photo_url} name={displayName} size="md" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Link to={`/u/${content.username}`} className="text-sm font-semibold text-gray-900 dark:text-gray-100 hover:underline truncate">
                {displayName}
              </Link>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 flex-wrap">
              <Link to={`/u/${content.username}`} className="hover:underline">@{content.username}</Link>
              <span>·</span>
              <span>{formatRelativeTime(content.created_at)}</span>
              <span className="inline-flex items-center gap-0.5 text-gray-400" title={MEMORY_TYPE_LABELS[content.post_type]}>
                <MemoryIcon size={11} aria-hidden="true" />
              </span>
              {moodMeta && <span aria-label={moodMeta.label}>{moodMeta.emoji}</span>}
              <span className="text-gray-300" title={VISIBILITY_META[content.visibility].label}>
                {content.visibility === 'private' ? <Lock size={10} aria-hidden="true" /> : content.visibility === 'followers' ? <Users size={10} aria-hidden="true" /> : <Globe2 size={10} aria-hidden="true" />}
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
              className="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none"
            >
              <MoreHorizontal size={16} aria-hidden="true" />
            </button>
            {menuOpen && (
              <div role="menu" className="absolute right-0 top-11 w-48 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl z-20 overflow-hidden py-1 animate-fade-in">
                <Link
                  to={`/u/${content.username}`}
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <User size={15} aria-hidden="true" /> View profile
                </Link>
                {isOwn ? (
                  <button role="menuitem" onClick={handleDelete} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors">
                    <Trash2 size={15} aria-hidden="true" /> Delete drop
                  </button>
                ) : (
                  <>
                    <button role="menuitem" onClick={handleHide} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <EyeOff size={15} aria-hidden="true" /> Hide drop
                    </button>
                    <button role="menuitem" onClick={() => { setMenuOpen(false); setReportOpen(true); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors">
                      <Flag size={15} aria-hidden="true" /> Report drop
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className={`px-4 pb-3 ${justUnlocked ? 'animate-unlock-reveal' : ''}`}>
          {!content.is_unlocked ? (
            <LockedDropPlaceholder
              memoryType={content.post_type}
              mood={content.mood}
              unlockDate={content.unlock_date}
              onUnlocked={handleUnlocked}
            />
          ) : content.post_type === 'text' ? (
            content.caption && (
              <div className="rounded-2xl bg-gradient-to-br from-purple-50/60 to-blue-50/60 dark:from-purple-950/30 dark:to-blue-950/30 p-6 text-center">
                <p className="text-[15px] italic text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">{content.caption}</p>
              </div>
            )
          ) : (
            content.caption && <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words mb-1">{content.caption}</p>
          )}
        </div>

        <div className={justUnlocked ? 'animate-unlock-reveal' : ''}>
          {content.is_unlocked && content.post_type === 'photo' && content.images.length > 0 && (
            <ImageGrid images={content.images} altPrefix={`Photo shared by ${content.display_name || content.username}`} />
          )}
          {content.is_unlocked && content.post_type === 'video' && content.video_url && <VideoPlayer src={content.video_url} />}
          {content.is_unlocked && content.post_type === 'audio' && content.audio_url && <AudioPlayer src={content.audio_url} />}
        </div>

        <DropActions
          drop={content}
          onUpdate={patch => {
            patchContent(patch);
            if (patch.is_saved === false) onUnsaved?.(content.id);
          }}
          onCommentToggle={() => setCommentsOpen(p => !p)}
          onShare={() => setShareOpen(true)}
        />

        {content.is_unlocked && commentsOpen && (
          <CommentSection contentType="drop" contentId={content.id} contentOwnerId={content.user_id} onCountChange={count => patchContent({ comment_count: count })} />
        )}

        <ShareModal
          isOpen={shareOpen}
          onClose={() => setShareOpen(false)}
          memoryType="drop"
          memoryId={content.id}
          caption={content.caption}
          mood={content.mood}
          coverUrl={content.images[0]?.url ?? null}
          username={content.username}
          onShared={() => patchContent({ share_count: content.share_count + 1 })}
        />
        <ReportModal isOpen={reportOpen} onClose={() => setReportOpen(false)} dropId={content.id} />
      </article>
    </div>
  );
};

// Memoized — Feed renders one of these per drop; FeedPage's patch
// functions (removeFromAllTabs, etc.) replace one item's object
// reference in the array without touching its siblings, so this skips
// re-rendering every other card in a long feed on each interaction.
export const DropCard = React.memo(DropCardImpl);
