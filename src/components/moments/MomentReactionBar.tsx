import React, { useState } from 'react';
import { useMoments } from '../../hooks/useMoments';
import { MOMENT_QUICK_REACTIONS } from '../../types/moment';

interface MomentReactionBarProps {
  momentId: string;
  myReaction: string | null;
  onChange: (emoji: string | null) => void;
}

// A small curated set, not a full reaction picker — tapping your current
// reaction again clears it rather than re-sending it.
export const MomentReactionBar: React.FC<MomentReactionBarProps> = ({ momentId, myReaction, onChange }) => {
  const { reactToMoment, removeMomentReaction } = useMoments();
  const [busy, setBusy] = useState(false);

  const react = async (emoji: string) => {
    if (busy) return;
    setBusy(true);
    const next = myReaction === emoji ? null : emoji;
    onChange(next);
    const { error } = next ? await reactToMoment(momentId, next) : await removeMomentReaction(momentId);
    if (error) onChange(myReaction);
    setBusy(false);
  };

  return (
    <div className="flex items-center gap-1.5" role="group" aria-label="React to this moment">
      {MOMENT_QUICK_REACTIONS.map(emoji => (
        <button
          key={emoji}
          type="button"
          onClick={() => react(emoji)}
          aria-pressed={myReaction === emoji}
          className={[
            'text-xl leading-none w-9 h-9 rounded-full flex items-center justify-center transition-transform',
            'hover:scale-110 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none',
            myReaction === emoji ? 'bg-white/25 scale-110' : '',
          ].join(' ')}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
};
