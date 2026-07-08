import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, MoreHorizontal, Flag, EyeOff, User, Trash2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useFeed } from '../../hooks/useFeed';
import { Avatar } from '../ui/Avatar';
import { ImageGrid } from './ImageGrid';
import { VideoPlayer } from './VideoPlayer';
import { PostActions } from './PostActions';
import { CommentSection } from './CommentSection';
import { ShareModal } from './ShareModal';
import { ReportModal } from './ReportModal';
import { formatRelativeTime } from '../../utils/date';
import type { FeedPost } from '../../types/feed';

interface PostCardProps {
  post: FeedPost;
  onDeleted?: (postId: string) => void;
  onHidden?: (postId: string) => void;
  onUnsaved?: (postId: string) => void;
}

export const PostCard: React.FC<PostCardProps> = ({ post, onDeleted, onHidden, onUnsaved }) => {
  const { user } = useAuth();
  const { deletePost, hidePost } = useFeed();
  const isOwn = post.user_id === user?.id;
  const displayName = post.display_name || post.username;

  const [likeState, setLikeState] = useState({ isLiked: post.is_liked, count: post.like_count });
  const [commentCount, setCommentCount] = useState(post.comment_count);
  const [shareCount, setShareCount] = useState(post.share_count);
  const [isSaved, setIsSaved] = useState(post.is_saved);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
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
    const { error } = await deletePost(post);
    if (!error) onDeleted?.(post.id);
    else setDeleting(false);
  };

  const handleHide = async () => {
    setMenuOpen(false);
    const { error } = await hidePost(post.id);
    if (!error) onHidden?.(post.id);
  };

  if (deleting) return null;

  return (
    <article className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <Link to={`/u/${post.username}`} className="flex-shrink-0">
          <Avatar src={post.profile_photo_url} name={displayName} size="md" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Link to={`/u/${post.username}`} className="text-sm font-semibold text-gray-900 hover:underline truncate">
              {displayName}
            </Link>
            {post.is_private && <Lock size={11} className="text-gray-400 flex-shrink-0" aria-label="Private account" />}
          </div>
          <p className="text-xs text-gray-500">
            <Link to={`/u/${post.username}`} className="hover:underline">@{post.username}</Link>
            {' · '}
            <span>{formatRelativeTime(post.created_at)}</span>
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
                to={`/u/${post.username}`}
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <User size={15} aria-hidden="true" /> View profile
              </Link>
              {isOwn ? (
                <button role="menuitem" onClick={handleDelete} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                  <Trash2 size={15} aria-hidden="true" /> Delete post
                </button>
              ) : (
                <>
                  <button role="menuitem" onClick={handleHide} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                    <EyeOff size={15} aria-hidden="true" /> Hide post
                  </button>
                  <button role="menuitem" onClick={() => { setMenuOpen(false); setReportOpen(true); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                    <Flag size={15} aria-hidden="true" /> Report post
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {post.caption && (
        <p className="px-4 pb-3 text-sm text-gray-800 whitespace-pre-wrap break-words">{post.caption}</p>
      )}

      {post.post_type === 'photo' && post.images.length > 0 && <ImageGrid images={post.images} />}
      {post.post_type === 'video' && post.video_url && <VideoPlayer src={post.video_url} />}

      <PostActions
        postId={post.id}
        isLiked={likeState.isLiked}
        likeCount={likeState.count}
        commentCount={commentCount}
        shareCount={shareCount}
        isSaved={isSaved}
        onLikeChange={setLikeState}
        onCommentToggle={() => setCommentsOpen(p => !p)}
        onShare={() => setShareOpen(true)}
        onSaveChange={next => { setIsSaved(next); if (!next) onUnsaved?.(post.id); }}
      />

      {commentsOpen && <CommentSection postId={post.id} onCountChange={setCommentCount} />}

      <ShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        postId={post.id}
        onShared={() => setShareCount(c => c + 1)}
      />
      <ReportModal isOpen={reportOpen} onClose={() => setReportOpen(false)} postId={post.id} />
    </article>
  );
};
