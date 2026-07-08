import React from 'react';
import { Sparkles, Clock, CalendarClock, Compass, Bookmark } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';
import type { DropTab } from '../../types/feed';

type EmptyDropVariant = DropTab | 'saved';

const VARIANTS: Record<EmptyDropVariant, { icon: typeof Sparkles; title: string; description: string }> = {
  my_drops: { icon: Sparkles, title: 'No memories dropped yet', description: 'Capture your first moment — write, snap, or record something for later.' },
  unlocking_soon: { icon: Clock, title: 'Nothing sealed right now', description: 'Drops you or people you follow set for the future will count down here.' },
  today_unlocks: { icon: CalendarClock, title: 'Nothing unlocking today', description: 'Check back — memories set to open today will appear here.' },
  public_drops: { icon: Compass, title: 'No public drops yet', description: 'Unlocked public memories from the community will show up here.' },
  saved: { icon: Bookmark, title: 'No saved memories', description: 'Drops you save will show up here.' },
};

export const EmptyDropState: React.FC<{ variant: EmptyDropVariant }> = ({ variant }) => {
  const { icon, title, description } = VARIANTS[variant];
  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/60 shadow-sm">
      <EmptyState icon={icon} title={title} description={description} />
    </div>
  );
};
