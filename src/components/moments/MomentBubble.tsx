import React from 'react';
import { Avatar } from '../ui/Avatar';

interface MomentBubbleProps {
  name: string;
  photoUrl: string | null;
  hasUnviewed: boolean;
  label: string;
  onClick: () => void;
}

// The gradient ring is the entire "unviewed" signal — no badge, no dot,
// no count. Once every moment from this person has been seen, the ring
// fades to a plain gray outline rather than disappearing outright, so the
// bubble stays reachable without competing for attention.
export const MomentBubble: React.FC<MomentBubbleProps> = ({ name, photoUrl, hasUnviewed, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex flex-col items-center gap-1.5 w-16 flex-shrink-0 focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none rounded-2xl py-1"
  >
    <span
      className={[
        'w-16 h-16 rounded-full flex items-center justify-center p-[2.5px]',
        hasUnviewed ? 'bg-gradient-to-br from-purple-500 via-fuchsia-500 to-blue-500' : 'bg-gray-200',
      ].join(' ')}
    >
      <span className="w-full h-full rounded-full bg-white flex items-center justify-center">
        <Avatar src={photoUrl} name={name} size="lg" />
      </span>
    </span>
    <span className="text-xs text-gray-600 truncate w-full text-center">{label}</span>
  </button>
);
