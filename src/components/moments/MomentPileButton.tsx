import React from 'react';

interface MomentPileButtonProps {
  onClick: () => void;
}

// A small floating capsule, always resting in the bottom-right corner —
// the one entry point into Moments now that the old left sidebar rail
// is gone. Tapping it opens MomentPileGround, a full-screen "ground"
// where every open moment (yours to post more, everyone else's to
// view) is piled up as its own capsule. Positioned above MobileNav's
// bottom bar (which only exists below `sm`) with a bottom offset
// rather than a z-index fight.
export const MomentPileButton: React.FC<MomentPileButtonProps> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Open your Moments capsule"
    className="fixed bottom-24 right-4 sm:bottom-8 sm:right-8 z-30 focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none rounded-full"
  >
    <span className="relative flex items-center justify-center w-14 h-[4.5rem]">
      {/* The capsule itself: a tall pill with a real drop shadow for
          lift, tactile on press. */}
      <span className="relative w-11 h-full rounded-full bg-purple-600 shadow-[0_10px_24px_-6px_rgba(124,58,237,0.55)] tactile overflow-hidden" />
    </span>
  </button>
);
