import React from 'react';

export type OnboardingArtKind = 'welcome' | 'drop' | 'capsule' | 'moment' | 'memories';

// Original vector scenes, one per onboarding slide — no stock or generated
// photography involved. Drawn on a fixed 240x500 (portrait) canvas. Scaled
// with `meet` rather than `slice`: on a wide desktop viewport (very
// different aspect ratio from a phone), `slice` crops in so far the scene
// becomes an unrecognizable close-up — `meet` always shows the whole
// composition, letterboxed by the surrounding gradient on wide screens.
const Blobs: React.FC = () => (
  <>
    <circle cx="10" cy="60" r="110" fill="white" opacity="0.07" />
    <circle cx="230" cy="240" r="90" fill="white" opacity="0.06" />
  </>
);

const SCENES: Record<OnboardingArtKind, React.ReactNode> = {
  welcome: (
    <>
      <Blobs />
      <g>
        <rect x="60" y="150" width="52" height="66" rx="8" fill="white" fillOpacity="0.9" transform="rotate(-10 86 183)" />
        <rect x="96" y="130" width="52" height="66" rx="8" fill="white" fillOpacity="0.98" transform="rotate(4 122 163)" />
        <rect x="130" y="158" width="52" height="66" rx="8" fill="white" fillOpacity="0.85" transform="rotate(14 156 191)" />
        <circle cx="122" cy="118" r="3" fill="white" opacity="0.7" />
        <circle cx="90" cy="112" r="2.2" fill="white" opacity="0.6" />
        <circle cx="156" cy="112" r="2.2" fill="white" opacity="0.6" />
      </g>
    </>
  ),
  drop: (
    <>
      <Blobs />
      <g>
        <path d="M120 96 v34" stroke="white" strokeWidth="3" strokeLinecap="round" strokeDasharray="1 8" opacity="0.7" />
        <rect x="82" y="132" width="76" height="92" rx="12" fill="white" />
        <rect x="94" y="146" width="52" height="38" rx="6" fill="#c9b8f5" />
        <rect x="94" y="192" width="36" height="6" rx="3" fill="#e3d9fb" />
        <rect x="94" y="203" width="24" height="6" rx="3" fill="#e3d9fb" />
        <circle cx="150" cy="150" r="12" fill="#7c3aed" />
        <path d="M145 150 l4 4 8-8" stroke="white" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </>
  ),
  capsule: (
    <>
      <Blobs />
      <g>
        <ellipse cx="120" cy="220" rx="46" ry="10" fill="black" opacity="0.12" />
        <rect x="86" y="120" width="68" height="100" rx="34" fill="white" fillOpacity="0.95" />
        <rect x="86" y="120" width="68" height="46" rx="34" fill="#c9b8f5" fillOpacity="0.55" />
        <circle cx="120" cy="170" r="20" fill="#3b2065" />
        <circle cx="120" cy="170" r="20" fill="none" stroke="white" strokeWidth="2" />
        <path d="M120 160 v10 l7 5" stroke="white" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="112" y="108" width="16" height="14" rx="3" fill="white" opacity="0.9" />
      </g>
    </>
  ),
  moment: (
    <>
      <Blobs />
      <g>
        <circle
          cx="120"
          cy="168"
          r="46"
          fill="none"
          stroke="white"
          strokeOpacity="0.35"
          strokeWidth="4"
          strokeDasharray="120 180"
          strokeLinecap="round"
          transform="rotate(-90 120 168)"
        />
        <path d="M120 132 l11 26 28 3 -21 19 6 28 -24 -15 -24 15 6-28 -21-19 28-3 z" fill="white" />
        <circle cx="168" cy="126" r="3" fill="white" opacity="0.8" />
        <circle cx="72" cy="200" r="2.4" fill="white" opacity="0.7" />
        <circle cx="176" cy="196" r="2" fill="white" opacity="0.6" />
      </g>
    </>
  ),
  memories: (
    <>
      <Blobs />
      <g>
        <path d="M74 138 h44 a8 8 0 0 1 8 8 v78 h-52 a8 8 0 0 1 -8 -8 v-70 a8 8 0 0 1 8 -8 z" fill="white" fillOpacity="0.95" />
        <path d="M166 138 h-44 a8 8 0 0 0 -8 8 v78 h52 a8 8 0 0 0 8 -8 v-70 a8 8 0 0 0 -8 -8 z" fill="white" />
        <rect x="82" y="152" width="28" height="20" rx="3" fill="#c9b8f5" />
        <rect x="82" y="178" width="28" height="5" rx="2.5" fill="#e3d9fb" />
        <rect x="82" y="188" width="20" height="5" rx="2.5" fill="#e3d9fb" />
        <path d="M120 118 l8 22 -8 -6 -8 6 z" fill="#ff6b8a" />
      </g>
    </>
  ),
};

interface OnboardingArtProps {
  kind: OnboardingArtKind;
  className?: string;
}

export const OnboardingArt: React.FC<OnboardingArtProps> = ({ kind, className }) => (
  <svg viewBox="0 0 240 500" preserveAspectRatio="xMidYMid meet" className={className} aria-hidden="true">
    {SCENES[kind]}
  </svg>
);
