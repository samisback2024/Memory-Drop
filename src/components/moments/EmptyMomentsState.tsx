import React from 'react';
import { Sparkles, Archive } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';

type EmptyMomentsVariant = 'active' | 'archive';

const VARIANTS: Record<EmptyMomentsVariant, { icon: typeof Sparkles; title: string; description: string }> = {
  active: { icon: Sparkles, title: 'No moments yet', description: 'Add a photo, video, or a few words — it sticks around for 12, 24, or 48 hours, then it\'s just yours.' },
  archive: { icon: Archive, title: 'Nothing in your archive yet', description: 'Moments move here once they expire — still yours to look back on, never anyone else\'s.' },
};

export const EmptyMomentsState: React.FC<{ variant: EmptyMomentsVariant }> = ({ variant }) => {
  const { icon, title, description } = VARIANTS[variant];
  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/60 shadow-sm">
      <EmptyState icon={icon} title={title} description={description} />
    </div>
  );
};
