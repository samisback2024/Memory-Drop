import React from 'react';
import { Feather, MessageCircle, Share2, LockKeyhole } from 'lucide-react';
import { SaveButton } from './SaveButton';

interface DropActionsProps {
  dropId: string;
  isUnlocked: boolean;
  isSaved: boolean;
  commentCount: number;
  onSaveChange: (isSaved: boolean) => void;
  onReflect: () => void;
  onCommentToggle: () => void;
  onShare: () => void;
}

// Deliberately not an Instagram-style icon row — no like count, no share
// count on display. Save and Reflect are always available (reflecting is
// a private note, allowed even while a drop is still sealed); Comment and
// Share only appear once there's actually something to comment on or
// share.
export const DropActions: React.FC<DropActionsProps> = ({
  dropId, isUnlocked, isSaved, commentCount, onSaveChange, onReflect, onCommentToggle, onShare,
}) => (
  <div className="flex items-center gap-4 px-4 py-3 border-t border-gray-50">
    <SaveButton dropId={dropId} isSaved={isSaved} onChange={onSaveChange} />

    <button
      type="button"
      onClick={onReflect}
      className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-purple-600 transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none rounded-lg px-1.5 py-1 -mx-1.5"
    >
      <Feather size={16} aria-hidden="true" />
      Reflect
    </button>

    {isUnlocked ? (
      <>
        <button
          type="button"
          onClick={onCommentToggle}
          className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-purple-600 transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none rounded-lg px-1.5 py-1 -mx-1.5"
        >
          <MessageCircle size={17} aria-hidden="true" />
          {commentCount > 0 ? commentCount : ''}
        </button>

        <button
          type="button"
          onClick={onShare}
          aria-label="Share this memory"
          className="ml-auto flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-purple-600 transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none rounded-lg px-1.5 py-1 -mx-1.5"
        >
          <Share2 size={16} aria-hidden="true" />
        </button>
      </>
    ) : (
      <span className="ml-auto flex items-center gap-1 text-xs text-gray-300">
        <LockKeyhole size={11} aria-hidden="true" />
        Comment & share unlock with the memory
      </span>
    )}
  </div>
);
