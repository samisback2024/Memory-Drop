// Mirrors the real `profiles` table exactly (see supabase/phase2_profiles.sql
// and supabase/phase2b_profile_polish.sql). This is the single source of
// truth for a user's profile shape — Phase 3+ features (followers, capsules,
// stories, badges) get their own tables and their own types when those
// phases are built; until then the counts shown on the profile UI are
// static placeholders, not real columns.
export interface Profile {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  profile_photo_url: string | null;
  cover_photo_url: string | null;
  website: string | null;
  location: string | null;
  pronouns: string | null;
  date_of_birth: string | null;
  is_private: boolean;
  profile_completed: boolean;
  username_changed_at: string | null;
  created_at: string;
  updated_at: string;
}
