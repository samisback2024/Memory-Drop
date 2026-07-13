import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { uploadFile, deleteFile, generateStoragePath, extractStoragePath } from '../utils/storage';
import { compressImageFile } from '../lib/image';
import { track } from '../lib/analytics';
import { logger } from '../lib/logger';
import { withAbortTimeout } from '../lib/timeout';
import type { AuthResult } from '../types/auth';
import type { Drop, DropTab, InterestType, MemoryType, Mood, ReportReason, Visibility } from '../types/feed';

interface CreateDropParams {
  caption: string;
  memoryType: MemoryType;
  images: File[];
  video: File | null;
  unlockDate: string;
  visibility: Visibility;
  mood: Mood | null;
}

interface CreateDropResult extends AuthResult {
  drop: Drop | null;
}

// Reads (get_drops_feed, get_saved_drops, get_drop, get_drop_comments) go
// through SECURITY DEFINER RPCs for the same reason as every cross-user
// read since Phase 2: profiles RLS only lets a user read their own row, so
// anything joining in author info for someone else's content needs a
// function allowed to bypass that. Those same RPCs also null out a drop's
// content while it's still locked, server-side — see
// supabase/phase4b_time_capsule_redesign.sql. Writes are direct table
// calls — RLS and the counter triggers on those tables are the real
// enforcement.
export const useDrops = () => {
  const { user, profile } = useAuth();

  const getDropsFeed = useCallback(async (tab: DropTab, limit = 10, offset = 0, mediaType: MemoryType | null = null): Promise<Drop[]> => {
    const { signal, clear } = withAbortTimeout();
    const { data, error } = await supabase.rpc('get_drops_feed', { p_tab: tab, p_limit: limit, p_offset: offset, p_post_type: mediaType }).abortSignal(signal);
    clear();
    if (error || !data) {
      if (error) logger.warn('getDropsFeed failed', { tab, message: error.message });
      return [];
    }
    return data as Drop[];
  }, []);

  const getSavedDrops = useCallback(async (limit = 10, offset = 0): Promise<Drop[]> => {
    const { data, error } = await supabase.rpc('get_saved_drops', { p_limit: limit, p_offset: offset });
    if (error || !data) return [];
    return data as Drop[];
  }, []);

  // Moves any of the caller's own "Saved to Unlock" reactions whose drop
  // has since unlocked into a real Saved Memories bookmark — see
  // supabase/phase14o_save_to_unlock_promotion.sql. Returns the drop ids
  // just promoted this call, so a caller watching one specific drop (its
  // live countdown just hit zero) can tell whether to show a toast for it.
  const promoteUnlockedSaves = useCallback(async (): Promise<string[]> => {
    const { data, error } = await supabase.rpc('promote_unlocked_saves');
    if (error || !data) return [];
    return (data as { drop_id: string }[]).map(row => row.drop_id);
  }, []);

  const getDrop = useCallback(async (dropId: string): Promise<Drop | null> => {
    const { data, error } = await supabase.rpc('get_drop', { p_post_id: dropId });
    if (error || !data || data.length === 0) return null;
    return data[0] as Drop;
  }, []);

  const createDrop = useCallback(async ({
    caption, memoryType, images, video, unlockDate, visibility, mood,
  }: CreateDropParams): Promise<CreateDropResult> => {
    if (!user) return { error: 'Not authenticated', drop: null };

    const { data: dropRow, error: insertError } = await supabase
      .from('posts')
      .insert({
        user_id: user.id,
        post_type: memoryType,
        caption: caption.trim() || null,
        unlock_date: unlockDate,
        visibility,
        mood,
      })
      .select()
      .single();
    if (insertError || !dropRow) return { error: insertError?.message ?? 'Could not create your drop.', drop: null };

    const dropId = dropRow.id as string;
    let videoUrl: string | null = null;
    const uploadedImages: { url: string; position: number }[] = [];

    try {
      if (memoryType === 'video' && video) {
        const path = generateStoragePath(user.id, video.name);
        const url = await uploadFile('post-media', path, video);
        if (!url) throw new Error('Video upload failed. Try again.');
        videoUrl = url;
        const { error: updateError } = await supabase.from('posts').update({ video_url: url }).eq('id', dropId);
        if (updateError) throw new Error(updateError.message);
      }

      if (memoryType === 'photo' && images.length > 0) {
        for (let i = 0; i < images.length; i++) {
          const compressed = await compressImageFile(images[i]);
          const path = generateStoragePath(user.id, compressed.name);
          const url = await uploadFile('post-media', path, compressed);
          if (!url) throw new Error('Image upload failed. Try again.');
          uploadedImages.push({ url, position: i });
        }
        const { error: imagesError } = await supabase
          .from('post_images')
          .insert(uploadedImages.map(img => ({ post_id: dropId, image_url: img.url, position: img.position })));
        if (imagesError) throw new Error(imagesError.message);
      }
    } catch (err) {
      // Best-effort: don't leave a broken, media-less drop behind.
      await supabase.from('posts').delete().eq('id', dropId);
      return { error: err instanceof Error ? err.message : 'Could not finish creating your drop.', drop: null };
    }

    const isUnlocked = new Date(unlockDate).getTime() <= Date.now();
    const drop: Drop = {
      id: dropId,
      user_id: user.id,
      username: profile?.username ?? '',
      display_name: profile?.display_name ?? null,
      profile_photo_url: profile?.profile_photo_url ?? null,
      is_private: profile?.is_private ?? false,
      caption: isUnlocked ? (caption.trim() || null) : null,
      post_type: memoryType,
      video_url: isUnlocked ? videoUrl : null,
      audio_url: null,
      images: isUnlocked ? uploadedImages.map(img => ({ url: img.url, position: img.position })) : [],
      mood,
      visibility,
      unlock_date: unlockDate,
      is_unlocked: isUnlocked,
      like_count: 0,
      is_liked: false,
      comment_count: 0,
      share_count: 0,
      save_count: 0,
      is_saved: false,
      interested_count: 0,
      cant_wait_count: 0,
      good_vibes_count: 0,
      save_to_unlock_count: 0,
      is_interested: false,
      is_cant_wait: false,
      is_good_vibes: false,
      is_saved_to_unlock: false,
      created_at: dropRow.created_at as string,
    };
    void track('drop_created', { memory_type: memoryType, visibility });
    return { error: null, drop };
  }, [user, profile]);

  const deleteDrop = useCallback(async (drop: Drop): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase.from('posts').delete().eq('id', drop.id);
    if (error) return { error: error.message };

    // Best-effort storage cleanup — the DB rows are already gone (cascade),
    // this just stops the files themselves from lingering in the bucket.
    const paths = [
      ...drop.images.map(img => extractStoragePath(img.url, 'post-media')),
      drop.video_url ? extractStoragePath(drop.video_url, 'post-media') : null,
      drop.audio_url ? extractStoragePath(drop.audio_url, 'post-media') : null,
    ].filter((p): p is string => Boolean(p));
    await Promise.all(paths.map(p => deleteFile('post-media', p)));

    return { error: null };
  }, [user]);

  const saveDrop = useCallback(async (dropId: string): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase.from('saved_posts').insert({ post_id: dropId, user_id: user.id });
    if (error && !/unique/i.test(error.message)) return { error: error.message };
    return { error: null };
  }, [user]);

  const unsaveDrop = useCallback(async (dropId: string): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase.from('saved_posts').delete().eq('post_id', dropId).eq('user_id', user.id);
    return { error: error?.message ?? null };
  }, [user]);

  // Post-unlock only — enforced by likes' own RLS (see
  // phase4d_engagement.sql), this just avoids a round trip for the
  // obviously-locked case.
  const likeDrop = useCallback(async (dropId: string): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase.from('likes').insert({ post_id: dropId, user_id: user.id });
    if (error && !/unique/i.test(error.message)) return { error: error.message };
    return { error: null };
  }, [user]);

  const unlikeDrop = useCallback(async (dropId: string): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase.from('likes').delete().eq('post_id', dropId).eq('user_id', user.id);
    return { error: error?.message ?? null };
  }, [user]);

  // Pre-unlock only — a positive reaction to a still-sealed drop. RLS
  // rejects this once the drop has actually unlocked.
  const addInterest = useCallback(async (dropId: string, interestType: InterestType): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase.from('drop_interests').insert({ drop_id: dropId, user_id: user.id, interest_type: interestType });
    if (error && !/unique/i.test(error.message)) return { error: error.message };
    return { error: null };
  }, [user]);

  const removeInterest = useCallback(async (dropId: string, interestType: InterestType): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase.from('drop_interests').delete().eq('drop_id', dropId).eq('user_id', user.id).eq('interest_type', interestType);
    return { error: error?.message ?? null };
  }, [user]);

  // Best-effort event log for a future "X unlocked your drop" notification
  // (Phase 9) — nothing reads this back yet, and a failure here (already
  // recorded, blocked, or it's your own drop) is silently fine to ignore.
  // Fires once per (drop, viewer) — DropCard calls this on every mount for
  // an unlocked, not-your-own drop, so revisiting the same drop later (a
  // reload, a re-opened tab) hit the unique (drop_id, user_id) constraint
  // and 409'd every single time. upsert + ignoreDuplicates turns a repeat
  // visit into a silent no-op instead of a failed insert.
  const recordUnlockView = useCallback(async (dropId: string): Promise<void> => {
    if (!user) return;
    await supabase.from('drop_unlock_views').upsert(
      { drop_id: dropId, user_id: user.id },
      { onConflict: 'drop_id,user_id', ignoreDuplicates: true }
    );
  }, [user]);

  const hideDrop = useCallback(async (dropId: string): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase.from('hidden_posts').insert({ post_id: dropId, user_id: user.id });
    if (error && !/unique/i.test(error.message)) return { error: error.message };
    return { error: null };
  }, [user]);

  const reportDrop = useCallback(async (dropId: string, reason: ReportReason, details?: string): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase
      .from('reports')
      .insert({ post_id: dropId, reporter_id: user.id, reason, details: details?.trim() || null });
    if (error) {
      if (/unique/i.test(error.message)) return { error: 'You already reported this drop.' };
      return { error: error.message };
    }
    return { error: null };
  }, [user]);

  const incrementShareCount = useCallback(async (dropId: string): Promise<void> => {
    await supabase.rpc('increment_share_count', { p_post_id: dropId });
  }, []);

  return {
    getDropsFeed,
    getSavedDrops,
    promoteUnlockedSaves,
    getDrop,
    createDrop,
    deleteDrop,
    saveDrop,
    unsaveDrop,
    likeDrop,
    unlikeDrop,
    addInterest,
    removeInterest,
    recordUnlockView,
    hideDrop,
    reportDrop,
    incrementShareCount,
  };
};
