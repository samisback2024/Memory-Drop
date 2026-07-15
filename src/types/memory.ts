import type { Mood } from './feed';
import type { CapsuleMediaItem, CapsuleMemoryType, CapsuleVisibility } from './capsule';

export type MemorySourceType = 'drop' | 'capsule' | 'moment';
export type MemoryLayout = 'timeline' | 'journal' | 'grid' | 'list';
export type MemorySort = 'newest' | 'oldest';

// The unified shape get_memories()/get_memory() return — an unlocked
// Drop, a Capsule, and an expired Moment all normalized into one row
// (Phase 9 widened this from Capsule+Moment only). visibility is
// collapsed to the same 3-value space Capsules already use (a Moment's
// `close_friends` maps to the Orbit tier, a Drop's `private` maps to
// `only_me` — both approximations, noted in the README). A Drop's
// `title` is always null (Drops never had a title field); `tags`/
// `location_text` are always empty/null for Drops — those two only
// exist on Capsules/Moments.
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

export type MemoryActivityType = 'dropped' | 'unlocked' | 'saved';

// Same row shape as Memory, plus which event this is and when it
// happened — a single Drop can appear once per activity type across
// different days (dropped on day X, unlocked on day Y, saved by you
// on day Z), so this is intentionally not deduplicated by id.
export interface MemoryActivity extends Memory {
  activity_type: MemoryActivityType;
  activity_at: string;
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

// get_memory_stats() — the caller's own accurate counts, live-aggregated
// (never a separately-tracked counter that could drift). locked_items/
// unlocked_items are combined across Drops+Capsules+Moments; total_drops
// is Drops specifically, kept distinct on purpose.
export interface MemoryStats {
  total_drops: number;
  locked_items: number;
  unlocked_items: number;
  expired_moments: number;
  saved_to_unlock: number;
  public_drops: number;
  orbiting_count: number;
  in_orbit_count: number;
  total_views: number;
  total_unlocks: number;
  total_reactions: number;
  total_comments: number;
  total_moments: number;
  interested_received: number;
  cant_wait_received: number;
  good_vibes_received: number;
}

// get_public_stats(user_id) — what anyone is allowed to know about
// someone else. Never leaks locked content, private/only-me/Orbit
// visibility, saved-to-unlock, views, reactions, or comments.
// Every field beyond public_memories_count/orbiting_count/
// in_orbit_count is only ever non-null if the profile owner opted
// that specific stat into public visibility (Settings → Privacy) —
// null means "hidden," not "zero."
export interface PublicStats {
  public_memories_count: number;
  orbiting_count: number;
  in_orbit_count: number;
  total_drops: number | null;
  locked_items: number | null;
  unlocked_items: number | null;
  expired_moments: number | null;
  saved_to_unlock: number | null;
  public_drops: number | null;
  total_views: number | null;
  total_unlocks: number | null;
  total_reactions: number | null;
  total_comments: number | null;
  total_moments: number | null;
  interested_received: number | null;
  cant_wait_received: number | null;
  good_vibes_received: number | null;
}

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Phase 10a — Search + Explore. search_memories()/get_explore_feed()
// return the exact same row shape as get_memories()/get_memory() above
// (Memory), reused as-is so GridView/ListView/MemoryCard need no changes
// to render search results or Explore. Only these smaller, search-only
// shapes are new.
export interface RecentSearch {
  query: string;
  searched_at: string;
}

export interface TrendingSearch {
  query: string;
  search_count: number;
}

export type SearchSuggestionType = 'user' | 'trending';

export interface SearchSuggestion {
  suggestion: string;
  suggestion_type: SearchSuggestionType;
}

export interface CollectionSearchResult {
  id: string;
  name: string;
  icon: string | null;
  is_default: boolean;
  item_count: number;
}

// Revised Phase 10 spec's exact section list. The two "person" tabs
// return SocialUser-shaped rows (get_new_creators()/get_suggested_
// friends()), not Memory rows — ExplorePage branches its renderer on
// PERSON_TABS below rather than trying to force both shapes through
// one generic type.
export type ExploreTab =
  | 'unlocking_soon' | 'todays_unlocks' | 'recently_unlocked'
  | 'popular_public_drops' | 'public_capsules'
  | 'new_creators' | 'suggested_people';

export const PERSON_TABS: ExploreTab[] = ['new_creators', 'suggested_people'];

// Phase 10c — Bookmark Experience. get_saved_memories() unifies
// saved_posts (Drops) + capsule_saves (Capsules) — Moments have no save
// concept anywhere in this app.
export interface SavedMemory extends Memory {
  saved_at: string;
  note: string | null;
}

// Phase 10b — Profile Polish.
export interface PinnedMemory extends Memory {
  pinned_at: string;
}

export type ActivityEventType = 'created' | 'commented';

export interface ActivityItem {
  activity_type: ActivityEventType;
  source_type: MemorySourceType;
  source_id: string;
  snippet: string | null;
  created_at: string;
}

export const EXPLORE_TABS: { id: ExploreTab; label: string }[] = [
  { id: 'unlocking_soon', label: 'Unlocking Soon' },
  { id: 'todays_unlocks', label: "Today's Unlocks" },
  { id: 'recently_unlocked', label: 'Recently Unlocked' },
  { id: 'popular_public_drops', label: 'Popular Public Drops' },
  { id: 'public_capsules', label: 'Public Capsules' },
  { id: 'new_creators', label: 'New Creators' },
  { id: 'suggested_people', label: 'Suggested People' },
];
