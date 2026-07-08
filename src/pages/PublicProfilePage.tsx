import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, UserX } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { ProfileHeader } from '../components/profile/ProfileHeader';
import { ProfileHeaderSkeleton } from '../components/profile/ProfileHeaderSkeleton';
import { BadgesAndAchievements, BadgesAndAchievementsSkeleton } from '../components/profile/BadgesAndAchievements';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';

interface PublicProfile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  profile_photo_url: string | null;
  cover_photo_url: string | null;
  website: string | null;
  location: string | null;
  pronouns: string | null;
  is_private: boolean;
  profile_completed: boolean;
  created_at: string;
  is_own_profile: boolean;
}

type FetchState = 'loading' | 'ready' | 'not_found' | 'error';

export const PublicProfilePage: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState<PublicProfile | null>(null);
  const [state, setState] = useState<FetchState>('loading');

  const load = useCallback(() => {
    if (!username) return;
    let cancelled = false;
    setState('loading');

    supabase.rpc('get_profile_by_username', { p_username: username })
      .then(({ data: rows, error }) => {
        if (cancelled) return;
        if (error) {
          setState('error');
        } else if (!rows || rows.length === 0) {
          setState('not_found');
        } else {
          setData(rows[0] as PublicProfile);
          setState('ready');
        }
      }, () => {
        if (cancelled) return;
        setState('error');
      });

    return () => { cancelled = true; };
  }, [username]);

  useEffect(() => load(), [load]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 -ml-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none"
            aria-label="Go back"
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center">
              <span className="text-white font-bold text-xs">M</span>
            </div>
            <span className="font-bold text-gray-900">Memory Drop</span>
          </Link>
          {!user && (
            <Link to="/login" className="text-sm font-medium text-purple-600 hover:text-purple-700">
              Sign in
            </Link>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {state === 'loading' && (
          <div className="flex flex-col gap-4">
            <ProfileHeaderSkeleton />
            <BadgesAndAchievementsSkeleton />
          </div>
        )}

        {state === 'not_found' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <EmptyState icon={UserX} title="User not found" description={`No account with the username @${username}.`} />
          </div>
        )}

        {state === 'error' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <ErrorState
              title="Couldn't load this profile"
              description="Check your connection and try again."
              onRetry={load}
            />
          </div>
        )}

        {state === 'ready' && data && (
          <div className="flex flex-col gap-4">
            <ProfileHeader
              profile={data}
              isOwnProfile={data.is_own_profile}
              bioHidden={data.is_private && !data.is_own_profile}
            />
            <BadgesAndAchievements />
          </div>
        )}
      </main>
    </div>
  );
};
