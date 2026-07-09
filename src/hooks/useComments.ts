import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { AuthResult } from '../types/auth';
import type { Comment, CommentContentType, CommentReactionBreakdown, RecentLiker } from '../types/comment';

const TABLE: Record<CommentContentType, string> = { drop: 'comments', capsule: 'capsule_comments' };
const ID_COLUMN: Record<CommentContentType, string> = { drop: 'post_id', capsule: 'capsule_id' };
const REACTION_COLUMN: Record<CommentContentType, string> = { drop: 'drop_comment_id', capsule: 'capsule_comment_id' };

// Phase 10d — one shared implementation behind Drop comments and
// Capsule comments (previously two near-duplicate code paths, one in
// useDrops.ts, one in useCapsules.ts, with Capsule comments missing
// edit/delete/reply/reactions entirely). Reads go through
// get_drop_comments()/get_capsule_comments() (SECURITY DEFINER, same
// reason as every cross-user read in this app); writes are direct table
// calls — RLS plus the enforce_*_comment_rules() triggers (see
// phase10d_comments_reactions.sql) are the real enforcement, especially
// for edit/pin, where the trigger — not just RLS — decides which
// columns a given caller may actually change.
export const useComments = () => {
  const { user, profile } = useAuth();

  const getComments = useCallback(async (contentType: CommentContentType, contentId: string, limit = 100, offset = 0): Promise<Comment[]> => {
    const rpc = contentType === 'drop' ? 'get_drop_comments' : 'get_capsule_comments';
    const params = contentType === 'drop'
      ? { p_post_id: contentId, p_limit: limit, p_offset: offset }
      : { p_capsule_id: contentId, p_limit: limit, p_offset: offset };
    const { data, error } = await supabase.rpc(rpc, params);
    if (error || !data) return [];
    return data as Comment[];
  }, []);

  const addComment = useCallback(async (
    contentType: CommentContentType,
    contentId: string,
    content: string,
    parentCommentId: string | null = null,
  ): Promise<{ error: string | null; comment: Comment | null }> => {
    if (!user) return { error: 'Not authenticated', comment: null };
    const trimmed = content.trim();
    if (!trimmed) return { error: 'Comment cannot be empty.', comment: null };

    const { data, error } = await supabase
      .from(TABLE[contentType])
      .insert({ [ID_COLUMN[contentType]]: contentId, user_id: user.id, content: trimmed, parent_comment_id: parentCommentId })
      .select()
      .single();
    if (error || !data) {
      if (error && /row-level security/i.test(error.message)) {
        return { error: `Comments unlock with the ${contentType === 'drop' ? 'memory' : 'capsule'}.`, comment: null };
      }
      if (error && /one level deep/i.test(error.message)) {
        return { error: error.message, comment: null };
      }
      return { error: error?.message ?? 'Could not post comment.', comment: null };
    }

    const comment: Comment = {
      id: data.id,
      user_id: user.id,
      username: profile?.username ?? '',
      display_name: profile?.display_name ?? null,
      profile_photo_url: profile?.profile_photo_url ?? null,
      content: trimmed,
      created_at: data.created_at,
      edited_at: null,
      parent_comment_id: parentCommentId,
      is_pinned: false,
      reaction_count: 0,
      my_reaction: null,
    };
    return { error: null, comment };
  }, [user, profile]);

  const updateComment = useCallback(async (contentType: CommentContentType, commentId: string, content: string): Promise<AuthResult> => {
    const trimmed = content.trim();
    if (!trimmed) return { error: 'Comment cannot be empty.' };
    const { error } = await supabase.from(TABLE[contentType]).update({ content: trimmed }).eq('id', commentId);
    return { error: error?.message ?? null };
  }, []);

  const deleteComment = useCallback(async (contentType: CommentContentType, commentId: string): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase.from(TABLE[contentType]).delete().eq('id', commentId).eq('user_id', user.id);
    return { error: error?.message ?? null };
  }, [user]);

  // Callable by the comment's author OR the content owner — RLS allows
  // either row to be targeted, the trigger enforces which of them may
  // actually change which column (content vs. is_pinned).
  const setCommentPinned = useCallback(async (contentType: CommentContentType, commentId: string, pinned: boolean): Promise<AuthResult> => {
    const { error } = await supabase.from(TABLE[contentType]).update({ is_pinned: pinned }).eq('id', commentId);
    return { error: error?.message ?? null };
  }, []);

  const reactToComment = useCallback(async (contentType: CommentContentType, commentId: string, emoji: string): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const column = REACTION_COLUMN[contentType];
    const { error } = await supabase
      .from('comment_reactions')
      .upsert({ [column]: commentId, user_id: user.id, emoji }, { onConflict: `${column},user_id` });
    return { error: error?.message ?? null };
  }, [user]);

  const unreactToComment = useCallback(async (contentType: CommentContentType, commentId: string): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const column = REACTION_COLUMN[contentType];
    const { error } = await supabase.from('comment_reactions').delete().eq(column, commentId).eq('user_id', user.id);
    return { error: error?.message ?? null };
  }, [user]);

  const getCommentReactionBreakdown = useCallback(async (contentType: CommentContentType, commentId: string): Promise<CommentReactionBreakdown[]> => {
    const { data, error } = await supabase.rpc('get_comment_reactions', { p_comment_type: contentType, p_comment_id: commentId });
    if (error || !data) return [];
    return data as CommentReactionBreakdown[];
  }, []);

  const getRecentLikers = useCallback(async (contentType: CommentContentType, contentId: string, limit = 10): Promise<RecentLiker[]> => {
    const { data, error } = await supabase.rpc('get_recent_likers', { p_content_type: contentType, p_content_id: contentId, p_limit: limit });
    if (error || !data) return [];
    return data as RecentLiker[];
  }, []);

  return {
    getComments,
    addComment,
    updateComment,
    deleteComment,
    setCommentPinned,
    reactToComment,
    unreactToComment,
    getCommentReactionBreakdown,
    getRecentLikers,
  };
};
