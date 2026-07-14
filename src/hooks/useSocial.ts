import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { track } from '../lib/analytics';
import type { AuthResult } from '../types/auth';
import type {
  Relationship, SocialCounts, SocialUser, SocialUserWithRelationship, SuggestedUser, PendingRequest,
} from '../types/social';

interface OrbitResult extends AuthResult {
  status: 'accepted' | 'pending' | null;
}

// Every read here (search, suggestions, orbiters/orbiting, mutual
// friends, relationship state) goes through a SECURITY DEFINER RPC — same
// reason as get_profile_by_username in Phase 2: profiles RLS only lets a
// user read their own row, so any screen that shows *someone else's*
// profile info has to go through a function that's allowed to bypass that
// and apply the real privacy rule itself. Writes (orbit, block, mute,
// restrict, accept, decline, leave orbit, remove from orbit) are direct
// table calls — RLS and triggers on those tables are the actual
// enforcement (see supabase/phase15_orbit_system.sql).
export const useSocial = () => {
  const { user } = useAuth();

  const getRelationship = useCallback(async (targetId: string): Promise<Relationship | null> => {
    const { data, error } = await supabase.rpc('get_relationship', { p_target_id: targetId });
    if (error || !data || data.length === 0) return null;
    return data[0] as Relationship;
  }, []);

  const getSocialCounts = useCallback(async (profileId: string): Promise<SocialCounts> => {
    const { data, error } = await supabase.rpc('get_social_counts', { p_profile_id: profileId });
    if (error || !data || data.length === 0) return { orbiting_count: 0, in_orbit_count: 0 };
    return data[0] as SocialCounts;
  }, []);

  const orbitUser = useCallback(async (targetId: string): Promise<OrbitResult> => {
    if (!user) return { error: 'Not authenticated', status: null };
    const { data, error } = await supabase
      .from('orbits')
      .insert({ orbiter_id: user.id, orbiting_id: targetId })
      .select('status')
      .single();
    if (error) {
      if (/unique/i.test(error.message)) return { error: 'You already orbit this user.', status: null };
      return { error: error.message, status: null };
    }
    void track('orbit', { status: data.status });
    return { error: null, status: data.status as 'accepted' | 'pending' };
  }, [user]);

  // Deletes a specific (orbiter, orbiting) pair. Backs leave orbit, cancel
  // request, decline request, and remove-from-orbit — all four are "delete
  // the row for this pair," just from different sides of it (see the
  // wrappers below and the DELETE RLS policy, which allows either party).
  const deleteOrbitPair = useCallback(async (orbiterId: string, orbitingId: string): Promise<AuthResult> => {
    const { error } = await supabase
      .from('orbits')
      .delete()
      .eq('orbiter_id', orbiterId)
      .eq('orbiting_id', orbitingId);
    return { error: error?.message ?? null };
  }, []);

  const leaveOrbit = useCallback((targetId: string) => {
    if (!user) return Promise.resolve<AuthResult>({ error: 'Not authenticated' });
    return deleteOrbitPair(user.id, targetId);
  }, [user, deleteOrbitPair]);

  const cancelRequest = leaveOrbit; // same delete, sent-side

  const declineOrbitRequest = useCallback((requesterId: string) => {
    if (!user) return Promise.resolve<AuthResult>({ error: 'Not authenticated' });
    return deleteOrbitPair(requesterId, user.id);
  }, [user, deleteOrbitPair]);

  const removeFromOrbit = declineOrbitRequest; // same delete, received-side

  const acceptOrbitRequest = useCallback(async (requesterId: string): Promise<AuthResult> => {
    if (!user) return { error: 'Not authenticated' };
    const { error } = await supabase
      .from('orbits')
      .update({ status: 'accepted' })
      .eq('orbiter_id', requesterId)
      .eq('orbiting_id', user.id);
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

  const getOrbiters = useCallback(async (profileId: string): Promise<SocialUserWithRelationship[]> => {
    const { data, error } = await supabase.rpc('get_orbiters', { p_profile_id: profileId });
    if (error || !data) return [];
    return data as SocialUserWithRelationship[];
  }, []);

  const getOrbiting = useCallback(async (profileId: string): Promise<SocialUserWithRelationship[]> => {
    const { data, error } = await supabase.rpc('get_orbiting', { p_profile_id: profileId });
    if (error || !data) return [];
    return data as SocialUserWithRelationship[];
  }, []);

  const getOrbitRequestsReceived = useCallback(async (): Promise<PendingRequest[]> => {
    const { data, error } = await supabase.rpc('get_orbit_requests_received');
    if (error || !data) return [];
    return data as PendingRequest[];
  }, []);

  const getOrbitRequestsSent = useCallback(async (): Promise<PendingRequest[]> => {
    const { data, error } = await supabase.rpc('get_orbit_requests_sent');
    if (error || !data) return [];
    return data as PendingRequest[];
  }, []);

  return {
    getRelationship,
    getSocialCounts,
    orbitUser,
    leaveOrbit,
    cancelRequest,
    acceptOrbitRequest,
    declineOrbitRequest,
    removeFromOrbit,
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
    getOrbiters,
    getOrbiting,
    getOrbitRequestsReceived,
    getOrbitRequestsSent,
  };
};
