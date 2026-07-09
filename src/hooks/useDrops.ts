import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { uploadFile, deleteFile, generateStoragePath, extractStoragePath } from '../utils/storage';
import { compressImageFile } from '../lib/image';
import type { AuthResult } from '../types/auth';
import type { Drop, DropTab, InterestType, MemoryType, Mood, Reflection, ReportReason, Visibility } from '../types/feed';

interface CreateDropParams {
  caption: string;
  memoryType: MemoryType;
  images: File[];
  video: File | null;
  audio: File | null;
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

  const getDropsFeed = useCallback(async (tab: DropTab, limit = 10, offset = 0): Promise<Drop[]> => {
    const { data, error } = await supabase.rpc('get_drops_feed', { p_tab: tab, p_limit: limit, p_offset: offset });
    if (error || !data) return [];
    return data as Drop[];
  }, []);

  const getSavedDrops = useCallback(async (limit = 10, offset = 0): Promise<Drop[]> => {
    const { data, error } = await supabase.rpc('get_saved_drops', { p_limit: limit, p_offset: offset });
    if (error || !data) return [];
    return data as Drop[];
  }, []);

  const getDrop = useCallback(async (dropId: string): Promise<Drop | null> => {
    const { data, error } = await supabase.rpc('get_drop', { p_post_id: dropId });
    if (error || !data || data.length === 0) return null;
    return data[0] as Drop;
  }, []);

  const getMyReflections = useCallback(async (dropId: string): Promise<Reflection[]> => {
    const { data, error } = await supabase.rpc('get_my_reflections', { p_post_id: dropId });
    if (error || !data) return [];
    return data as Reflection[];
  }, []);

  const createDrop = useCallback(async ({
    caption, memoryType, images, video, audio, unlockDate, visibility, mood,
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
    let audioUrl: string | null = null;
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

      if (memoryType === 'audio' && audio) {
        const path = generateStoragePath(user.id, audio.name);
        const url = await uploadFile('post-media', path, audio);
        if (!url) throw new Error('Audio upload failed. Try again.');
        audioUrl = url;
        const { error: updateError } = await supabase.from('posts').update({ audio_url: url }).eq('id', dropId);
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
      audio_url: isUnlocked ? audioUrl : null,
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
  const recordUnlockView = useCallback(async (dropId: string): Promise<void> => {
    if (!user) return;
    await supabase.from('drop_unlock_views').insert({ drop_id: dropId, user_id: user.id });
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

  // A private note-to-self — allowed any time, locked or unlocked, and
  // never visible to anyone but the person who wrote it.
  const addReflection = useCallback(async (dropId: string, content: string): Promise<{ error: string | null; reflection: Reflection | null }> => {
    if (!user) return { error: 'Not authenticated', reflection: null };
    const trimmed = content.trim();
    if (!trimmed) return { error: 'Write something first.', reflection: null };
    const { data, error } = await supabase
      .from('comments')
      .insert({ post_id: dropId, user_id: user.id, content: trimmed, is_reflection: true })
      .select()
      .single();
    if (error || !data) return { error: error?.message ?? 'Could not save reflection.', reflection: null };
    return { error: null, reflection: { id: data.id, content: trimmed, created_at: data.created_at } };
  }, [user]);

  const incrementShareCount = useCallback(async (dropId: string): Promise<void> => {
    await supabase.rpc('increment_share_count', { p_post_id: dropId });
  }, []);

  return {
    getDropsFeed,
    getSavedDrops,
    getDrop,
    getMyReflections,
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
    addReflection,
    incrementShareCount,
  };
};
