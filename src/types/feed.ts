export type MemoryType = 'photo' | 'video' | 'audio' | 'text';
export type DropTab = 'my_drops' | 'following' | 'public_drops' | 'saved_to_unlock';
export type Visibility = 'public' | 'followers' | 'private';
export type Mood = 'joyful' | 'grateful' | 'nostalgic' | 'hopeful' | 'reflective' | 'peaceful' | 'bittersweet' | 'excited';
export type ReportReason = 'spam' | 'harassment' | 'violence' | 'nudity' | 'fake_account' | 'other';

// The four positive, pre-unlock-only reactions — deliberately not a
// like/dislike or a generic emoji-reaction picker. Enforced server-side
// as locked-drop-only (see phase4d_engagement.sql); once a drop unlocks,
// Like/Comment/Save take over instead.
export type InterestType = 'interested' | 'cant_wait' | 'good_vibes' | 'save_to_unlock';

export interface DropImage {
  url: string;
  position: number;
}

// Mirrors the row shape returned by get_drops_feed / get_saved_drops /
// get_drop. caption/images/video_url/audio_url are all null while the drop
// is still locked — that's enforced server-side (see phase4b_time_capsule_
// redesign.sql), not just hidden in the UI, so there's no way to peek at
// your own sealed memory early by reading the network response.
export interface Drop {
  id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  profile_photo_url: string | null;
  is_private: boolean;
  caption: string | null;
  post_type: MemoryType;
  video_url: string | null;
  audio_url: string | null;
  images: DropImage[];
  mood: Mood | null;
  visibility: Visibility;
  unlock_date: string;
  is_unlocked: boolean;
  like_count: number;
  is_liked: boolean;
  comment_count: number;
  share_count: number;
  save_count: number;
  is_saved: boolean;
  interested_count: number;
  cant_wait_count: number;
  good_vibes_count: number;
  save_to_unlock_count: number;
  is_interested: boolean;
  is_cant_wait: boolean;
  is_good_vibes: boolean;
  is_saved_to_unlock: boolean;
  created_at: string;
}

// A soft-deleted drop, as returned by get_deleted_drops() — see
// supabase/phase14s_soft_delete_drops.sql. Only reachable from Settings
// -> Deleted; days_remaining counts down to the automatic purge.
export interface DeletedDrop {
  id: string;
  caption: string | null;
  post_type: MemoryType;
  video_url: string | null;
  audio_url: string | null;
  images: DropImage[];
  mood: Mood | null;
  visibility: Visibility;
  deleted_at: string;
  days_remaining: number;
  created_at: string;
}

// Regular comments now live in types/comment.ts (Comment) — shared with
// Capsules since Phase 10d unified both comment UIs into one component.

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: 'Spam',
  harassment: 'Harassment',
  violence: 'Violence',
  nudity: 'Nudity',
  fake_account: 'Fake account',
  other: 'Other',
};

export const MOOD_META: Record<Mood, { emoji: string; label: string }> = {
  joyful: { emoji: '😊', label: 'Joyful' },
  grateful: { emoji: '🙏', label: 'Grateful' },
  nostalgic: { emoji: '🌇', label: 'Nostalgic' },
  hopeful: { emoji: '🌱', label: 'Hopeful' },
  reflective: { emoji: '🌙', label: 'Reflective' },
  peaceful: { emoji: '🕊️', label: 'Peaceful' },
  bittersweet: { emoji: '🍂', label: 'Bittersweet' },
  excited: { emoji: '✨', label: 'Excited' },
};

export const VISIBILITY_META: Record<Visibility, { label: string; description: string }> = {
  public: { label: 'Everyone', description: 'Anyone can find it once unlocked — appears in Public Drops.' },
  followers: { label: 'Followers', description: 'Only people who follow you can see it once unlocked.' },
  private: { label: 'Only me', description: "Just for you — nobody else will ever see it, unlocked or not." },
};

export const INTEREST_META: Record<InterestType, { label: string; activeLabel: string }> = {
  save_to_unlock: { label: 'Save to Unlock', activeLabel: 'Saved to unlock' },
  interested: { label: "I'm Interested", activeLabel: 'Interested' },
  cant_wait: { label: "Can't Wait", activeLabel: "Can't wait" },
  good_vibes: { label: 'Good Vibes', activeLabel: 'Sent good vibes' },
};

export const MEMORY_TYPE_LABELS: Record<MemoryType, string> = {
  photo: 'Photo memory',
  video: 'Video memory',
  audio: 'Voice memory',
  text: 'Written memory',
};

// Rotated as the composer's caption placeholder, per the brand voice —
// "capture now, unlock later" rather than "what's on your mind?"
export const CAPTURE_PROMPTS = [
  'What moment do you want to save?',
  'Capture this moment for later…',
  'Write something your future self will unlock…',
];
