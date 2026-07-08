import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useDrops } from '../../hooks/useDrops';
import { Avatar } from '../ui/Avatar';
import { Skeleton } from '../ui/Skeleton';
import { CommentItem } from './CommentItem';
import type { DropComment } from '../../types/feed';

interface CommentSectionProps {
  dropId: string;
  onCountChange?: (count: number) => void;
}

// Only ever mounted once a drop has unlocked — see DropCard, which doesn't
// render this at all while a drop is still sealed.
export const CommentSection: React.FC<CommentSectionProps> = ({ dropId, onCountChange }) => {
  const { user, profile } = useAuth();
  const { getDropComments, addComment, deleteComment } = useDrops();
  const [comments, setComments] = useState<DropComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getDropComments(dropId).then(data => {
      if (cancelled) return;
      setComments(data);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [dropId, getDropComments]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || posting) return;
    setPosting(true);
    const { error, comment } = await addComment(dropId, text);
    setPosting(false);
    if (!error && comment) {
      setComments(prev => {
        const next = [...prev, comment];
        onCountChange?.(next.length);
        return next;
      });
      setText('');
    }
  };

  const handleDelete = async (commentId: string) => {
    const { error } = await deleteComment(commentId);
    if (!error) {
      setComments(prev => {
        const next = prev.filter(c => c.id !== commentId);
        onCountChange?.(next.length);
        return next;
      });
    }
  };

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
      ) : comments.length === 0 ? (
        <p className="text-sm text-gray-400 py-1.5">No comments yet.</p>
      ) : (
        <div className="flex flex-col divide-y divide-gray-50 max-h-72 overflow-y-auto">
          {comments.map(c => (
            <CommentItem key={c.id} comment={c} isOwn={c.user_id === user?.id} onDelete={() => handleDelete(c.id)} />
          ))}
        </div>
      )}

      <form onSubmit={handleAdd} className="flex items-center gap-2 mt-3">
        <Avatar src={profile?.profile_photo_url} name={profile?.display_name || profile?.username || 'You'} size="xs" />
        <input
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Add a comment..."
          maxLength={1000}
          aria-label="Add a comment"
          className="flex-1 text-sm border border-gray-200 rounded-full px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
        <button
          type="submit"
          disabled={!text.trim() || posting}
          className="text-sm font-semibold text-purple-600 disabled:text-gray-300 transition-colors flex-shrink-0"
        >
          Post
        </button>
      </form>
    </div>
  );
};
