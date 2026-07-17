import React, { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Feather, Bookmark, Share2, MoreHorizontal, Trash2, User } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useCapsules } from '../../hooks/useCapsules';
import { useDismissableMenu } from '../../hooks/useDismissableMenu';
import { useConfirm } from '../../hooks/useConfirm';
import { Avatar } from '../ui/Avatar';
import { Modal } from '../ui/Modal';
import { SparkleDrop } from '../icons/SparkleDrop';
import { CapsuleLockedCard } from './CapsuleLockedCard';
import { CapsuleUnlockedCard } from './CapsuleUnlockedCard';
import { UnlockAnimation } from './UnlockAnimation';
import { ShareModal } from '../feed/ShareModal';
import { CommentSection } from '../feed/CommentSection';
import { RecentLikersPopover } from '../feed/RecentLikersPopover';
import { formatRelativeTime } from '../../utils/date';
import { validateCapsuleMemoryText } from '../../lib/validators';
import type { Capsule, CapsuleReflection } from '../../types/capsule';

interface CapsuleCardProps {
  capsule: Capsule;
  onDeleted?: (capsuleId: string) => void;
}

// The lifecycle: sealed (countdown only) → due (countdown gone, "Open
// Capsule" appears) → opening (UnlockAnimation plays once, content
// fetched in parallel) → revealed (title/memory/media + Like, Comment,
// Reflect, Save, Share — the only point any of those five appear).
const CapsuleCardImpl: React.FC<CapsuleCardProps> = ({ capsule, onDeleted }) => {
  const { user } = useAuth();
  const { getCapsule, unlockCapsule, deleteCapsule, likeCapsule, unlikeCapsule, saveCapsule, unsaveCapsule,
    getCapsuleReflections, addReflection } = useCapsules();
  const { confirm } = useConfirm();

  const isOwn = capsule.user_id === user?.id;
  const displayName = capsule.display_name || capsule.username;

  const [content, setContent] = useState(capsule);
  const [animating, setAnimating] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [reflectOpen, setReflectOpen] = useState(false);
  const [reflections, setReflections] = useState<CapsuleReflection[]>([]);
  const [reflectionDraft, setReflectionDraft] = useState('');
  const [reflectionError, setReflectionError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [likePopKey, setLikePopKey] = useState(0);
  const [showLikeFloat, setShowLikeFloat] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const menuRef = useDismissableMenu<HTMLDivElement>(menuOpen, closeMenu);
  const pendingRevealRef = useRef<Capsule | null>(null);

  const patchContent = (patch: Partial<Capsule>) => setContent(c => ({ ...c, ...patch }));

  const handleOpenCapsule = async () => {
    setAnimating(true);
    const [fresh] = await Promise.all([getCapsule(content.id), unlockCapsule(content.id)]);
    pendingRevealRef.current = fresh;
  };

  const handleAnimationComplete = () => {
    setAnimating(false);
    if (pendingRevealRef.current) {
      patchContent({ ...pendingRevealRef.current, has_opened: true });
      setAnnouncement('Capsule unlocked.');
    }
  };

  const handleDelete = async () => {
    setMenuOpen(false);
    const ok = await confirm({
      title: 'Delete this capsule?',
      description: 'This permanently deletes the capsule and everything in it. This cannot be undone.',
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    setDeleting(true);
    const { error } = await deleteCapsule(content);
    if (!error) onDeleted?.(content.id);
    else setDeleting(false);
  };

  const toggleLike = async () => {
    const next = !content.is_liked;
    patchContent({ is_liked: next, like_count: Math.max(0, content.like_count + (next ? 1 : -1)) });
    if (next) {
      setLikePopKey(k => k + 1);
      setShowLikeFloat(true);
      setTimeout(() => setShowLikeFloat(false), 600);
    }
    const { error } = next ? await likeCapsule(content.id) : await unlikeCapsule(content.id);
    if (error) patchContent({ is_liked: !next, like_count: content.like_count });
  };

  const toggleSave = async () => {
    const next = !content.is_saved;
    patchContent({ is_saved: next });
    const { error } = next ? await saveCapsule(content.id) : await unsaveCapsule(content.id);
    if (error) patchContent({ is_saved: !next });
  };

  const openReflect = async () => {
    setReflectOpen(true);
    setReflections(await getCapsuleReflections(content.id));
  };

  const submitReflection = async () => {
    const validationError = validateCapsuleMemoryText(reflectionDraft);
    if (validationError) { setReflectionError(validationError); return; }
    const { error, reflection } = await addReflection(content.id, reflectionDraft);
    if (error || !reflection) { setReflectionError(error); return; }
    setReflections(prev => [reflection, ...prev]);
    setReflectionDraft('');
    setReflectionError(null);
  };

  if (deleting) return null;

  return (
    <article className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(124,58,237,0.12)] overflow-hidden cv-auto">
      <span role="status" aria-live="polite" className="sr-only">{announcement}</span>
      <div className="flex items-center gap-3 p-4">
        <Link to={`/u/${content.username}`} className="flex-shrink-0">
          <Avatar src={content.profile_photo_url} name={displayName} size="md" />
        </Link>
        <div className="min-w-0 flex-1">
          <Link to={`/u/${content.username}`} className="text-sm font-semibold text-gray-900 dark:text-gray-100 hover:underline truncate block">{displayName}</Link>
          <p className="text-xs text-gray-500 dark:text-gray-400">@{content.username} · {formatRelativeTime(content.created_at)}</p>
        </div>
        <div className="relative flex-shrink-0" ref={menuRef}>
          <button type="button" onClick={() => setMenuOpen(p => !p)} aria-label="More options" className="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none">
            <MoreHorizontal size={16} aria-hidden="true" />
          </button>
          {menuOpen && (
            <div role="menu" className="absolute right-0 top-11 w-48 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl z-20 overflow-hidden py-1 animate-fade-in">
              <Link to={`/u/${content.username}`} role="menuitem" onClick={() => setMenuOpen(false)} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <User size={15} aria-hidden="true" /> View profile
              </Link>
              {isOwn && (
                <button role="menuitem" onClick={handleDelete} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors">
                  <Trash2 size={15} aria-hidden="true" /> Delete capsule
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pb-4">
        {animating ? (
          <UnlockAnimation onComplete={handleAnimationComplete} />
        ) : content.is_unlocked && content.has_opened ? (
          <CapsuleUnlockedCard capsule={content} />
        ) : (
          <CapsuleLockedCard capsule={content} onOpen={handleOpenCapsule} onUnlockReached={() => patchContent({ is_unlocked: true })} />
        )}
      </div>

      {content.is_unlocked && content.has_opened && (
        <>
          <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-50 dark:border-gray-800">
            <span
              className={[
                'relative inline-flex items-center gap-1.5 rounded-full pl-2.5 pr-3 py-1.5 text-xs font-semibold transition-all',
                content.is_liked
                  ? 'bg-purple-600 text-white shadow-sm shadow-purple-500/25'
                  : 'bg-gray-50 dark:bg-gray-800/70 text-gray-500 dark:text-gray-400',
              ].join(' ')}
            >
              <button type="button" onClick={toggleLike} aria-label={content.is_liked ? 'Remove Sparkle Drop' : 'Sparkle Drop this memory'} aria-pressed={content.is_liked} className="relative flex items-center focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none rounded-full">
                <SparkleDrop key={likePopKey} size={14} className={`${content.is_liked ? 'fill-white' : ''} ${likePopKey > 0 ? 'animate-reaction-pop' : ''}`} aria-hidden="true" />
                {showLikeFloat && (
                  <SparkleDrop size={14} className="absolute left-0 top-0 fill-fuchsia-500 text-fuchsia-500 pointer-events-none animate-reaction-float" aria-hidden="true" />
                )}
              </button>
              <RecentLikersPopover contentType="capsule" contentId={content.id} count={content.like_count} />
            </span>
            <button type="button" onClick={() => setCommentsOpen(p => !p)} aria-label="Comments" className="inline-flex items-center gap-1.5 rounded-full pl-2.5 pr-3 py-1.5 text-xs font-semibold bg-gray-50 dark:bg-gray-800/70 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/70 transition-all focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none">
              <MessageCircle size={14} aria-hidden="true" />
              {content.comment_count > 0 && content.comment_count}
            </button>
            <button type="button" onClick={openReflect} aria-label="Reflect" className="inline-flex items-center gap-1.5 rounded-full p-2 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/70 hover:bg-gray-100 dark:hover:bg-gray-700/70 transition-all focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none">
              <Feather size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={toggleSave}
              aria-label={content.is_saved ? 'Unsave' : 'Save'}
              aria-pressed={content.is_saved}
              className={[
                'inline-flex items-center gap-1.5 rounded-full pl-2.5 pr-3 py-1.5 text-xs font-semibold transition-all focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none',
                content.is_saved
                  ? 'bg-purple-600 text-white shadow-sm shadow-purple-500/25'
                  : 'bg-gray-50 dark:bg-gray-800/70 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/70',
              ].join(' ')}
            >
              <Bookmark size={14} className={content.is_saved ? 'fill-white' : ''} aria-hidden="true" />
              Save
            </button>
            <button type="button" onClick={() => setShareOpen(true)} aria-label="Share this memory" className="ml-auto inline-flex items-center gap-1.5 rounded-full p-2 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/70 hover:bg-gray-100 dark:hover:bg-gray-700/70 transition-all focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none">
              <Share2 size={14} aria-hidden="true" />
            </button>
          </div>

          <ShareModal
            isOpen={shareOpen}
            onClose={() => setShareOpen(false)}
            memoryType="capsule"
            memoryId={content.id}
            title={content.title}
            caption={content.memory_text}
            mood={content.mood}
            coverUrl={content.media.find(m => m.type === 'photo' || m.type === 'video')?.url ?? null}
            username={content.username}
            onShared={() => patchContent({ share_count: content.share_count + 1 })}
          />

          {commentsOpen && (
            <CommentSection
              contentType="capsule"
              contentId={content.id}
              contentOwnerId={content.user_id}
              onCountChange={count => patchContent({ comment_count: count })}
            />
          )}
        </>
      )}

      <Modal isOpen={reflectOpen} onClose={() => setReflectOpen(false)} title="Reflect privately" size="sm">
        <div className="flex flex-col gap-3">
          <p className="text-xs text-gray-400">Only you will ever see this — not tied to the comments below.</p>
          <textarea
            value={reflectionDraft}
            onChange={e => setReflectionDraft(e.target.value)}
            rows={3}
            placeholder="What does this memory bring up for you?"
            className="border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          {reflectionError && <p className="text-xs text-red-600">{reflectionError}</p>}
          <button type="button" onClick={submitReflection} className="self-end px-4 py-1.5 rounded-full bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition-colors">
            Save reflection
          </button>
          {reflections.length > 0 && (
            <div className="flex flex-col gap-2 pt-2 border-t border-gray-100 max-h-48 overflow-y-auto">
              {reflections.map(r => (
                <div key={r.id} className="text-sm text-gray-700 bg-gray-50 rounded-xl px-3 py-2">
                  <p className="whitespace-pre-wrap">{r.content}</p>
                  <p className="text-[11px] text-gray-400 mt-1">{formatRelativeTime(r.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </article>
  );
};

// Memoized — same reasoning as DropCard/MemoryCard: whichever list
// renders these (CapsuleTimeline/CapsuleArchive) patches one capsule's
// object reference at a time, so unchanged siblings skip re-rendering.
export const CapsuleCard = React.memo(CapsuleCardImpl);
