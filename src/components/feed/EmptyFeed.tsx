import React from 'react';
import { Users, Compass, TrendingUp, Clock, Bookmark } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';
import type { FeedTab } from '../../types/feed';

type EmptyFeedVariant = FeedTab | 'saved';

const VARIANTS: Record<EmptyFeedVariant, { icon: typeof Users; title: string; description: string }> = {
  following: { icon: Users, title: 'Your feed is quiet', description: 'Follow a few people to see their posts here.' },
  discover: { icon: Compass, title: 'Nothing to discover yet', description: 'Public posts will show up here as people start sharing.' },
  trending: { icon: TrendingUp, title: 'Nothing trending yet', description: 'The most-liked posts you can see will show up here.' },
  recent: { icon: Clock, title: 'No posts yet', description: 'New posts you can see will show up here.' },
  saved: { icon: Bookmark, title: 'No saved posts', description: 'Posts you save will show up here.' },
};

export const EmptyFeed: React.FC<{ variant: EmptyFeedVariant }> = ({ variant }) => {
  const { icon, title, description } = VARIANTS[variant];
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
      <EmptyState icon={icon} title={title} description={description} />
    </div>
  );
};
