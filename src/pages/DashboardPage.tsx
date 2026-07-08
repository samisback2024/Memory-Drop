import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, User } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile, user, emailVerified } = useAuth();

  const displayName = profile?.display_name || profile?.username || 'there';

  return (
    <div className="flex flex-col gap-4">
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

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <Avatar src={profile?.profile_photo_url} name={displayName} size="2xl" ring />
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 truncate">Welcome back, {displayName} 👋</h1>
            {profile?.username && <p className="text-sm text-gray-500 truncate">@{profile.username}</p>}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/profile')} className="sm:ml-auto flex-shrink-0">
          <User size={14} aria-hidden="true" />
          View profile
        </Button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-center text-center gap-2">
        <p className="text-sm font-semibold text-gray-900">More of Memory Drop is on the way.</p>
        <p className="text-sm text-gray-500">Capsules, the feed, and messaging are coming in a later phase.</p>
      </div>
    </div>
  );
};
