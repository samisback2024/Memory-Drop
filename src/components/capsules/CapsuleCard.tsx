import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, MessageCircle, Feather, Bookmark, Share2, MoreHorizontal, Trash2, User, Send } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useCapsules } from '../../hooks/useCapsules';
import { Avatar } from '../ui/Avatar';
import { Modal } from '../ui/Modal';
import { CapsuleLockedCard } from './CapsuleLockedCard';
import { CapsuleUnlockedCard } from './CapsuleUnlockedCard';
import { UnlockAnimation } from './UnlockAnimation';
import { formatRelativeTime } from '../../utils/date';
import { validateCapsuleMemoryText } from '../../lib/validators';
import type { Capsule, CapsuleComment, CapsuleReflection } from '../../types/capsule';

interface CapsuleCardProps {
  capsule: Capsule;
  onDeleted?: (capsuleId: string) => void;
}

// The lifecycle: sealed (countdown only) → due (countdown gone, "Open
// Capsule" appears) → opening (UnlockAnimation plays once, content
// fetched in parallel) → revealed (title/memory/media + Like, Comment,
// Reflect, Save, Share — the only point any of those five appear).
export const CapsuleCard: React.FC<CapsuleCardProps> = ({ capsule, onDeleted }) => {
  const { user } = useAuth();
  const { getCapsule, unlockCapsule, deleteCapsule, likeCapsule, unlikeCapsule, saveCapsule, unsaveCapsule,
    getCapsuleComments, addComment, getCapsuleReflections, addReflection, incrementShareCount } = useCapsules();

  const isOwn = capsule.user_id === user?.id;
  const displayName = capsule.display_name || capsule.username;

  const [content, setContent] = useState(capsule);
  const [animating, setAnimating] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<CapsuleComment[]>([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [reflectOpen, setReflectOpen] = useState(false);
  const [reflections, setReflections] = useState<CapsuleReflection[]>([]);
  const [reflectionDraft, setReflectionDraft] = useState('');
  const [reflectionError, setReflectionError] = useState<string | null>(null);
  const [shared, setShared] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pendingRevealRef = useRef<Capsule | null>(null);

  const patchContent = (patch: Partial<Capsule>) => setContent(c => ({ ...c, ...patch }));

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const handleOpenCapsule = async () => {
    setAnimating(true);
    const [fresh] = await Promise.all([getCapsule(content.id), unlockCapsule(content.id)]);
    pendingRevealRef.current = fresh;
  };

  const handleAnimationComplete = () => {
    setAnimating(false);
    if (pendingRevealRef.current) patchContent({ ...pendingRevealRef.current, has_opened: true });
  };

  const handleDelete = async () => {
    setMenuOpen(false);
    setDeleting(true);
    const { error } = await deleteCapsule(content);
    if (!error) onDeleted?.(content.id);
    else setDeleting(false);
  };

  const toggleLike = async () => {
    const next = !content.is_liked;
    patchContent({ is_liked: next, like_count: Math.max(0, content.like_count + (next ? 1 : -1)) });
    const { error } = next ? await likeCapsule(content.id) : await unlikeCapsule(content.id);
    if (error) patchContent({ is_liked: !next, like_count: content.like_count });
  };

  const toggleSave = async () => {
    const next = !content.is_saved;
    patchContent({ is_saved: next });
    const { error } = next ? await saveCapsule(content.id) : await unsaveCapsule(content.id);
    if (error) patchContent({ is_saved: !next });
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/capsules/${content.id}`;
    try {
      if (navigator.share) await navigator.share({ url, title: content.title ?? 'A memory on Memory Drop' });
      else await navigator.clipboard.writeText(url);
      setShared(true);
      incrementShareCount(content.id);
      patchContent({ share_count: content.share_count + 1 });
      setTimeout(() => setShared(false), 2000);
    } catch { /* user cancelled the native share sheet — not an error */ }
  };

  const openComments = async () => {
    setCommentsOpen(p => !p);
    if (!commentsOpen && comments.length === 0) setComments(await getCapsuleComments(content.id));
  };

  const submitComment = async () => {
    if (!commentDraft.trim()) return;
    const { comment } = await addComment(content.id, commentDraft);
    if (comment) {
      setComments(prev => [...prev, comment]);
      setCommentDraft('');
      patchContent({ comment_count: content.comment_count + 1 });
    }
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
    <article className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(124,58,237,0.12)] overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <Link to={`/u/${content.username}`} className="flex-shrink-0">
          <Avatar src={content.profile_photo_url} name={displayName} size="md" />
        </Link>
        <div className="min-w-0 flex-1">
          <Link to={`/u/${content.username}`} className="text-sm font-semibold text-gray-900 hover:underline truncate block">{displayName}</Link>
          <p className="text-xs text-gray-500">@{content.username} · {formatRelativeTime(content.created_at)}</p>
        </div>
        <div className="relative flex-shrink-0" ref={menuRef}>
          <button type="button" onClick={() => setMenuOpen(p => !p)} aria-label="More options" className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none">
            <MoreHorizontal size={16} aria-hidden="true" />
          </button>
          {menuOpen && (
            <div role="menu" className="absolute right-0 top-11 w-48 bg-white border border-gray-100 rounded-2xl shadow-xl z-20 overflow-hidden py-1 animate-fade-in">
              <Link to={`/u/${content.username}`} role="menuitem" onClick={() => setMenuOpen(false)} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                <User size={15} aria-hidden="true" /> View profile
              </Link>
              {isOwn && (
                <button role="menuitem" onClick={handleDelete} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
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
          <div className="flex items-center gap-4 px-4 py-3 border-t border-gray-50">
            <button type="button" onClick={toggleLike} className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-pink-600 transition-colors">
              <Heart size={16} className={content.is_liked ? 'fill-pink-600 text-pink-600' : ''} aria-hidden="true" />
              {content.like_count > 0 ? content.like_count : ''}
            </button>
            <button type="button" onClick={openComments} className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-purple-600 transition-colors">
              <MessageCircle size={17} aria-hidden="true" />
              {content.comment_count > 0 ? content.comment_count : ''}
            </button>
            <button type="button" onClick={openReflect} className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-purple-600 transition-colors">
              <Feather size={16} aria-hidden="true" />
            </button>
            <button type="button" onClick={toggleSave} className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-purple-600 transition-colors">
              <Bookmark size={17} className={content.is_saved ? 'fill-purple-600 text-purple-600' : ''} aria-hidden="true" />
            </button>
            <button type="button" onClick={handleShare} aria-label="Share this memory" className="ml-auto flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-purple-600 transition-colors">
              <Share2 size={16} aria-hidden="true" />
              {shared && <span className="text-xs text-purple-600">Copied</span>}
            </button>
          </div>

          {commentsOpen && (
            <div className="px-4 pb-4 flex flex-col gap-2 border-t border-gray-50 pt-3">
              {comments.map(c => (
                <div key={c.id} className="flex items-start gap-2 text-sm">
                  <Avatar src={c.profile_photo_url} name={c.display_name || c.username} size="xs" />
                  <p className="text-gray-700"><span className="font-medium text-gray-900">{c.display_name || c.username}</span> {c.content}</p>
                </div>
              ))}
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  value={commentDraft}
                  onChange={e => setCommentDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') submitComment(); }}
                  placeholder="Add a comment…"
                  className="flex-1 border border-gray-200 rounded-full px-3.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <button type="button" onClick={submitComment} aria-label="Post comment" className="p-2 rounded-full bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors">
                  <Send size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
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
          <button type="button" onClick={submitReflection} className="self-end px-4 py-1.5 rounded-full bg-gradient-to-r from-purple-600 to-blue-500 text-white text-sm font-medium hover:shadow-md transition-shadow">
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
