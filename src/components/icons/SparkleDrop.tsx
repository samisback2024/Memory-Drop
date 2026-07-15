import React from 'react';

interface SparkleDropProps {
  size?: number | string;
  className?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
}

// Memory Drop's own appreciation mark — a faceted, crystal-cut droplet
// with a small sparkle accent, replacing every heart icon in the app
// (see the Sparkle Drop reaction: LikeButton.tsx, CapsuleCard.tsx).
// Follows the same convention every Lucide icon in this codebase already
// uses — root fill="none"/stroke="currentColor" so a consumer's
// `className="fill-*"` toggles the droplet solid (the sparkle accent
// always stays solid, it has its own fill so it isn't affected by that
// toggle) — so this drops into any spot a <Heart .../> used to sit
// without changing how the surrounding component controls it.
export const SparkleDrop: React.FC<SparkleDropProps> = ({ size = 20, className, ...rest }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...rest}
  >
    <path d="M11.5 3.2c3.4 4.1 5.7 7.5 5.7 10.4a5.7 5.7 0 1 1-11.4 0c0-2.9 2.3-6.3 5.7-10.4z" />
    <path d="M11.5 9.2v7.6" strokeWidth={1.1} opacity={0.55} />
    <path d="M8.7 12.1l2.8-2.9 2.8 2.9" strokeWidth={1.1} opacity={0.55} />
    <path d="M18.3 3.6l.55 1.5 1.5.55-1.5.55-.55 1.5-.55-1.5-1.5-.55 1.5-.55z" fill="currentColor" stroke="none" />
  </svg>
);
