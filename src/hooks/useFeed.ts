import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { uploadFile, deleteFile, generateStoragePath, extractStoragePath } from '../utils/storage';
import { compressImageFile } from '../lib/image';
import type { AuthResult } from '../types/auth';
import type { FeedPost, FeedTab, PostComment, PostType, ReportReason } from '../types/feed';

interface CreatePostParams {
  caption: string;
  postType: PostType;
  images: File[];
  video: File | null;
}

interface CreatePostResult extends AuthResult {
  post: FeedPost | null;
}

// Reads (get_feed, get_saved_posts, get_comments) go through SECURITY
// DEFINER RPCs for the same reason as every cross-user read since Phase 2:
// profiles RLS only lets a user read their own row, so anything joining in
// author info for someone else's content needs a function allowed to
// bypass that. Writes are direct table calls — RLS and the counter
// triggers on those tables are the real enforcement (see
// supabase/phase4_feed.sql).
export const useFeed = () => {
  const { user, profile } = useAuth();

  const getFeed = useCallback(async (tab: FeedTab, limit = 10, offset = 0): Promise<FeedPost[]> => {
    const { data, error } = await supabase.rpc('get_feed', { p_tab: tab, p_limit: limit, p_offset: offset });
    if (error || !data) return [];
    return data as FeedPost[];
  }, []);

  const getSavedPosts = useCallback(async (limit = 10, offset = 0): Promise<FeedPost[]> => {
    const { data, error } = await supabase.rpc('get_saved_posts', { p_limit: limit, p_offset: offset });
    if (error || !data) return [];
    return data as FeedPost[];
  }, []);

  const getPost = useCallback(async (postId: string): Promise<FeedPost | null> => {
    const { data, error } = await supabase.rpc('get_post', { p_post_id: postId });
    if (error || !data || data.length === 0) return null;
    return data[0] as FeedPost;
  }, []);

  const getComments = useCallback(async (postId: string, limit = 50, offset = 0): Promise<PostComment[]> => {
    const { data, error } = await supabase.rpc('get_comments', { p_post_id: postId, p_limit: limit, p_offset: offset });
    if (error || !data) return [];
    return data as PostComment[];
  }, []);

  const createPost = useCallback(async ({ caption, postType, images, video }: CreatePostParams): Promise<CreatePostResult> => {
    if (!user) return { error: 'Not authenticated', post: null };

    const { data: postRow, error: insertError } = await supabase
      .from('posts')
      .insert({ user_id: user.id, post_type: postType, caption: caption.trim() || null })
      .select()
      .single();
    if (insertError || !postRow) return { error: insertError?.message ?? 'Could not create post.', post: null };

    const postId = postRow.id as string;
    let videoUrl: string | null = null;
    const uploadedImages: { url: string; position: number }[] = [];

    try {
      if (postType === 'video' && video) {
        const path = generateStoragePath(user.id, video.name);
        const url = await uploadFile('post-media', path, video);
        if (!url) throw new Error('Video upload failed. Try again.');
        videoUrl = url;
        const { error: videoUpdateError } = await supabase.from('posts').update({ video_url: url }).eq('id', postId);
        if (videoUpdateError) throw new Error(videoUpdateError.message);
      }

      if (postType === 'photo' && images.length > 0) {
        for (let i = 0; i < images.length; i++) {
          const compressed = await compressImageFile(images[i]);
          const path = generateStoragePath(user.id, compressed.name);
          const url = await uploadFile('post-media', path, compressed);
          if (!url) throw new Error('Image upload failed. Try again.');
          uploadedImages.push({ url, position: i });
        }
        const { error: imagesError } = await supabase
          .from('post_images')
          .insert(uploadedImages.map(img => ({ post_id: postId, image_url: img.url, position: img.position })));
        if (imagesError) throw new Error(imagesError.message);
      }
    } catch (err) {
      // Best-effort: don't leave a broken, media-less post behind.
      await supabase.from('posts').delete().eq('id', postId);
      return { error: err instanceof Error ? err.message : 'Could not finish creating your post.', post: null };
    }

    const post: FeedPost = {
      id: postId,
      user_id: user.id,
      username: profile?.username ?? '',
      display_name: profile?.display_name ?? null,
      profile_photo_url: profile?.profile_photo_url ?? null,
      is_private: profile?.is_private ?? false,
      caption: caption.trim() || null,
      post_type: postType,
      video_url: videoUrl,
      images: uploadedImages.map(img => ({ url: img.url, position: img.position })),
      like_count: 0,
      comment_count: 0,
      share_count: 0,
      save_count: 0,
      is_liked: false,
      is_saved: false,
      created_at: postRow.created_at as string,
    };
    return { error: null, post };
  }, [user, profile]);

  const deletePost = useCallback(async (post: FeedPost): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase.from('posts').delete().eq('id', post.id);
    if (error) return { error: error.message };

    // Best-effort storage cleanup — the DB rows are already gone (cascade),
    // this just stops the files themselves from lingering in the bucket.
    const paths = [
      ...post.images.map(img => extractStoragePath(img.url, 'post-media')),
      post.video_url ? extractStoragePath(post.video_url, 'post-media') : null,
    ].filter((p): p is string => Boolean(p));
    await Promise.all(paths.map(p => deleteFile('post-media', p)));

    return { error: null };
  }, [user]);

  const likePost = useCallback(async (postId: string): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase.from('likes').insert({ post_id: postId, user_id: user.id });
    if (error && !/unique/i.test(error.message)) return { error: error.message };
    return { error: null };
  }, [user]);

  const unlikePost = useCallback(async (postId: string): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', user.id);
    return { error: error?.message ?? null };
  }, [user]);

  const savePost = useCallback(async (postId: string): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase.from('saved_posts').insert({ post_id: postId, user_id: user.id });
    if (error && !/unique/i.test(error.message)) return { error: error.message };
    return { error: null };
  }, [user]);

  const unsavePost = useCallback(async (postId: string): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase.from('saved_posts').delete().eq('post_id', postId).eq('user_id', user.id);
    return { error: error?.message ?? null };
  }, [user]);

  const hidePost = useCallback(async (postId: string): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase.from('hidden_posts').insert({ post_id: postId, user_id: user.id });
    if (error && !/unique/i.test(error.message)) return { error: error.message };
    return { error: null };
  }, [user]);

  const reportPost = useCallback(async (postId: string, reason: ReportReason, details?: string): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase
      .from('reports')
      .insert({ post_id: postId, reporter_id: user.id, reason, details: details?.trim() || null });
    if (error) {
      if (/unique/i.test(error.message)) return { error: 'You already reported this post.' };
      return { error: error.message };
    }
    return { error: null };
  }, [user]);

  const addComment = useCallback(async (postId: string, content: string): Promise<{ error: string | null; comment: PostComment | null }> => {
    if (!user) return { error: 'Not authenticated', comment: null };
    const trimmed = content.trim();
    if (!trimmed) return { error: 'Comment cannot be empty.', comment: null };

    const { data, error } = await supabase
      .from('comments')
      .insert({ post_id: postId, user_id: user.id, content: trimmed })
      .select()
      .single();
    if (error || !data) return { error: error?.message ?? 'Could not post comment.', comment: null };

    const comment: PostComment = {
      id: data.id,
      user_id: user.id,
      username: profile?.username ?? '',
      display_name: profile?.display_name ?? null,
      profile_photo_url: profile?.profile_photo_url ?? null,
      content: trimmed,
      created_at: data.created_at,
    };
    return { error: null, comment };
  }, [user, profile]);

  const deleteComment = useCallback(async (commentId: string): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase.from('comments').delete().eq('id', commentId).eq('user_id', user.id);
    return { error: error?.message ?? null };
  }, [user]);

  const incrementShareCount = useCallback(async (postId: string): Promise<void> => {
    await supabase.rpc('increment_share_count', { p_post_id: postId });
  }, []);

  return {
    getFeed,
    getPost,
    getSavedPosts,
    getComments,
    createPost,
    deletePost,
    likePost,
    unlikePost,
    savePost,
    unsavePost,
    hidePost,
    reportPost,
    addComment,
    deleteComment,
    incrementShareCount,
  };
};
