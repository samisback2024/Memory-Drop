import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { uploadFile, deleteFile, generateStoragePath, extractStoragePath } from '../utils/storage';
import { compressImageFile } from '../lib/image';
import { track } from '../lib/analytics';
import { logger } from '../lib/logger';
import { withAbortTimeout } from '../lib/timeout';
import type { AuthResult } from '../types/auth';
import type { Mood } from '../types/feed';
import type {
  Capsule, CapsuleReflection, CapsuleArchiveFilters,
  CapsuleMediaItem, CapsuleMemoryType, CapsuleVisibility,
} from '../types/capsule';

interface PendingCapsuleMedia {
  type: CapsuleMemoryType;
  file: File;
}

interface CreateCapsuleParams {
  title: string;
  memoryText: string;
  memoryTypes: CapsuleMemoryType[];
  media: PendingCapsuleMedia[];
  mood: Mood | null;
  visibility: CapsuleVisibility;
  unlockDate: string;
}

interface CreateCapsuleResult extends AuthResult {
  capsule: Capsule | null;
}

// Reads all go through SECURITY DEFINER RPCs, same reason as useDrops/
// useMoments — profiles RLS only lets a user read their own row, so
// joining in author info for someone else's capsule needs a function
// allowed to bypass that. Those RPCs also null a capsule's content while
// still locked, server-side (see phase6_capsules.sql) — and unlike
// Drops, capsules' own table RLS refuses the row outright to non-owners
// until unlock_date passes, not just a nulled column. Writes are direct
// table calls; RLS and the counter triggers are the real enforcement.
export const useCapsules = () => {
  const { user, profile } = useAuth();

  const getCapsule = useCallback(async (capsuleId: string): Promise<Capsule | null> => {
    const { data, error } = await supabase.rpc('get_capsule', { p_capsule_id: capsuleId });
    if (error || !data || data.length === 0) return null;
    return data[0] as Capsule;
  }, []);

  // My Capsules / In Orbit / Public — same three-way discovery split
  // Drops already has via getDropsFeed, backed by its own RPC rather
  // than getUserCapsules (which only ever shows *your own* view of a
  // single user's capsules and, for anyone else, hides locked ones
  // entirely — get_capsules_feed shows a locked capsule's sealed card
  // to everyone who can see it, same as a locked Drop).
  const getCapsulesFeed = useCallback(async (
    tab: 'my_capsules' | 'in_orbit' | 'public',
    limit = 20,
    offset = 0,
  ): Promise<Capsule[]> => {
    const { data, error } = await supabase.rpc('get_capsules_feed', { p_tab: tab, p_limit: limit, p_offset: offset });
    if (error || !data) {
      if (error) logger.warn('getCapsulesFeed failed', { tab, message: error.message });
      return [];
    }
    return data as Capsule[];
  }, []);

  const getUserCapsules = useCallback(async (
    userId: string,
    filters: Partial<CapsuleArchiveFilters> = {},
    limit = 20,
    offset = 0,
  ): Promise<Capsule[]> => {
    const { signal, clear } = withAbortTimeout();
    const { data, error } = await supabase.rpc('get_user_capsules', {
      p_user_id: userId,
      p_search: filters.search || null,
      p_lock_status: filters.lockStatus ?? null,
      p_year: filters.year ?? null,
      p_mood: filters.mood ?? null,
      p_media_type: filters.mediaType ?? null,
      p_visibility: filters.visibility ?? null,
      p_limit: limit,
      p_offset: offset,
    }).abortSignal(signal);
    clear();
    if (error || !data) {
      if (error) logger.warn('getUserCapsules failed', { userId, message: error.message });
      return [];
    }
    return data as Capsule[];
  }, []);

  // Idempotent — safe to call every time a locked-but-past-due capsule is
  // opened, including on a revisit. The client should re-fetch via
  // getCapsule right after to pick up the now-unlocked content.
  const unlockCapsule = useCallback(async (capsuleId: string): Promise<AuthResult> => {
    const { error } = await supabase.rpc('unlock_capsule', { p_capsule_id: capsuleId });
    if (!error) void track('capsule_unlocked', {});
    return { error: error?.message ?? null };
  }, []);

  const createCapsule = useCallback(async ({
    title, memoryText, memoryTypes, media, mood, visibility, unlockDate,
  }: CreateCapsuleParams): Promise<CreateCapsuleResult> => {
    if (!user) return { error: 'Not authenticated', capsule: null };

    const { data: capsuleRow, error: insertError } = await supabase
      .from('capsules')
      .insert({
        user_id: user.id,
        title: title.trim() || null,
        memory_text: memoryText.trim() || null,
        memory_types: memoryTypes,
        mood,
        visibility,
        unlock_date: unlockDate,
      })
      .select()
      .single();
    if (insertError || !capsuleRow) return { error: insertError?.message ?? 'Could not create your capsule.', capsule: null };

    const capsuleId = capsuleRow.id as string;
    const uploadedPaths: string[] = [];
    const mediaItems: CapsuleMediaItem[] = [];

    try {
      for (let i = 0; i < media.length; i++) {
        const item = media[i];
        const toUpload = item.type === 'photo' ? await compressImageFile(item.file) : item.file;
        const path = generateStoragePath(user.id, toUpload.name);
        const url = await uploadFile('capsules', path, toUpload);
        if (!url) throw new Error('Media upload failed. Try again.');
        uploadedPaths.push(path);
        mediaItems.push({ url, type: item.type, position: i });
      }

      if (mediaItems.length > 0) {
        const { error: mediaError } = await supabase
          .from('capsule_media')
          .insert(mediaItems.map(m => ({ capsule_id: capsuleId, media_url: m.url, media_type: m.type, position: m.position })));
        if (mediaError) throw new Error(mediaError.message);
      }
    } catch (err) {
      await supabase.from('capsules').delete().eq('id', capsuleId);
      await Promise.all(uploadedPaths.map(p => deleteFile('capsules', p)));
      return { error: err instanceof Error ? err.message : 'Could not finish creating your capsule.', capsule: null };
    }

    const isUnlocked = new Date(unlockDate).getTime() <= Date.now();
    const capsule: Capsule = {
      id: capsuleId,
      user_id: user.id,
      username: profile?.username ?? '',
      display_name: profile?.display_name ?? null,
      profile_photo_url: profile?.profile_photo_url ?? null,
      is_private: profile?.is_private ?? false,
      title: isUnlocked ? (title.trim() || null) : null,
      memory_text: isUnlocked ? (memoryText.trim() || null) : null,
      memory_types: memoryTypes,
      media: isUnlocked ? mediaItems : [],
      mood,
      visibility,
      unlock_date: unlockDate,
      is_unlocked: isUnlocked,
      has_opened: false,
      is_owner: true,
      like_count: 0,
      is_liked: false,
      comment_count: 0,
      save_count: 0,
      is_saved: false,
      share_count: 0,
      created_at: capsuleRow.created_at as string,
    };
    void track('capsule_created', { memory_types: memoryTypes, visibility });
    return { error: null, capsule };
  }, [user, profile]);

  const deleteCapsule = useCallback(async (capsule: Capsule): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase.from('capsules').delete().eq('id', capsule.id);
    if (error) return { error: error.message };
    const paths = capsule.media.map(m => extractStoragePath(m.url, 'capsules')).filter((p): p is string => Boolean(p));
    await Promise.all(paths.map(p => deleteFile('capsules', p)));
    return { error: null };
  }, [user]);

  const likeCapsule = useCallback(async (capsuleId: string): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase.from('capsule_likes').insert({ capsule_id: capsuleId, user_id: user.id });
    if (error && !/unique/i.test(error.message)) return { error: error.message };
    return { error: null };
  }, [user]);

  const unlikeCapsule = useCallback(async (capsuleId: string): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase.from('capsule_likes').delete().eq('capsule_id', capsuleId).eq('user_id', user.id);
    return { error: error?.message ?? null };
  }, [user]);

  const saveCapsule = useCallback(async (capsuleId: string): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase.from('capsule_saves').insert({ capsule_id: capsuleId, user_id: user.id });
    if (error && !/unique/i.test(error.message)) return { error: error.message };
    return { error: null };
  }, [user]);

  const unsaveCapsule = useCallback(async (capsuleId: string): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase.from('capsule_saves').delete().eq('capsule_id', capsuleId).eq('user_id', user.id);
    return { error: error?.message ?? null };
  }, [user]);

  const getCapsuleReflections = useCallback(async (capsuleId: string): Promise<CapsuleReflection[]> => {
    const { data, error } = await supabase.rpc('get_capsule_reflections', { p_capsule_id: capsuleId });
    if (error || !data) return [];
    return data as CapsuleReflection[];
  }, []);

  const addReflection = useCallback(async (capsuleId: string, content: string): Promise<{ error: string | null; reflection: CapsuleReflection | null }> => {
    if (!user) return { error: 'Not authenticated', reflection: null };
    const trimmed = content.trim();
    if (!trimmed) return { error: 'Write something first.', reflection: null };
    const { data, error } = await supabase
      .from('capsule_reflections')
      .insert({ capsule_id: capsuleId, user_id: user.id, content: trimmed })
      .select()
      .single();
    if (error || !data) return { error: error?.message ?? 'Could not save reflection.', reflection: null };
    return { error: null, reflection: { id: data.id, content: trimmed, created_at: data.created_at } };
  }, [user]);

  const incrementShareCount = useCallback(async (capsuleId: string): Promise<void> => {
    await supabase.rpc('increment_capsule_share_count', { p_capsule_id: capsuleId });
  }, []);

  return {
    getCapsule,
    getUserCapsules,
    getCapsulesFeed,
    unlockCapsule,
    createCapsule,
    deleteCapsule,
    likeCapsule,
    unlikeCapsule,
    saveCapsule,
    unsaveCapsule,
    getCapsuleReflections,
    addReflection,
    incrementShareCount,
  };
};
