import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import type { AuthResult } from '../types/auth';
import type {
  Relationship, SocialCounts, SocialUser, SocialUserWithRelationship, SuggestedUser, PendingRequest,
} from '../types/social';

interface FollowResult extends AuthResult {
  status: 'accepted' | 'pending' | null;
}

// Every read here (search, suggestions, followers/following, mutual
// friends, relationship state) goes through a SECURITY DEFINER RPC — same
// reason as get_profile_by_username in Phase 2: profiles RLS only lets a
// user read their own row, so any screen that shows *someone else's*
// profile info has to go through a function that's allowed to bypass that
// and apply the real privacy rule itself. Writes (follow, block, mute,
// restrict, accept, decline, unfollow, remove-follower) are direct table
// calls — RLS and triggers on those tables are the actual enforcement
// (see supabase/phase3_social_graph.sql).
export const useSocial = () => {
  const { user } = useAuth();

  const getRelationship = useCallback(async (targetId: string): Promise<Relationship | null> => {
    const { data, error } = await supabase.rpc('get_relationship', { p_target_id: targetId });
    if (error || !data || data.length === 0) return null;
    return data[0] as Relationship;
  }, []);

  const getSocialCounts = useCallback(async (profileId: string): Promise<SocialCounts> => {
    const { data, error } = await supabase.rpc('get_social_counts', { p_profile_id: profileId });
    if (error || !data || data.length === 0) return { followers_count: 0, following_count: 0 };
    return data[0] as SocialCounts;
  }, []);

  const followUser = useCallback(async (targetId: string): Promise<FollowResult> => {
    if (!user) return { error: 'Not authenticated', status: null };
    const { data, error } = await supabase
      .from('follows')
      .insert({ follower_id: user.id, following_id: targetId })
      .select('status')
      .single();
    if (error) {
      if (/unique/i.test(error.message)) return { error: 'You already follow this user.', status: null };
      return { error: error.message, status: null };
    }
    return { error: null, status: data.status as 'accepted' | 'pending' };
  }, [user]);

  // Deletes a specific (follower, following) pair. Backs unfollow, cancel
  // request, decline request, and remove-follower — all four are "delete
  // the row for this pair," just from different sides of it (see the
  // wrappers below and the DELETE RLS policy, which allows either party).
  const deleteFollowPair = useCallback(async (followerId: string, followingId: string): Promise<AuthResult> => {
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', followingId);
    return { error: error?.message ?? null };
  }, []);

  const unfollowUser = useCallback((targetId: string) => {
    if (!user) return Promise.resolve<AuthResult>({ error: 'Not authenticated' });
    return deleteFollowPair(user.id, targetId);
  }, [user, deleteFollowPair]);

  const cancelRequest = unfollowUser; // same delete, sent-side

  const declineRequest = useCallback((requesterId: string) => {
    if (!user) return Promise.resolve<AuthResult>({ error: 'Not authenticated' });
    return deleteFollowPair(requesterId, user.id);
  }, [user, deleteFollowPair]);

  const removeFollower = declineRequest; // same delete, received-side

  const acceptRequest = useCallback(async (requesterId: string): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase
      .from('follows')
      .update({ status: 'accepted' })
      .eq('follower_id', requesterId)
      .eq('following_id', user.id);
    return { error: error?.message ?? null };
  }, [user]);

  const makeToggle = (table: 'user_blocks' | 'user_mutes' | 'user_restrictions', actorCol: string, targetCol: string) => ({
    add: async (targetId: string): Promise<AuthResult> => {
      if (!user) return { error: 'Not authenticated' };
      const payload: Record<string, string> = { [actorCol]: user.id, [targetCol]: targetId };
      const { error } = await supabase.from(table).insert(payload);
      if (error && !/unique/i.test(error.message)) return { error: error.message };
      return { error: null };
    },
    remove: async (targetId: string): Promise<AuthResult> => {
      if (!user) return { error: 'Not authenticated' };
      const { error } = await supabase.from(table).delete().eq(actorCol, user.id).eq(targetCol, targetId);
      return { error: error?.message ?? null };
    },
  });

  const blocks = makeToggle('user_blocks', 'blocker_id', 'blocked_id');
  const mutes = makeToggle('user_mutes', 'muter_id', 'muted_id');
  const restrictions = makeToggle('user_restrictions', 'restrictor_id', 'restricted_id');

  const searchUsers = useCallback(async (query: string): Promise<SocialUserWithRelationship[]> => {
    const { data, error } = await supabase.rpc('search_users', { p_query: query, p_limit: 20 });
    if (error || !data) return [];
    return data as SocialUserWithRelationship[];
  }, []);

  const getSuggestedFriends = useCallback(async (limit = 10): Promise<SuggestedUser[]> => {
    const { data, error } = await supabase.rpc('get_suggested_friends', { p_limit: limit });
    if (error || !data) return [];
    return data as SuggestedUser[];
  }, []);

  // Explore's "New Creators" tab (Phase 10g) — recently-joined accounts,
  // same shape as getSuggestedFriends so both render through UserList.
  const getNewCreators = useCallback(async (limit = 20): Promise<SuggestedUser[]> => {
    const { data, error } = await supabase.rpc('get_new_creators', { p_limit: limit });
    if (error || !data) return [];
    return data as SuggestedUser[];
  }, []);

  const getMutualFriendsCount = useCallback(async (targetId: string): Promise<number> => {
    const { data, error } = await supabase.rpc('get_mutual_friends_count', { p_target_id: targetId });
    if (error || data === null) return 0;
    return Number(data);
  }, []);

  const getMutualFriends = useCallback(async (targetId: string, limit = 3): Promise<SocialUser[]> => {
    const { data, error } = await supabase.rpc('get_mutual_friends', { p_target_id: targetId, p_limit: limit });
    if (error || !data) return [];
    return data as SocialUser[];
  }, []);

  const getFollowers = useCallback(async (profileId: string): Promise<SocialUserWithRelationship[]> => {
    const { data, error } = await supabase.rpc('get_followers', { p_profile_id: profileId });
    if (error || !data) return [];
    return data as SocialUserWithRelationship[];
  }, []);

  const getFollowing = useCallback(async (profileId: string): Promise<SocialUserWithRelationship[]> => {
    const { data, error } = await supabase.rpc('get_following', { p_profile_id: profileId });
    if (error || !data) return [];
    return data as SocialUserWithRelationship[];
  }, []);

  const getPendingRequestsReceived = useCallback(async (): Promise<PendingRequest[]> => {
    const { data, error } = await supabase.rpc('get_pending_requests_received');
    if (error || !data) return [];
    return data as PendingRequest[];
  }, []);

  const getPendingRequestsSent = useCallback(async (): Promise<PendingRequest[]> => {
    const { data, error } = await supabase.rpc('get_pending_requests_sent');
    if (error || !data) return [];
    return data as PendingRequest[];
  }, []);

  return {
    getRelationship,
    getSocialCounts,
    followUser,
    unfollowUser,
    cancelRequest,
    acceptRequest,
    declineRequest,
    removeFollower,
    blockUser: blocks.add,
    unblockUser: blocks.remove,
    muteUser: mutes.add,
    unmuteUser: mutes.remove,
    restrictUser: restrictions.add,
    unrestrictUser: restrictions.remove,
    searchUsers,
    getSuggestedFriends,
    getNewCreators,
    getMutualFriendsCount,
    getMutualFriends,
    getFollowers,
    getFollowing,
    getPendingRequestsReceived,
    getPendingRequestsSent,
  };
};
