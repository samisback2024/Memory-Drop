import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { useDrops } from './useDrops';
import { useMoments } from './useMoments';
import { useCapsules } from './useCapsules';
import type { AuthResult } from '../types/auth';
import type { UserSettings, NotificationPreferences, UserSession, ManagedUser, FeedbackType } from '../types/settings';

const STORAGE_BUCKETS = ['avatars', 'covers', 'post-media', 'moments', 'capsules'] as const;

export interface StorageUsage {
  photos: number;
  videos: number;
  audio: number;
  other: number;
  total: number;
}

const bytesForExt = (name: string): 'photos' | 'videos' | 'audio' | 'other' => {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return 'photos';
  if (['mp4', 'webm', 'mov', 'quicktime'].includes(ext)) return 'videos';
  if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return 'audio';
  return 'other';
};

// Settings/notification-preference reads and writes are plain owner-only
// table access (same posture as favorites/collections in Phase 7) — no
// RPC layer needed since there's no cross-user visibility question here.
// The four "manage my relationships" lists and account deletion do need
// SECURITY DEFINER RPCs (joining profiles, or touching auth.users) — see
// phase8_settings.sql.
export const useSettings = () => {
  const { user, signOut, updatePassword } = useAuth();
  const { getDropsFeed, deleteDrop } = useDrops();
  const { getUserCapsules, deleteCapsule } = useCapsules();
  const { getUserMoments, deleteMoment } = useMoments();

  const getSettings = useCallback(async (): Promise<UserSettings | null> => {
    if (!user) return null;
    const { data, error } = await supabase.from('user_settings').select('*').eq('user_id', user.id).single();
    if (error || !data) return null;
    return data as UserSettings;
  }, [user]);

  const updateSettings = useCallback(async (patch: Partial<UserSettings>): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase.from('user_settings').update(patch).eq('user_id', user.id);
    return { error: error?.message ?? null };
  }, [user]);

  const getNotificationPreferences = useCallback(async (): Promise<NotificationPreferences | null> => {
    if (!user) return null;
    const { data, error } = await supabase.from('notification_preferences').select('*').eq('user_id', user.id).single();
    if (error || !data) return null;
    return data as NotificationPreferences;
  }, [user]);

  const updateNotificationPreferences = useCallback(async (patch: Partial<NotificationPreferences>): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase.from('notification_preferences').update(patch).eq('user_id', user.id);
    return { error: error?.message ?? null };
  }, [user]);

  const getBlockedUsers = useCallback(async (): Promise<ManagedUser[]> => {
    const { data, error } = await supabase.rpc('get_blocked_users');
    if (error || !data) return [];
    return data as ManagedUser[];
  }, []);

  const getMutedUsers = useCallback(async (): Promise<ManagedUser[]> => {
    const { data, error } = await supabase.rpc('get_muted_users');
    if (error || !data) return [];
    return data as ManagedUser[];
  }, []);

  const getRestrictedUsers = useCallback(async (): Promise<ManagedUser[]> => {
    const { data, error } = await supabase.rpc('get_restricted_users');
    if (error || !data) return [];
    return data as ManagedUser[];
  }, []);

  const getSessions = useCallback(async (): Promise<UserSession[]> => {
    if (!user) return [];
    const { data, error } = await supabase.from('user_sessions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20);
    if (error || !data) return [];
    return data as UserSession[];
  }, [user]);

  // Best-effort, fire-and-forget — a failed insert here shouldn't block
  // sign-in itself. Device label is a coarse guess from the user agent,
  // not a precise device fingerprint.
  const recordSession = useCallback(async (): Promise<void> => {
    if (!user) return;
    const ua = navigator.userAgent;
    const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
    const os = /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : '';
    const deviceLabel = os ? `${browser} on ${os}` : browser;
    await supabase.from('user_sessions').insert({ user_id: user.id, device_label: deviceLabel });
  }, [user]);

  const clearSessionHistory = useCallback(async (): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase.from('user_sessions').delete().eq('user_id', user.id);
    return { error: error?.message ?? null };
  }, [user]);

  const signOutAllDevices = useCallback(async (): Promise<AuthResult> => {
    const { error } = await supabase.auth.signOut({ scope: 'global' });
    return { error: error?.message ?? null };
  }, []);

  const changeEmail = useCallback(async (newEmail: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    return { error: error?.message ?? null };
  }, []);

  // Re-authenticates with the current password before allowing the
  // change, rather than trusting the session alone — a lightweight
  // defense-in-depth step Supabase's updateUser() doesn't require on
  // its own.
  const changePassword = useCallback(async (currentPassword: string, newPassword: string): Promise<AuthResult> => {
    if (!user?.email) return { error: 'Not authenticated' };
    const { error: reauthError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
    if (reauthError) return { error: 'Current password is incorrect.' };
    const { error } = await updatePassword(newPassword);
    if (error) return { error };
    await supabase.from('user_settings').update({ password_changed_at: new Date().toISOString() }).eq('user_id', user.id);
    await supabase.rpc('notify_password_changed');
    return { error: null };
  }, [user, updatePassword]);

  const deleteAccount = useCallback(async (): Promise<AuthResult> => {
    const { error } = await supabase.rpc('delete_my_account');
    if (error) return { error: error.message };
    await signOut();
    return { error: null };
  }, [signOut]);

  // Deletes every Drop/Moment/Capsule the user owns, one at a time
  // through the same delete functions those phases already built (so
  // storage cleanup happens identically to a normal single-item delete)
  // — deliberately not a blunt SQL statement, to avoid duplicating that
  // cleanup logic in two places. The account itself is untouched.
  const deleteAllContent = useCallback(async (): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const PAGE = 100;
    const failures: string[] = [];
    try {
      // Paginated rather than a single capped fetch — a single 500-item
      // page silently left anything past it undeleted for any account
      // with more content than that. Always re-fetched at offset 0, not
      // incremented — items are being deleted between fetches, so an
      // incrementing offset would skip whatever just shifted into the
      // range already passed. Each delete's own {error} is checked too
      // — these delete* functions return a result object rather than
      // throwing on failure (same as every other delete button in the
      // app), so a plain `await deleteDrop(drop)` with the result
      // discarded reported "all deleted" even when every single delete
      // had actually failed. That combination — ignored per-item errors
      // plus a page cap — is what made this look like it succeeded
      // while doing nothing, or only partially working.
      while (true) {
        const drops = await getDropsFeed('my_drops', PAGE, 0);
        if (drops.length === 0) break;
        let anySucceeded = false;
        for (const drop of drops) {
          const { error } = await deleteDrop(drop);
          if (error) failures.push(error); else anySucceeded = true;
        }
        // A failed delete leaves its item in place, so a stalled page
        // would otherwise refetch the exact same items forever — bail
        // once a full pass makes no progress at all.
        if (!anySucceeded || drops.length < PAGE) break;
      }

      while (true) {
        const capsules = await getUserCapsules(user.id, {}, PAGE, 0);
        if (capsules.length === 0) break;
        let anySucceeded = false;
        for (const capsule of capsules) {
          const { error } = await deleteCapsule(capsule);
          if (error) failures.push(error); else anySucceeded = true;
        }
        if (!anySucceeded || capsules.length < PAGE) break;
      }

      const moments = await getUserMoments(user.id, true);
      for (const moment of moments) {
        const { error } = await deleteMoment(moment);
        if (error) failures.push(error);
      }

      if (failures.length > 0) {
        return { error: `${failures.length} item${failures.length === 1 ? '' : 's'} couldn't be deleted: ${failures[0]}` };
      }
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Could not delete all your data.' };
    }
  }, [user, getDropsFeed, deleteDrop, getUserCapsules, deleteCapsule, getUserMoments, deleteMoment]);

  const submitFeedback = useCallback(async (type: FeedbackType, subject: string, message: string): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const trimmed = message.trim();
    if (!trimmed) return { error: 'Write a message first.' };
    const { error } = await supabase.from('feedback_reports').insert({ user_id: user.id, type, subject: subject.trim() || null, message: trimmed });
    return { error: error?.message ?? null };
  }, [user]);

  const getStorageUsage = useCallback(async (): Promise<StorageUsage> => {
    if (!user) return { photos: 0, videos: 0, audio: 0, other: 0, total: 0 };
    const usage: StorageUsage = { photos: 0, videos: 0, audio: 0, other: 0, total: 0 };
    await Promise.all(STORAGE_BUCKETS.map(async bucket => {
      const { data } = await supabase.storage.from(bucket).list(user.id, { limit: 1000 });
      for (const file of data ?? []) {
        const size = (file.metadata as { size?: number } | null)?.size ?? 0;
        usage[bytesForExt(file.name)] += size;
        usage.total += size;
      }
    }));
    return usage;
  }, [user]);

  const clearLocalDrafts = useCallback((): number => {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('memorydrop_'));
    keys.forEach(k => localStorage.removeItem(k));
    return keys.length;
  }, []);

  return {
    getSettings,
    updateSettings,
    getNotificationPreferences,
    updateNotificationPreferences,
    getBlockedUsers,
    getMutedUsers,
    getRestrictedUsers,
    getSessions,
    recordSession,
    clearSessionHistory,
    signOutAllDevices,
    changeEmail,
    changePassword,
    deleteAccount,
    deleteAllContent,
    submitFeedback,
    getStorageUsage,
    clearLocalDrafts,
  };
};
