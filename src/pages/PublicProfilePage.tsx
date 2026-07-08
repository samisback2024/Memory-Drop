import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, UserX } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { ProfileHeader } from '../components/profile/ProfileHeader';
import { BadgesAndAchievements } from '../components/profile/BadgesAndAchievements';
import { EmptyState } from '../components/ui/EmptyState';

interface PublicProfile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  profile_photo_url: string | null;
  is_private: boolean;
  created_at: string;
  is_own_profile: boolean;
}

export const PublicProfilePage: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    setLoading(true);
    setNotFound(false);

    supabase.rpc('get_profile_by_username', { p_username: username })
      .then(({ data: rows, error }) => {
        if (cancelled) return;
        if (error || !rows || rows.length === 0) {
          setNotFound(true);
        } else {
          setData(rows[0] as PublicProfile);
        }
        setLoading(false);
      }, () => {
        if (cancelled) return;
        setNotFound(true);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [username]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 -ml-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft size={18} />
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
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
          </div>
        ) : notFound || !data ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <EmptyState icon={UserX} title="User not found" description={`No account with the username @${username}.`} />
          </div>
        ) : (
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
