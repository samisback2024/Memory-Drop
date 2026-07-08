import React from 'react';
import { Users, UserPlus, Search, Sparkles, Lock } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';

type SocialEmptyVariant = 'followers' | 'following' | 'requests' | 'sent-requests' | 'search' | 'suggestions' | 'private';

const VARIANTS: Record<SocialEmptyVariant, { icon: typeof Users; title: string; description: string }> = {
  followers: { icon: Users, title: 'No followers yet', description: 'When people follow this account, they\'ll show up here.' },
  following: { icon: UserPlus, title: 'Not following anyone yet', description: 'Accounts this person follows will show up here.' },
  requests: { icon: UserPlus, title: 'No follow requests', description: 'Requests to follow you will show up here.' },
  'sent-requests': { icon: UserPlus, title: 'No pending requests', description: 'Requests you\'ve sent will show up here until they\'re accepted.' },
  search: { icon: Search, title: 'No results', description: 'Try a different username or name.' },
  suggestions: { icon: Sparkles, title: 'No suggestions right now', description: 'Follow a few people and we\'ll find more accounts for you.' },
  private: { icon: Lock, title: 'This account is private', description: 'Follow this account to see this.' },
};

// A thin preset layer over EmptyState — every Phase 3 empty case (no
// followers, no results, private, ...) shares the same visual shape, just
// different icon/copy, so this exists instead of five near-identical
// EmptyState call sites scattered across pages.
export const EmptySocialState: React.FC<{ variant: SocialEmptyVariant }> = ({ variant }) => {
  const { icon, title, description } = VARIANTS[variant];
  return <EmptyState icon={icon} title={title} description={description} />;
};
