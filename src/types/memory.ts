import type { Mood } from './feed';
import type { CapsuleMediaItem, CapsuleMemoryType, CapsuleVisibility } from './capsule';

export type MemorySourceType = 'capsule' | 'moment';
export type MemoryLayout = 'timeline' | 'journal' | 'grid' | 'list';
export type MemorySort = 'newest' | 'oldest';

// The unified shape get_memories()/get_memory() return — a Capsule and
// an expired Moment normalized into one row. visibility is collapsed to
// the same 3-value space Capsules already use (a Moment's `close_friends`
// maps to `followers` here as the closest analog — an approximation,
// noted in the README).
export interface Memory {
  id: string;
  memory_type: MemorySourceType;
  user_id: string;
  username: string;
  display_name: string | null;
  profile_photo_url: string | null;
  title: string | null;
  caption: string | null;
  media: CapsuleMediaItem[];
  memory_types: CapsuleMemoryType[];
  mood: Mood | null;
  location_text: string | null;
  tags: string[];
  visibility: CapsuleVisibility;
  is_unlocked: boolean;
  is_own: boolean;
  is_favorited: boolean;
  is_hidden: boolean;
  view_count: number;
  like_count: number;
  comment_count: number;
  matured_at: string;
  created_at: string;
}

export interface MemoryFilters {
  search: string;
  lockStatus: 'locked' | 'unlocked' | null;
  year: number | null;
  month: number | null;
  mood: Mood | null;
  visibility: CapsuleVisibility | null;
  mediaType: CapsuleMemoryType | null;
  favoritesOnly: boolean;
  collectionId: string | null;
}

export const EMPTY_MEMORY_FILTERS: MemoryFilters = {
  search: '', lockStatus: null, year: null, month: null, mood: null,
  visibility: null, mediaType: null, favoritesOnly: false, collectionId: null,
};

export interface MemoryCollection {
  id: string;
  name: string;
  icon: string | null;
  is_default: boolean;
  item_count: number;
  created_at: string;
}

export interface Flashback {
  id: string;
  memory_type: MemorySourceType;
  title: string | null;
  caption: string | null;
  media: CapsuleMediaItem[];
  mood: Mood | null;
  created_at: string;
  years_ago: number;
}

export type HighlightType = 'best_month' | 'most_viewed' | 'most_reacted';

export interface HighlightCandidate {
  id: string;
  memory_type: MemorySourceType;
  title: string | null;
  caption: string | null;
  media: CapsuleMediaItem[];
  mood: Mood | null;
  created_at: string;
  score: number;
}

export interface MemoryStreak {
  current_streak: number;
  longest_streak: number;
}

export const HIGHLIGHT_META: Record<HighlightType, { label: string; description: string }> = {
  best_month: { label: 'Best memories this month', description: 'Your most-loved memories from the last 30 days.' },
  most_viewed: { label: 'Most viewed memories', description: "Memories that got the most attention." },
  most_reacted: { label: 'Most reacted memories', description: 'The ones that got the warmest response.' },
};

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
