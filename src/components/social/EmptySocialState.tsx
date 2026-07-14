import React from 'react';
import { Users, UserPlus, Search, Sparkles, Lock } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';

type SocialEmptyVariant = 'followers' | 'following' | 'requests' | 'sent-requests' | 'search' | 'suggestions' | 'private';

const VARIANTS: Record<SocialEmptyVariant, { icon: typeof Users; title: string; description: string }> = {
  followers: { icon: Users, title: 'No one is Orbiting you yet.', description: 'When people orbit this account, they\'ll show up here.' },
  following: { icon: UserPlus, title: 'You\'re not in anyone\'s Orbit yet.', description: 'Accounts this person orbits will show up here.' },
  requests: { icon: UserPlus, title: 'No Orbit requests', description: 'Requests to join your Orbit will show up here.' },
  'sent-requests': { icon: UserPlus, title: 'No pending requests', description: 'Requests you\'ve sent will show up here until they\'re accepted.' },
  search: { icon: Search, title: 'No results', description: 'Try a different username or name.' },
  suggestions: { icon: Sparkles, title: 'No suggestions right now', description: 'Start discovering creators and build your Orbit.' },
  private: { icon: Lock, title: 'This account is private', description: 'Orbit this account to see this.' },
};

// A thin preset layer over EmptyState — every Phase 3 empty case (no
// orbiters, no results, private, ...) shares the same visual shape, just
// different icon/copy, so this exists instead of five near-identical
// EmptyState call sites scattered across pages.
export const EmptySocialState: React.FC<{ variant: SocialEmptyVariant }> = ({ variant }) => {
  const { icon, title, description } = VARIANTS[variant];
  return <EmptyState icon={icon} title={title} description={description} />;
};
