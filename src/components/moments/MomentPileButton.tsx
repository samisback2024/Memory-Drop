import React from 'react';
import { Sparkles } from 'lucide-react';

interface MomentPileButtonProps {
  onClick: () => void;
}

// A small floating capsule, always resting in the bottom-right corner —
// a second, more playful entry point into Moments alongside the left
// MomentSidebar rail. Tapping it opens MomentPileGround, a full-screen
// "ground" where every open moment (yours to post more, everyone
// else's to view) is piled up as its own glossy capsule. Positioned
// above MobileNav's bottom bar (which only exists below `sm`) with a
// bottom offset rather than a z-index fight.
export const MomentPileButton: React.FC<MomentPileButtonProps> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Open your Moments capsule"
    className="fixed bottom-24 right-4 sm:bottom-8 sm:right-8 z-30 focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none rounded-full"
  >
    <span className="relative flex items-center justify-center w-14 h-[4.5rem] animate-capsule-float">
      {/* Sparkle particles orbiting the capsule — purely decorative,
          staggered via inline animation-delay so they don't twinkle in
          unison. */}
      <Sparkles size={11} className="absolute -top-1 -left-1 text-purple-300 animate-sparkle-twinkle" style={{ animationDelay: '0s' }} aria-hidden="true" />
      <Sparkles size={9} className="absolute top-1 -right-2 text-blue-300 animate-sparkle-twinkle" style={{ animationDelay: '0.7s' }} aria-hidden="true" />
      <Sparkles size={8} className="absolute -bottom-1 left-0 text-fuchsia-300 animate-sparkle-twinkle" style={{ animationDelay: '1.4s' }} aria-hidden="true" />

      {/* The capsule itself: a tall pill with a glossy top highlight and
          a real drop shadow for lift, tactile on press. */}
      <span className="relative w-11 h-full rounded-full bg-gradient-to-b from-purple-400 via-purple-600 to-blue-600 shadow-[0_10px_24px_-6px_rgba(124,58,237,0.55)] tactile overflow-hidden">
        <span className="absolute -top-1 left-1.5 w-6 h-8 rounded-full bg-white/40 blur-[3px] rotate-[-18deg]" aria-hidden="true" />
        <span className="absolute inset-x-0 top-1/2 h-px bg-white/25" aria-hidden="true" />
      </span>
    </span>
  </button>
);
