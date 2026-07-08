import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { demoProfiles } from '../lib/demo-data';
import type { Profile } from '../types';
import type { ProfileRow, RegisterFormValues, AuthResult } from '../types/auth';
import { normalizeUsername } from '../lib/validators';

const DEMO_PROFILE_ROW: ProfileRow = {
  id: 'demo-user-001',
  username: demoProfiles[0].username,
  display_name: demoProfiles[0].full_name,
  avatar_url: demoProfiles[0].avatar_url,
  date_of_birth: null,
  is_demo: true,
  created_at: demoProfiles[0].created_at,
  updated_at: demoProfiles[0].created_at,
};

// Phase 2 pages/components (Navbar, ProfileHeader, useCapsules, useFriends, ...)
// read a richer `Profile` shape (full_name, bio, follower_count, ...) that no
// longer exists on the real `profiles` table. This adapter fills in sensible
// defaults for those not-yet-built fields so Phase 2 keeps compiling and
// rendering unchanged, while the real DB schema matches the Phase 1 spec.
const toViewProfile = (row: ProfileRow): Profile => ({
  id: row.id,
  username: row.username ?? '',
  full_name: row.display_name ?? '',
  avatar_url: row.avatar_url,
  bio: null,
  is_private: false,
  capsule_count: 0,
  follower_count: 0,
  following_count: 0,
  streak: 0,
  badges: [],
  created_at: row.created_at,
});

interface SignUpResult extends AuthResult {
  needsEmailVerification: boolean;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  profileRow: ProfileRow | null;
  isDemo: boolean;
  loading: boolean;
  emailVerified: boolean;
  needsProfileCompletion: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (values: RegisterFormValues) => Promise<SignUpResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
  enterDemoMode: () => void;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  completeProfile: (values: { username: string; displayName: string; dateOfBirth: string }) => Promise<AuthResult>;
  checkUsernameAvailable: (username: string) => Promise<boolean>;
  sendPasswordReset: (email: string) => Promise<AuthResult>;
  updatePassword: (newPassword: string) => Promise<AuthResult>;
  resendVerificationEmail: () => Promise<AuthResult>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileRow, setProfileRow] = useState<ProfileRow | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (!error && data) {
      const row = data as ProfileRow;
      setProfileRow(row);
      setProfile(toViewProfile(row));
    }
  }, []);

  useEffect(() => {
    const demoFlag = localStorage.getItem('md_demo');
    if (demoFlag === 'true') {
      setIsDemo(true);
      setProfile(demoProfiles[0]);
      setProfileRow(DEMO_PROFILE_ROW);
      setLoading(false);
      return;
    }

    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setProfileRow(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signIn = async (email: string, password: string): Promise<AuthResult> => {
    if (!isSupabaseConfigured()) return { error: 'Supabase is not configured. Use Demo Mode.' };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const checkUsernameAvailable = async (username: string): Promise<boolean> => {
    if (!isSupabaseConfigured()) return true;
    const { data, error } = await supabase.rpc('is_username_available', {
      check_username: normalizeUsername(username),
    });
    if (error) return false;
    return Boolean(data);
  };

  const signUp = async (values: RegisterFormValues): Promise<SignUpResult> => {
    if (!isSupabaseConfigured()) {
      return { error: 'Supabase is not configured. Use Demo Mode.', needsEmailVerification: false };
    }
    const username = normalizeUsername(values.username);

    const available = await checkUsernameAvailable(username);
    if (!available) {
      return { error: 'That username is already taken.', needsEmailVerification: false };
    }

    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: {
          username,
          display_name: values.displayName.trim(),
          date_of_birth: values.dateOfBirth,
        },
      },
    });

    if (error) {
      if (/duplicate|unique/i.test(error.message)) {
        return { error: 'That username is already taken.', needsEmailVerification: false };
      }
      return { error: error.message, needsEmailVerification: false };
    }

    // If email confirmation is required, Supabase returns a user but no session.
    const needsEmailVerification = Boolean(data.user) && !data.session;
    return { error: null, needsEmailVerification };
  };

  const completeProfile = async (values: {
    username: string;
    displayName: string;
    dateOfBirth: string;
  }): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const username = normalizeUsername(values.username);

    const available = await checkUsernameAvailable(username);
    if (!available) return { error: 'That username is already taken.' };

    const { data, error } = await supabase
      .from('profiles')
      .update({
        username,
        display_name: values.displayName.trim(),
        date_of_birth: values.dateOfBirth,
      })
      .eq('id', user.id)
      .select()
      .single();

    if (error) return { error: error.message };
    if (data) {
      const row = data as ProfileRow;
      setProfileRow(row);
      setProfile(toViewProfile(row));
    }
    return { error: null };
  };

  const signInWithGoogle = async (): Promise<AuthResult> => {
    if (!isSupabaseConfigured()) return { error: 'Supabase is not configured. Use Demo Mode.' };
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    if (isDemo) {
      localStorage.removeItem('md_demo');
      setIsDemo(false);
      setProfile(null);
      setProfileRow(null);
      return;
    }
    await supabase.auth.signOut();
  };

  const enterDemoMode = () => {
    localStorage.setItem('md_demo', 'true');
    setIsDemo(true);
    setProfile(demoProfiles[0]);
    setProfileRow(DEMO_PROFILE_ROW);
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (isDemo) {
      setProfile(prev => prev ? { ...prev, ...updates } : prev);
      return;
    }
    if (!user) return;
    // Only forward fields that exist on the real Phase 1 schema; Phase 2
    // view-model fields (bio, is_private, streak, ...) have no column to
    // write to yet and are silently dropped rather than erroring.
    const rowUpdates: Partial<ProfileRow> = {};
    if ('avatar_url' in updates) rowUpdates.avatar_url = updates.avatar_url ?? null;
    if ('full_name' in updates) rowUpdates.display_name = updates.full_name;
    if ('username' in updates) rowUpdates.username = updates.username ? normalizeUsername(updates.username) : null;
    if (Object.keys(rowUpdates).length === 0) return;

    const { data } = await supabase
      .from('profiles')
      .update(rowUpdates)
      .eq('id', user.id)
      .select()
      .single();
    if (data) {
      const row = data as ProfileRow;
      setProfileRow(row);
      setProfile(toViewProfile(row));
    }
  };

  const sendPasswordReset = async (email: string): Promise<AuthResult> => {
    if (!isSupabaseConfigured()) return { error: 'Supabase is not configured. Use Demo Mode.' };
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error?.message ?? null };
  };

  const updatePassword = async (newPassword: string): Promise<AuthResult> => {
    if (!isSupabaseConfigured()) return { error: 'Supabase is not configured. Use Demo Mode.' };
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error?.message ?? null };
  };

  const resendVerificationEmail = async (): Promise<AuthResult> => {
    if (!isSupabaseConfigured()) return { error: 'Supabase is not configured. Use Demo Mode.' };
    if (!user?.email) return { error: 'No email on file for this account.' };
    const { error } = await supabase.auth.resend({ type: 'signup', email: user.email });
    return { error: error?.message ?? null };
  };

  const refreshUser = async () => {
    if (!isSupabaseConfigured()) return;
    const { data } = await supabase.auth.getUser();
    setUser(data.user ?? null);
    if (data.user) await fetchProfile(data.user.id);
  };

  const emailVerified = isDemo || Boolean(user?.email_confirmed_at);
  const needsProfileCompletion = !isDemo && Boolean(user) && Boolean(profileRow) && !profileRow?.username;

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        profileRow,
        isDemo,
        loading,
        emailVerified,
        needsProfileCompletion,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        enterDemoMode,
        updateProfile,
        completeProfile,
        checkUsernameAvailable,
        sendPasswordReset,
        updatePassword,
        resendVerificationEmail,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
