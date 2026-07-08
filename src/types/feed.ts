export type MemoryType = 'photo' | 'video' | 'audio' | 'text';
export type DropTab = 'my_drops' | 'unlocking_soon' | 'today_unlocks' | 'public_drops';
export type Visibility = 'public' | 'followers' | 'private';
export type Mood = 'joyful' | 'grateful' | 'nostalgic' | 'hopeful' | 'reflective' | 'peaceful' | 'bittersweet' | 'excited';
export type ReportReason = 'spam' | 'harassment' | 'violence' | 'nudity' | 'fake_account' | 'other';

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
  comment_count: number;
  share_count: number;
  save_count: number;
  is_saved: boolean;
  created_at: string;
}

export interface DropComment {
  id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  profile_photo_url: string | null;
  content: string;
  created_at: string;
}

// A private note-to-self on a drop — never shown to anyone but the person
// who wrote it, and never counted as a comment.
export interface Reflection {
  id: string;
  content: string;
  created_at: string;
}

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
