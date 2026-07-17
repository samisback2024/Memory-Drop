import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useSocial } from '../hooks/useSocial';
import { PublicPageHeader } from '../components/layout/PublicPageHeader';
import { OrbitingYouList } from '../components/social/OrbitingYouList';
import { UserListSkeleton } from '../components/social/UserList';
import { UserNotFoundState } from '../components/shared/UserNotFoundState';
import { ErrorState } from '../components/ui/ErrorState';

interface TargetProfile {
  id: string;
  username: string;
  display_name: string | null;
  is_private: boolean;
  is_own_profile: boolean;
}

type FetchState = 'loading' | 'ready' | 'not_found' | 'error';

// Mounted at both /orbiting-you (own list) and /u/:username/orbiting-you
// (anyone else's) — see App.tsx. Resolving through get_profile_by_username
// either way means "my own" isn't a special case: is_own_profile just
// comes back true, same RPC either route.
export const OrbitingYouPage: React.FC = () => {
  const { username: paramUsername } = useParams<{ username?: string }>();
  const { profile: myProfile, user } = useAuth();
  const { getRelationship } = useSocial();
  const username = paramUsername ?? myProfile?.username ?? null;

  const [target, setTarget] = useState<TargetProfile | null>(null);
  const [isInOrbit, setIsInOrbit] = useState(false);
  const [state, setState] = useState<FetchState>('loading');

  const load = useCallback(async () => {
    if (!username) return;
    setState('loading');
    const { data, error } = await supabase.rpc('get_profile_by_username', { p_username: username });
    if (error) { setState('error'); return; }
    if (!data || data.length === 0) { setState('not_found'); return; }
    const profile = data[0] as TargetProfile;
    setTarget(profile);
    if (user && !profile.is_own_profile && profile.is_private) {
      const rel = await getRelationship(profile.id);
      setIsInOrbit(Boolean(rel?.is_in_orbit));
    }
    setState('ready');
  }, [username, user, getRelationship]);

  useEffect(() => { load(); }, [load]);

  const canView = Boolean(target && (target.is_own_profile || !target.is_private || isInOrbit));
  const title = target ? `${target.display_name || target.username}'s Orbit` : 'Orbiting You';

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicPageHeader title={state === 'ready' ? title : undefined} />
      <main className="max-w-2xl mx-auto px-4 py-6">
        {state === 'loading' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <UserListSkeleton />
          </div>
        )}
        {state === 'not_found' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <UserNotFoundState username={username} />
          </div>
        )}
        {state === 'error' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <ErrorState title="Couldn't load Orbit" onRetry={load} />
          </div>
        )}
        {state === 'ready' && target && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <OrbitingYouList profileId={target.id} isOwnProfile={target.is_own_profile} canView={canView} />
          </div>
        )}
      </main>
    </div>
  );
};
