import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useComments } from '../../hooks/useComments';
import { Skeleton } from '../ui/Skeleton';
import { CommentItem } from './CommentItem';
import { CommentComposer } from './CommentComposer';
import type { Comment, CommentContentType } from '../../types/comment';

interface CommentSectionProps {
  contentType: CommentContentType;
  contentId: string;
  contentOwnerId: string;
  onCountChange?: (count: number) => void;
}

// Shared by Drops and Capsules (Phase 10d) — previously two separate,
// unequal implementations (Capsule comments had no delete/edit/reply/
// reactions UI at all). Only ever mounted once the content has
// unlocked. Replies are one level deep: top-level comments render with
// their replies nested directly beneath, grouped client-side after one
// flat fetch — no recursive queries or recursive rendering needed at
// that depth.
export const CommentSection: React.FC<CommentSectionProps> = ({ contentType, contentId, contentOwnerId, onCountChange }) => {
  const { user, profile } = useAuth();
  const { getComments, addComment, updateComment, deleteComment, setCommentPinned, reactToComment, unreactToComment } = useComments();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const isModerator = user?.id === contentOwnerId;

  useEffect(() => {
    let cancelled = false;
    getComments(contentType, contentId).then(data => {
      if (cancelled) return;
      setComments(data);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [contentType, contentId, getComments]);

  const topLevelCount = () => comments.filter(c => !c.parent_comment_id).length;

  const patchComment = (id: string, patch: Partial<Comment>) =>
    setComments(prev => prev.map(c => (c.id === id ? { ...c, ...patch } : c)));

  const handleAdd = async (text: string, parentCommentId: string | null = null) => {
    const { error, comment } = await addComment(contentType, contentId, text, parentCommentId);
    if (!error && comment) {
      setComments(prev => {
        const next = [...prev, comment];
        onCountChange?.(next.filter(c => !c.parent_comment_id).length);
        return next;
      });
      setReplyingTo(null);
    }
  };

  const handleDelete = async (commentId: string) => {
    const { error } = await deleteComment(contentType, commentId);
    if (!error) {
      setComments(prev => {
        const next = prev.filter(c => c.id !== commentId && c.parent_comment_id !== commentId);
        onCountChange?.(next.filter(c => !c.parent_comment_id).length);
        return next;
      });
    }
  };

  const handleEdit = async (commentId: string, content: string) => {
    const { error } = await updateComment(contentType, commentId, content);
    if (!error) patchComment(commentId, { content, edited_at: new Date().toISOString() });
  };

  const handleTogglePin = async (comment: Comment) => {
    const next = !comment.is_pinned;
    patchComment(comment.id, { is_pinned: next });
    const { error } = await setCommentPinned(contentType, comment.id, next);
    if (error) patchComment(comment.id, { is_pinned: !next });
  };

  const handleReact = async (comment: Comment, emoji: string) => {
    const prevReaction = comment.my_reaction;
    patchComment(comment.id, {
      my_reaction: emoji,
      reaction_count: comment.reaction_count + (prevReaction ? 0 : 1),
    });
    await reactToComment(contentType, comment.id, emoji);
  };

  const handleUnreact = async (comment: Comment) => {
    patchComment(comment.id, { my_reaction: null, reaction_count: Math.max(0, comment.reaction_count - 1) });
    await unreactToComment(contentType, comment.id);
  };

  const topLevel = comments.filter(c => !c.parent_comment_id);
  const repliesFor = (id: string) => comments.filter(c => c.parent_comment_id === id);

  return (
    <div className="border-t border-gray-100 px-4 py-3">
      {loading ? (
        <div className="flex flex-col gap-3 py-1">
          {[0, 1].map(i => (
            <div key={i} className="flex items-center gap-2.5">
              <Skeleton className="w-8 h-8" rounded="full" />
              <Skeleton className="h-3.5 w-40" />
            </div>
          ))}
        </div>
      ) : topLevelCount() === 0 ? (
        <p className="text-sm text-gray-400 py-1.5">No comments yet.</p>
      ) : (
        <div className="flex flex-col divide-y divide-gray-50 max-h-96 overflow-y-auto">
          {topLevel.map(c => (
            <div key={c.id}>
              <CommentItem
                comment={c}
                isOwn={c.user_id === user?.id}
                canModerate={isModerator}
                onDelete={() => handleDelete(c.id)}
                onEdit={content => handleEdit(c.id, content)}
                onReact={emoji => handleReact(c, emoji)}
                onUnreact={() => handleUnreact(c)}
                onTogglePin={() => handleTogglePin(c)}
                onReplyClick={() => setReplyingTo(p => (p === c.id ? null : c.id))}
              />
              {repliesFor(c.id).map(reply => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  isReply
                  isOwn={reply.user_id === user?.id}
                  canModerate={isModerator}
                  onDelete={() => handleDelete(reply.id)}
                  onEdit={content => handleEdit(reply.id, content)}
                  onReact={emoji => handleReact(reply, emoji)}
                  onUnreact={() => handleUnreact(reply)}
                  onTogglePin={() => handleTogglePin(reply)}
                />
              ))}
              {replyingTo === c.id && (
                <div className="pl-9 pb-2">
                  <CommentComposer
                    avatarUrl={profile?.profile_photo_url}
                    avatarName={profile?.display_name || profile?.username || 'You'}
                    placeholder="Write a reply..."
                    autoFocus
                    onCancel={() => setReplyingTo(null)}
                    onSubmit={text => handleAdd(text, c.id)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-3">
        <CommentComposer
          avatarUrl={profile?.profile_photo_url}
          avatarName={profile?.display_name || profile?.username || 'You'}
          onSubmit={text => handleAdd(text)}
        />
      </div>
    </div>
  );
};
