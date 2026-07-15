import React from 'react';
import { MessageCircle, Share2 } from 'lucide-react';
import { SaveButton } from './SaveButton';
import { SparkleDropButton } from './SparkleDropButton';
import { InterestActions } from './InterestActions';
import type { Drop, InterestType } from '../../types/feed';

interface DropActionsProps {
  drop: Drop;
  onUpdate: (patch: Partial<Drop>) => void;
  onCommentToggle: () => void;
  onShare: () => void;
}

// Two entirely different action rows depending on lock state — not one
// row with buttons disabled. Locked: four positive anticipation reactions.
// Unlocked: Sparkle Drop, Comment, Save, Share — the only point these
// ever appear at all.
export const DropActions: React.FC<DropActionsProps> = ({ drop, onUpdate, onCommentToggle, onShare }) => {
  if (!drop.is_unlocked) {
    const handleInterestChange = (type: InterestType, isActive: boolean) => {
      const delta = isActive ? 1 : -1;
      switch (type) {
        case 'save_to_unlock':
          onUpdate({ is_saved_to_unlock: isActive, save_to_unlock_count: Math.max(0, drop.save_to_unlock_count + delta) });
          break;
        case 'interested':
          onUpdate({ is_interested: isActive, interested_count: Math.max(0, drop.interested_count + delta) });
          break;
        case 'cant_wait':
          onUpdate({ is_cant_wait: isActive, cant_wait_count: Math.max(0, drop.cant_wait_count + delta) });
          break;
        case 'good_vibes':
          onUpdate({ is_good_vibes: isActive, good_vibes_count: Math.max(0, drop.good_vibes_count + delta) });
          break;
      }
    };

    return (
      <InterestActions
        dropId={drop.id}
        counts={{
          save_to_unlock: drop.save_to_unlock_count,
          interested: drop.interested_count,
          cant_wait: drop.cant_wait_count,
          good_vibes: drop.good_vibes_count,
        }}
        active={{
          save_to_unlock: drop.is_saved_to_unlock,
          interested: drop.is_interested,
          cant_wait: drop.is_cant_wait,
          good_vibes: drop.is_good_vibes,
        }}
        onChange={handleInterestChange}
      />
    );
  }

  return (
    <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-50 dark:border-gray-800">
      <SparkleDropButton
        dropId={drop.id}
        isSparkled={drop.is_liked}
        sparkleCount={drop.like_count}
        onChange={(isSparkled, sparkleCount) => onUpdate({ is_liked: isSparkled, like_count: sparkleCount })}
      />

      <button
        type="button"
        onClick={onCommentToggle}
        aria-label="Comments"
        className="inline-flex items-center gap-1.5 rounded-full pl-2.5 pr-3 py-1.5 text-xs font-semibold bg-gray-50 dark:bg-gray-800/70 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/70 transition-all focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none"
      >
        <MessageCircle size={14} aria-hidden="true" />
        {drop.comment_count > 0 && drop.comment_count}
      </button>

      <SaveButton dropId={drop.id} isSaved={drop.is_saved} onChange={isSaved => onUpdate({ is_saved: isSaved })} />

      <button
        type="button"
        onClick={onShare}
        aria-label="Share this memory"
        className="ml-auto inline-flex items-center gap-1.5 rounded-full p-2 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/70 hover:bg-gray-100 dark:hover:bg-gray-700/70 transition-all focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none"
      >
        <Share2 size={14} aria-hidden="true" />
      </button>
    </div>
  );
};
