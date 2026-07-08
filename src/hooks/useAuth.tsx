import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Profile } from '../types';
import type { RegisterFormValues, AuthResult } from '../types/auth';
import {
  normalizeUsername,
  normalizeWebsite,
  validateImageFile,
  getUsernameCooldownDaysRemaining,
  MAX_AVATAR_BYTES,
  MAX_COVER_BYTES,
} from '../lib/validators';
import { uploadFile, deleteFile, generateStoragePath, extractStoragePath } from '../utils/storage';

interface SignUpResult extends AuthResult {
  needsEmailVerification: boolean;
}

export interface ProfileUpdate {
  username?: string;
  displayName?: string;
  bio?: string;
  location?: string;
  website?: string;
  pronouns?: string;
  dateOfBirth?: string;
  isPrivate?: boolean;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  emailVerified: boolean;
  needsProfileCompletion: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (values: RegisterFormValues) => Promise<SignUpResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
  updateProfile: (updates: ProfileUpdate) => Promise<AuthResult>;
  uploadAvatar: (file: File) => Promise<AuthResult>;
  uploadCoverPhoto: (file: File) => Promise<AuthResult>;
  removeCoverPhoto: () => Promise<AuthResult>;
  completeProfile: (values: { username: string; displayName: string; dateOfBirth: string }) => Promise<AuthResult>;
  checkUsernameAvailable: (username: string) => Promise<boolean>;
  sendPasswordReset: (email: string) => Promise<AuthResult>;
  updatePassword: (newPassword: string) => Promise<AuthResult>;
  resendVerificationEmail: (email?: string) => Promise<AuthResult>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (!error && data) setProfile(data as Profile);
  }, []);

  useEffect(() => {
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
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signIn = async (email: string, password: string): Promise<AuthResult> => {
    if (!isSupabaseConfigured()) return { error: 'Supabase is not configured.' };
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
      return { error: 'Supabase is not configured.', needsEmailVerification: false };
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
        emailRedirectTo: `${window.location.origin}/dashboard`,
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
    if (data) setProfile(data as Profile);
    return { error: null };
  };

  const signInWithGoogle = async (): Promise<AuthResult> => {
    if (!isSupabaseConfigured()) return { error: 'Supabase is not configured.' };
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const updateProfile = async (updates: ProfileUpdate): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const rowUpdates: Record<string, unknown> = {};

    if (updates.displayName !== undefined) rowUpdates.display_name = updates.displayName.trim();
    if (updates.bio !== undefined) rowUpdates.bio = updates.bio.trim() || null;
    if (updates.location !== undefined) rowUpdates.location = updates.location.trim() || null;
    if (updates.pronouns !== undefined) rowUpdates.pronouns = updates.pronouns.trim() || null;
    if (updates.website !== undefined) rowUpdates.website = normalizeWebsite(updates.website);
    if (updates.dateOfBirth !== undefined) rowUpdates.date_of_birth = updates.dateOfBirth;
    if (updates.isPrivate !== undefined) rowUpdates.is_private = updates.isPrivate;

    if (updates.username !== undefined) {
      const username = normalizeUsername(updates.username);
      if (username !== profile?.username) {
        const cooldownDays = getUsernameCooldownDaysRemaining(profile?.username_changed_at ?? null);
        if (cooldownDays > 0) {
          return { error: `You can change your username again in ${cooldownDays} day${cooldownDays === 1 ? '' : 's'}.` };
        }
        const available = await checkUsernameAvailable(username);
        if (!available) return { error: 'That username is already taken.' };
      }
      rowUpdates.username = username;
    }
    if (Object.keys(rowUpdates).length === 0) return { error: null };

    const { data, error } = await supabase
      .from('profiles')
      .update(rowUpdates)
      .eq('id', user.id)
      .select()
      .single();

    // The 30-day cooldown is also enforced by a DB trigger (defense in
    // depth against clients that skip the client-side check above) — this
    // surfaces that failure with the same message rather than a raw
    // Postgres exception.
    if (error) {
      if (/once every 30 days/i.test(error.message)) {
        return { error: 'You can only change your username once every 30 days.' };
      }
      return { error: error.message };
    }
    if (data) setProfile(data as Profile);
    return { error: null };
  };

  const uploadAvatar = async (file: File): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const fileError = validateImageFile(file, MAX_AVATAR_BYTES);
    if (fileError) return { error: fileError };

    const previousUrl = profile?.profile_photo_url ?? null;
    const path = generateStoragePath(user.id, file.name);
    const url = await uploadFile('avatars', path, file);
    if (!url) return { error: 'Upload failed. Try again.' };

    const { data, error } = await supabase
      .from('profiles')
      .update({ profile_photo_url: url })
      .eq('id', user.id)
      .select()
      .single();

    if (error) return { error: error.message };
    if (data) setProfile(data as Profile);

    if (previousUrl) {
      const previousPath = extractStoragePath(previousUrl, 'avatars');
      if (previousPath) await deleteFile('avatars', previousPath);
    }
    return { error: null };
  };

  const uploadCoverPhoto = async (file: File): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const fileError = validateImageFile(file, MAX_COVER_BYTES);
    if (fileError) return { error: fileError };

    const previousUrl = profile?.cover_photo_url ?? null;
    const path = generateStoragePath(user.id, file.name);
    const url = await uploadFile('covers', path, file);
    if (!url) return { error: 'Upload failed. Try again.' };

    const { data, error } = await supabase
      .from('profiles')
      .update({ cover_photo_url: url })
      .eq('id', user.id)
      .select()
      .single();

    if (error) return { error: error.message };
    if (data) setProfile(data as Profile);

    if (previousUrl) {
      const previousPath = extractStoragePath(previousUrl, 'covers');
      if (previousPath) await deleteFile('covers', previousPath);
    }
    return { error: null };
  };

  const removeCoverPhoto = async (): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const previousUrl = profile?.cover_photo_url ?? null;

    const { data, error } = await supabase
      .from('profiles')
      .update({ cover_photo_url: null })
      .eq('id', user.id)
      .select()
      .single();

    if (error) return { error: error.message };
    if (data) setProfile(data as Profile);

    if (previousUrl) {
      const previousPath = extractStoragePath(previousUrl, 'covers');
      if (previousPath) await deleteFile('covers', previousPath);
    }
    return { error: null };
  };

  const sendPasswordReset = async (email: string): Promise<AuthResult> => {
    if (!isSupabaseConfigured()) return { error: 'Supabase is not configured.' };
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error?.message ?? null };
  };

  const updatePassword = async (newPassword: string): Promise<AuthResult> => {
    if (!isSupabaseConfigured()) return { error: 'Supabase is not configured.' };
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error?.message ?? null };
  };

  // Takes an explicit email rather than only reading `user.email`: right
  // after registration (email confirmation required), signUp() returns no
  // session, so `user` is still null here — the email has to come from
  // wherever the caller got it (e.g. the register form).
  const resendVerificationEmail = async (email?: string): Promise<AuthResult> => {
    if (!isSupabaseConfigured()) return { error: 'Supabase is not configured.' };
    const target = email ?? user?.email;
    if (!target) return { error: 'No email on file for this account.' };
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: target,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    return { error: error?.message ?? null };
  };

  const refreshUser = async () => {
    if (!isSupabaseConfigured()) return;
    const { data } = await supabase.auth.getUser();
    setUser(data.user ?? null);
    if (data.user) await fetchProfile(data.user.id);
  };

  const emailVerified = Boolean(user?.email_confirmed_at);
  const needsProfileCompletion = Boolean(user) && Boolean(profile) && !profile?.username;

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        emailVerified,
        needsProfileCompletion,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        updateProfile,
        uploadAvatar,
        uploadCoverPhoto,
        removeCoverPhoto,
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
