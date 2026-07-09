import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Pin, PinOff, Pencil, MessageCircle } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { EmojiPicker } from './EmojiPicker';
import { formatRelativeTime } from '../../utils/date';
import type { Comment } from '../../types/comment';

const MENTION_RE = /@([a-zA-Z0-9_]{3,20})\b/g;

const renderContent = (content: string) => {
  const parts = content.split(MENTION_RE);
  // String.split with a capturing group interleaves [text, match, text, match, ...]
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <Link key={i} to={`/u/${part}`} className="text-purple-600 font-medium hover:underline">@{part}</Link>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    ),
  );
};

interface CommentItemProps {
  comment: Comment;
  isOwn: boolean;
  canModerate: boolean;
  isReply?: boolean;
  onDelete: () => void;
  onEdit: (newContent: string) => Promise<void>;
  onReact: (emoji: string) => void;
  onUnreact: () => void;
  onTogglePin: () => void;
  onReplyClick?: () => void;
}

export const CommentItem: React.FC<CommentItemProps> = ({
  comment, isOwn, canModerate, isReply = false, onDelete, onEdit, onReact, onUnreact, onTogglePin, onReplyClick,
}) => {
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.content);
  const displayName = comment.display_name || comment.username;

  const handleDelete = async () => {
    setDeleting(true);
    await onDelete();
  };

  const saveEdit = async () => {
    if (!draft.trim()) return;
    await onEdit(draft);
    setEditing(false);
  };

  // EmojiPicker owns its own trigger button, so "your current reaction"
  // isn't highlighted inside the picker's grid — a small, known UX
  // rough edge (see README Known limitations) rather than forking a
  // shared component for this one case.
  const handlePick = (emoji: string) => {
    if (comment.my_reaction === emoji) onUnreact();
    else onReact(emoji);
  };

  return (
    <div className={`flex items-start gap-2.5 py-2 ${isReply ? 'pl-9' : ''}`}>
      <Link to={`/u/${comment.username}`} className="flex-shrink-0">
        <Avatar src={comment.profile_photo_url} name={displayName} size={isReply ? 'xs' : 'sm'} />
      </Link>
      <div className="min-w-0 flex-1">
        {comment.is_pinned && (
          <p className="flex items-center gap-1 text-[10px] font-medium text-purple-500 mb-0.5">
            <Pin size={10} aria-hidden="true" /> Pinned
          </p>
        )}
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false); }}
              maxLength={1000}
              autoFocus
              className="flex-1 text-sm border border-gray-200 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button type="button" onClick={saveEdit} className="text-xs font-medium text-purple-600">Save</button>
            <button type="button" onClick={() => setEditing(false)} className="text-xs text-gray-400">Cancel</button>
          </div>
        ) : (
          <p className="text-sm text-gray-900">
            <Link to={`/u/${comment.username}`} className="font-semibold hover:underline">{displayName}</Link>{' '}
            <span className="whitespace-pre-wrap break-words">{renderContent(comment.content)}</span>
          </p>
        )}
        <div className="relative flex items-center gap-2.5 mt-0.5 flex-wrap">
          <span className="text-xs text-gray-400">
            {formatRelativeTime(comment.created_at)}
            {comment.edited_at && ' · edited'}
          </span>

          <span className={`text-xs flex items-center gap-1 ${comment.my_reaction ? 'text-purple-600' : 'text-gray-400'}`}>
            <EmojiPicker onSelect={handlePick} />
            {comment.my_reaction ?? ''}{comment.reaction_count > 0 ? ` ${comment.reaction_count}` : ''}
          </span>

          {!isReply && onReplyClick && (
            <button type="button" onClick={onReplyClick} className="text-xs text-gray-400 hover:text-purple-600 flex items-center gap-1">
              <MessageCircle size={11} aria-hidden="true" /> Reply
            </button>
          )}

          {isOwn && !editing && (
            <button type="button" onClick={() => setEditing(true)} className="text-xs text-gray-400 hover:text-purple-600 flex items-center gap-1">
              <Pencil size={11} aria-hidden="true" /> Edit
            </button>
          )}

          {canModerate && (
            <button type="button" onClick={onTogglePin} className="text-xs text-gray-400 hover:text-purple-600 flex items-center gap-1">
              {comment.is_pinned ? <PinOff size={11} aria-hidden="true" /> : <Pin size={11} aria-hidden="true" />}
              {comment.is_pinned ? 'Unpin' : 'Pin'}
            </button>
          )}

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
