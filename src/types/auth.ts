// Phase 1 — mirrors the real `profiles` table schema exactly
// (see supabase/phase1_auth.sql). Kept separate from the richer `Profile`
// view-model in `types/index.ts`, which Phase 2 pages/components consume.
export interface ProfileRow {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  date_of_birth: string | null;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

export interface RegisterFormValues {
  email: string;
  password: string;
  username: string;
  displayName: string;
  dateOfBirth: string;
  acceptedTerms: boolean;
}

export type AuthResult = { error: string | null };
