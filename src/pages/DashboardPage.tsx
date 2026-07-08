import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, AlertTriangle, Sparkles, CalendarDays } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { formatDate } from '../utils/date';

// Phase 1 lands here on sign-in. Deliberately minimal — Feed/Create/Memories/
// Messages/Profile (Phase 2) are not wired up yet, per scope.
export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile, profileRow, user, isDemo, emailVerified, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const joined = profileRow?.created_at ? formatDate(profileRow.created_at) : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-purple-600 to-blue-500 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center">
              <span className="text-white font-bold text-sm">M</span>
            </div>
            <span className="text-white font-bold">Memory Drop</span>
          </div>
          <div className="flex items-center gap-3">
            {isDemo && (
              <span className="text-xs font-medium bg-white/20 text-white px-2.5 py-1 rounded-full">Demo</span>
            )}
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 text-sm font-medium text-white/90 hover:text-white transition-colors"
            >
              <LogOut size={15} />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-4">
        {!emailVerified && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-2xl p-4">
            <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900">Verify your email</p>
              <p className="text-sm text-amber-700 mt-0.5">
                Check <span className="font-medium">{user?.email}</span> for a verification link.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => navigate('/verify-email')}>
              Verify
            </Button>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-4">
            <Avatar
              src={profile?.avatar_url}
              name={profile?.full_name || profile?.username || 'You'}
              size="2xl"
              ring
            />
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Welcome, {profile?.full_name || profileRow?.username || 'there'} 👋
              </h1>
              {profileRow?.username && <p className="text-sm text-gray-500">@{profileRow.username}</p>}
              {joined && (
                <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                  <CalendarDays size={12} />
                  Joined {joined}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center">
            <Sparkles size={22} className="text-purple-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">You're all set up.</p>
            <p className="text-sm text-gray-500 mt-1">
              Capsules, the feed, and messaging are coming in the next phase of Memory Drop.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};
