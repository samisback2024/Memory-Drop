import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { formatRelativeTime } from '../../utils/date';
import type { PostComment } from '../../types/feed';

interface CommentItemProps {
  comment: PostComment;
  isOwn: boolean;
  onDelete: () => Promise<void> | void;
}

export const CommentItem: React.FC<CommentItemProps> = ({ comment, isOwn, onDelete }) => {
  const [deleting, setDeleting] = useState(false);
  const displayName = comment.display_name || comment.username;

  const handleDelete = async () => {
    setDeleting(true);
    await onDelete();
  };

  return (
    <div className="flex items-start gap-2.5 py-2">
      <Link to={`/u/${comment.username}`} className="flex-shrink-0">
        <Avatar src={comment.profile_photo_url} name={displayName} size="sm" />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-gray-900">
          <Link to={`/u/${comment.username}`} className="font-semibold hover:underline">{displayName}</Link>{' '}
          <span className="whitespace-pre-wrap break-words">{comment.content}</span>
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-gray-400">{formatRelativeTime(comment.created_at)}</span>
          {isOwn && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              aria-label="Delete comment"
              className="text-xs text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1 disabled:opacity-50"
            >
              <Trash2 size={11} aria-hidden="true" />
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
