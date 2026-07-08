import React from 'react';
import { MessageCircle, Share2 } from 'lucide-react';
import { LikeButton } from './LikeButton';
import { SaveButton } from './SaveButton';

interface PostActionsProps {
  postId: string;
  isLiked: boolean;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  isSaved: boolean;
  onLikeChange: (next: { isLiked: boolean; count: number }) => void;
  onCommentToggle: () => void;
  onShare: () => void;
  onSaveChange: (isSaved: boolean) => void;
}

export const PostActions: React.FC<PostActionsProps> = ({
  postId, isLiked, likeCount, commentCount, shareCount, isSaved,
  onLikeChange, onCommentToggle, onShare, onSaveChange,
}) => (
  <div className="flex items-center gap-4 px-4 py-3">
    <LikeButton postId={postId} isLiked={isLiked} count={likeCount} onChange={onLikeChange} />

    <button
      type="button"
      onClick={onCommentToggle}
      className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-purple-600 transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none rounded-lg px-1.5 py-1 -mx-1.5"
    >
      <MessageCircle size={19} aria-hidden="true" />
      <span>{commentCount > 0 ? commentCount : ''}</span>
    </button>

    <button
      type="button"
      onClick={onShare}
      aria-label="Share post"
      className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-purple-600 transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none rounded-lg px-1.5 py-1 -mx-1.5"
    >
      <Share2 size={18} aria-hidden="true" />
      <span>{shareCount > 0 ? shareCount : ''}</span>
    </button>

    <div className="ml-auto">
      <SaveButton postId={postId} isSaved={isSaved} onChange={onSaveChange} />
    </div>
  </div>
);
