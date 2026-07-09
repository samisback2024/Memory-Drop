import React from 'react';
import { Sparkles, Clock, CalendarClock, Compass, Bookmark, Users, Star } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';
import type { DropTab } from '../../types/feed';

type EmptyDropVariant = DropTab | 'saved';

const VARIANTS: Record<EmptyDropVariant, { icon: typeof Sparkles; title: string; description: string }> = {
  my_drops: { icon: Sparkles, title: 'No memories dropped yet', description: 'Capture your first moment — write, snap, or record something for later.' },
  following: { icon: Users, title: 'No drops from people you follow', description: "Memories from people you follow — sealed or opened — will show up here." },
  public_drops: { icon: Compass, title: 'No public drops yet', description: 'Public memories from the community, sealed or opened, will show up here.' },
  unlocking_soon: { icon: Clock, title: 'Nothing sealed right now', description: 'Drops still counting down — yours, your friends\', or public ones — will appear here.' },
  today_unlocks: { icon: CalendarClock, title: 'Nothing unlocking today', description: 'Check back — memories set to open today will appear here.' },
  saved_to_unlock: { icon: Star, title: 'Nothing saved to unlock', description: "Tap “Save to Unlock” on a sealed drop and it'll wait for you here." },
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
