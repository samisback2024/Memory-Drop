import type { Mood } from './feed';

export type CapsuleMemoryType = 'text' | 'photo' | 'video' | 'audio' | 'voice';
export type CapsuleVisibility = 'only_me' | 'followers' | 'public';
export type CapsuleLockStatus = 'locked' | 'unlocked';

export interface CapsuleMediaItem {
  url: string;
  type: CapsuleMemoryType;
  position: number;
}

// Mirrors the row shape returned by get_capsule / get_user_capsules.
// title/memory_text/media are all null/empty while unlock_date is still
// in the future — enforced server-side (posts' RLS *and* the RPCs, see
// phase6_capsules.sql), not just hidden in the UI, for every viewer
// including the capsule's own owner.
export interface Capsule {
  id: string;
  user_id: string;
  username: string;
  display_name: string | null;
  profile_photo_url: string | null;
  is_private: boolean;
  title: string | null;
  memory_text: string | null;
  memory_types: CapsuleMemoryType[];
  media: CapsuleMediaItem[];
  mood: Mood | null;
  visibility: CapsuleVisibility;
  unlock_date: string;
  is_unlocked: boolean;
  has_opened: boolean;
  is_owner: boolean;
  like_count: number;
  is_liked: boolean;
  comment_count: number;
  save_count: number;
  is_saved: boolean;
  share_count: number;
  created_at: string;
}

// Regular comments now live in types/comment.ts (Comment) — shared with
// Drops since Phase 10d unified both comment UIs into one component.

export interface CapsuleReflection {
  id: string;
  content: string;
  created_at: string;
}

export interface CapsuleArchiveFilters {
  search: string;
  lockStatus: CapsuleLockStatus | null;
  year: number | null;
  mood: Mood | null;
  mediaType: CapsuleMemoryType | null;
  visibility: CapsuleVisibility | null;
}

export const EMPTY_CAPSULE_FILTERS: CapsuleArchiveFilters = {
  search: '', lockStatus: null, year: null, mood: null, mediaType: null, visibility: null,
};

export const MEMORY_TYPE_OPTIONS: { type: CapsuleMemoryType; label: string }[] = [
  { type: 'text', label: 'Text' },
  { type: 'photo', label: 'Photo' },
  { type: 'video', label: 'Video' },
  { type: 'audio', label: 'Audio' },
  { type: 'voice', label: 'Voice recording' },
];

export const CAPSULE_VISIBILITY_META: Record<CapsuleVisibility, { label: string; description: string }> = {
  only_me: { label: 'Only Me', description: 'A private vault — nobody else will ever open this one.' },
  followers: { label: 'Followers', description: 'Your followers can open this once it unlocks.' },
  public: { label: 'Public', description: 'Anyone who can see your posts can open this once it unlocks.' },
};

export type UnlockPresetId = 'tomorrow' | 'next_week' | 'next_month' | 'one_year' | 'custom_date' | 'custom_datetime';

export const UNLOCK_PRESETS: { id: UnlockPresetId; label: string }[] = [
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'next_week', label: 'Next Week' },
  { id: 'next_month', label: 'Next Month' },
  { id: 'one_year', label: '1 Year' },
  { id: 'custom_date', label: 'Custom Date' },
  { id: 'custom_datetime', label: 'Custom Date & Time' },
];

export const computePresetDate = (preset: UnlockPresetId): Date => {
  const d = new Date();
  switch (preset) {
    case 'tomorrow': d.setDate(d.getDate() + 1); return d;
    case 'next_week': d.setDate(d.getDate() + 7); return d;
    case 'next_month': d.setMonth(d.getMonth() + 1); return d;
    case 'one_year': d.setFullYear(d.getFullYear() + 1); return d;
    default: return d;
  }
};

export const CAPSULE_TITLE_MAX = 100;
export const CAPSULE_MEMORY_TEXT_MAX = 3000;
export const CAPSULE_MAX_PHOTOS = 10;
export const CAPSULE_MAX_VIDEOS = 3;
export const CAPSULE_MAX_AUDIO = 3;
export const CAPSULE_MAX_VOICE = 3;
