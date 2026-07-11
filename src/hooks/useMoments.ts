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
  Moment, MomentTrayItem, MomentSeenEntry, MomentReactionSummary, MomentReply,
  MomentMediaType, MomentPrivacy, MomentDurationHours,
} from '../types/moment';

interface CreateMomentParams {
  mediaType: MomentMediaType;
  textContent: string;
  file: File | null;
  mood: Mood | null;
  locationText: string;
  mentionedUserId: string | null;
  mentionedUsername: string | null;
  privacy: MomentPrivacy;
  durationHours: MomentDurationHours;
}

interface CreateMomentResult extends AuthResult {
  moment: Moment | null;
}

// Reads all go through SECURITY DEFINER RPCs, same reason as useDrops —
// profiles RLS only lets a user read their own row directly, so anything
// joining in author info for someone else's moment needs a function
// allowed to bypass that. can_view_moment (phase5_moments.sql) is what
// those RPCs — and the direct-table RLS below — both key off. Writes are
// direct table calls; RLS and the view/reaction counter triggers are the
// real enforcement.
export const useMoments = () => {
  const { user, profile } = useAuth();

  const getMomentsTray = useCallback(async (limit = 50): Promise<MomentTrayItem[]> => {
    const { signal, clear } = withAbortTimeout();
    const { data, error } = await supabase.rpc('get_moments_tray', { p_limit: limit }).abortSignal(signal);
    clear();
    if (error || !data) {
      if (error) logger.warn('getMomentsTray failed', { message: error.message });
      return [];
    }
    return data as MomentTrayItem[];
  }, []);

  const getUserMoments = useCallback(async (userId: string, includeExpired = false): Promise<Moment[]> => {
    const { data, error } = await supabase.rpc('get_user_moments', { p_user_id: userId, p_include_expired: includeExpired });
    if (error || !data) return [];
    return data as Moment[];
  }, []);

  const getMoment = useCallback(async (momentId: string): Promise<Moment | null> => {
    const { data, error } = await supabase.rpc('get_moment', { p_moment_id: momentId });
    if (error || !data || data.length === 0) return null;
    return data[0] as Moment;
  }, []);

  const getMomentSeenList = useCallback(async (momentId: string): Promise<MomentSeenEntry[]> => {
    const { data, error } = await supabase.rpc('get_moment_seen_list', { p_moment_id: momentId });
    if (error || !data) return [];
    return data as MomentSeenEntry[];
  }, []);

  const getMomentReactions = useCallback(async (momentId: string): Promise<MomentReactionSummary[]> => {
    const { data, error } = await supabase.rpc('get_moment_reactions', { p_moment_id: momentId });
    if (error || !data) return [];
    return data as MomentReactionSummary[];
  }, []);

  const createMoment = useCallback(async ({
    mediaType, textContent, file, mood, locationText, mentionedUserId, mentionedUsername, privacy, durationHours,
  }: CreateMomentParams): Promise<CreateMomentResult> => {
    if (!user) return { error: 'Not authenticated', moment: null };

    // Unlike a Drop, a moment's media has to exist before the row does —
    // the DB constraint requires media_url up front for photo/video
    // moments, so there's no "insert then attach" step here.
    let mediaUrl: string | null = null;
    let uploadedPath: string | null = null;

    if (mediaType !== 'text') {
      if (!file) return { error: 'Add a photo or video first.', moment: null };
      const toUpload = mediaType === 'photo' ? await compressImageFile(file) : file;
      uploadedPath = generateStoragePath(user.id, toUpload.name);
      const url = await uploadFile('moments', uploadedPath, toUpload);
      if (!url) return { error: 'Upload failed. Try again.', moment: null };
      mediaUrl = url;
    }

    const { data, error } = await supabase
      .from('moments')
      .insert({
        user_id: user.id,
        text_content: textContent.trim() || null,
        media_url: mediaUrl,
        media_type: mediaType,
        mood,
        location_text: locationText.trim() || null,
        mentioned_user_id: mentionedUserId,
        privacy,
        duration_hours: durationHours,
      })
      .select()
      .single();

    if (error || !data) {
      if (uploadedPath) await deleteFile('moments', uploadedPath);
      return { error: error?.message ?? 'Could not create your moment.', moment: null };
    }

    const moment: Moment = {
      id: data.id as string,
      user_id: user.id,
      username: profile?.username ?? '',
      display_name: profile?.display_name ?? null,
      profile_photo_url: profile?.profile_photo_url ?? null,
      text_content: data.text_content as string | null,
      media_url: data.media_url as string | null,
      media_type: mediaType,
      mood,
      location_text: data.location_text as string | null,
      mentioned_username: mentionedUsername,
      privacy,
      duration_hours: durationHours,
      expires_at: data.expires_at as string,
      is_owner: true,
      is_expired: false,
      view_count: 0,
      my_reaction: null,
      is_viewed: true,
      created_at: data.created_at as string,
    };
    void track('moment_created', { media_type: mediaType, privacy });
    return { error: null, moment };
  }, [user, profile]);

  const deleteMoment = useCallback(async (moment: Moment): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase.from('moments').delete().eq('id', moment.id);
    if (error) return { error: error.message };
    if (moment.media_url) {
      const path = extractStoragePath(moment.media_url, 'moments');
      if (path) await deleteFile('moments', path);
    }
    return { error: null };
  }, [user]);

  // Best-effort — the RLS insert policy already refuses this for the
  // moment's own owner and for expired/invisible moments, so a rejection
  // here is always the expected, silently-ignorable case.
  const recordMomentView = useCallback(async (momentId: string): Promise<void> => {
    if (!user) return;
    await supabase.from('moment_views').insert({ moment_id: momentId, viewer_id: user.id });
  }, [user]);

  const reactToMoment = useCallback(async (momentId: string, emoji: string): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase
      .from('moment_reactions')
      .upsert({ moment_id: momentId, user_id: user.id, emoji }, { onConflict: 'moment_id,user_id' });
    return { error: error?.message ?? null };
  }, [user]);

  const removeMomentReaction = useCallback(async (momentId: string): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase.from('moment_reactions').delete().eq('moment_id', momentId).eq('user_id', user.id);
    return { error: error?.message ?? null };
  }, [user]);

  const replyToMoment = useCallback(async (momentId: string, content: string): Promise<{ error: string | null; reply: MomentReply | null }> => {
    if (!user) return { error: 'Not authenticated', reply: null };
    const trimmed = content.trim();
    if (!trimmed) return { error: 'Write a reply first.', reply: null };
    const { data, error } = await supabase
      .from('moment_replies')
      .insert({ moment_id: momentId, user_id: user.id, content: trimmed })
      .select()
      .single();
    if (error || !data) {
      if (error && /row-level security/i.test(error.message)) {
        return { error: 'This moment is no longer available to reply to.', reply: null };
      }
      return { error: error?.message ?? 'Could not send reply.', reply: null };
    }
    return { error: null, reply: { id: data.id as string, content: trimmed, created_at: data.created_at as string } };
  }, [user]);

  return {
    getMomentsTray,
    getUserMoments,
    getMoment,
    getMomentSeenList,
    getMomentReactions,
    createMoment,
    deleteMoment,
    recordMomentView,
    reactToMoment,
    removeMomentReaction,
    replyToMoment,
  };
};
