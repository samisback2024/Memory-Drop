import type { Profile } from '../types';

type CompletionProfile = Pick<Profile, 'username' | 'display_name' | 'bio' | 'profile_photo_url'>;

// Mirrors compute_profile_completed() in supabase/phase2_profiles.sql —
// same four fields, same "non-empty" definition — so the client-side
// percentage never disagrees with the server-derived `profile_completed`
// boolean.
const COMPLETION_FIELDS: Array<{ key: keyof CompletionProfile; label: string }> = [
  { key: 'username', label: 'Username' },
  { key: 'display_name', label: 'Display name' },
  { key: 'bio', label: 'Bio' },
  { key: 'profile_photo_url', label: 'Profile photo' },
];

const isFilled = (value: string | null | undefined): boolean => Boolean(value && value.trim().length > 0);

export interface ProfileCompletion {
  percentage: number;
  missing: string[];
}

export const getProfileCompletion = (profile: CompletionProfile): ProfileCompletion => {
  const missing = COMPLETION_FIELDS.filter(f => !isFilled(profile[f.key])).map(f => f.label);
  const filledCount = COMPLETION_FIELDS.length - missing.length;
  return {
    percentage: Math.round((filledCount / COMPLETION_FIELDS.length) * 100),
    missing,
  };
};
