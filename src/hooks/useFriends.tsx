import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { demoProfiles, DEMO_USER_ID, demoFollowRequests } from '../lib/demo-data';
import type { Profile, FollowRequest } from '../types';
import { useAuth } from './useAuth';

export const useFriends = () => {
  const { isDemo, user } = useAuth();
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [following, setFollowing] = useState<string[]>(['demo-user-002', 'demo-user-003']);
  const [followers, setFollowers] = useState<string[]>(['demo-user-002', 'demo-user-004']);
  const [pendingRequests, setPendingRequests] = useState<FollowRequest[]>(demoFollowRequests);
  const [searching, setSearching] = useState(false);

  const searchUsers = useCallback(async (query: string) => {
    if (!query.trim()) { setSearchResults([]); return; }
    setSearching(true);
    if (isDemo) {
      const q = query.toLowerCase();
      const results = demoProfiles.filter(
        p => p.id !== DEMO_USER_ID &&
          (p.username.toLowerCase().includes(q) || p.full_name.toLowerCase().includes(q)),
      );
      setSearchResults(results);
      setSearching(false);
      return;
    }
    if (!user) { setSearching(false); return; }
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
      .neq('id', user.id)
      .limit(20);
    if (!error && data) setSearchResults(data as Profile[]);
    setSearching(false);
  }, [isDemo, user]);

  const followUser = async (targetId: string): Promise<void> => {
    if (isDemo) {
      setFollowing(prev => [...prev, targetId]);
      return;
    }
    if (!user) return;
    await supabase.from('follows').insert({ follower_id: user.id, following_id: targetId });
    setFollowing(prev => [...prev, targetId]);
  };

  const unfollowUser = async (targetId: string): Promise<void> => {
    if (isDemo) {
      setFollowing(prev => prev.filter(id => id !== targetId));
      return;
    }
    if (!user) return;
    await supabase.from('follows').delete()
      .eq('follower_id', user.id).eq('following_id', targetId);
    setFollowing(prev => prev.filter(id => id !== targetId));
  };

  const sendFollowRequest = async (targetId: string): Promise<void> => {
    if (isDemo) {
      const req: FollowRequest = {
        id: `req-${Date.now()}`,
        requester_id: DEMO_USER_ID,
        target_id: targetId,
        status: 'pending',
        created_at: new Date().toISOString(),
      };
      setPendingRequests(prev => [...prev, req]);
      return;
    }
    if (!user) return;
    await supabase.from('follow_requests').insert({ requester_id: user.id, target_id: targetId });
  };

  const acceptRequest = async (requestId: string, requesterId: string): Promise<void> => {
    if (isDemo) {
      setPendingRequests(prev => prev.filter(r => r.id !== requestId));
      setFollowers(prev => [...prev, requesterId]);
      return;
    }
    if (!user) return;
    await supabase.from('follow_requests').update({ status: 'accepted' }).eq('id', requestId);
    await supabase.from('follows').insert({ follower_id: requesterId, following_id: user.id });
    setPendingRequests(prev => prev.filter(r => r.id !== requestId));
  };

  const declineRequest = async (requestId: string): Promise<void> => {
    if (isDemo) {
      setPendingRequests(prev => prev.filter(r => r.id !== requestId));
      return;
    }
    await supabase.from('follow_requests').update({ status: 'declined' }).eq('id', requestId);
    setPendingRequests(prev => prev.filter(r => r.id !== requestId));
  };

  const isFollowing = (targetId: string): boolean => following.includes(targetId);

  const fetchFollowState = useCallback(async () => {
    if (isDemo || !user) return;
    const [f1, f2] = await Promise.all([
      supabase.from('follows').select('following_id').eq('follower_id', user.id),
      supabase.from('follows').select('follower_id').eq('following_id', user.id),
    ]);
    if (f1.data) setFollowing(f1.data.map((r: { following_id: string }) => r.following_id));
    if (f2.data) setFollowers(f2.data.map((r: { follower_id: string }) => r.follower_id));
  }, [isDemo, user]);

  return {
    searchResults,
    following,
    followers,
    pendingRequests,
    searching,
    searchUsers,
    followUser,
    unfollowUser,
    sendFollowRequest,
    acceptRequest,
    declineRequest,
    isFollowing,
    fetchFollowState,
  };
};
