import type { Mood } from './feed';

export type MomentMediaType = 'photo' | 'video' | 'text';
export type MomentPrivacy = 'everyone' | 'followers' | 'close_friends' | 'only_me';
export type MomentDurationHours = 12 | 24 | 48;

// One row per active moment — what builds the tray. The client groups
// these by user_id; is_viewed on each row (not a separate aggregate)
// tells the tray whether that author's ring should render as unviewed.
export interface MomentTrayItem {
  id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  profile_photo_url: string | null;
  media_type: MomentMediaType;
  mood: Mood | null;
  expires_at: string;
  created_at: string;
  is_viewed: boolean;
}

// Full moment content — returned by get_user_moments (a stack) and
// get_moment (a single permalink). view_count is only ever non-zero for
// the moment's own owner; everyone else always gets 0, same as
// Instagram never showing a story's view count to anyone but its author.
export interface Moment {
  id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  profile_photo_url: string | null;
  text_content: string | null;
  media_url: string | null;
  media_type: MomentMediaType;
  mood: Mood | null;
  location_text: string | null;
  mentioned_username: string | null;
  privacy: MomentPrivacy;
  duration_hours: MomentDurationHours;
  expires_at: string;
  is_owner: boolean;
  is_expired: boolean;
  view_count: number;
  my_reaction: string | null;
  is_viewed: boolean;
  created_at: string;
}

export interface MomentSeenEntry {
  viewer_id: string;
  username: string;
  display_name: string | null;
  profile_photo_url: string | null;
  viewed_at: string;
}

export interface MomentReactionSummary {
  emoji: string;
  reaction_count: number;
}

export interface MomentReply {
  id: string;
  content: string;
  created_at: string;
}

export const MOMENT_PRIVACY_META: Record<MomentPrivacy, { label: string; description: string }> = {
  everyone: { label: 'Everyone', description: 'Anyone who can see your posts can see this moment.' },
  followers: { label: 'Followers', description: 'Only people who follow you can see it.' },
  close_friends: { label: 'Close Friends', description: "Only your Close Friends list can see it — nobody's on it yet, so this is just you for now." },
  only_me: { label: 'Only Me', description: "Just for you — a private moment nobody else will see." },
};

export const MOMENT_DURATIONS: MomentDurationHours[] = [12, 24, 48];

// Curated quick-tap set — deliberately small and warm rather than a full
// reaction picker; the EmojiPicker component covers "something else."
export const MOMENT_QUICK_REACTIONS = ['❤️', '🔥', '😍', '😮', '🙏', '😂'];

export const MOMENT_TEXT_MAX = 500;
export const MOMENT_REPLY_MAX = 500;
export const MOMENT_LOCATION_MAX = 60;
