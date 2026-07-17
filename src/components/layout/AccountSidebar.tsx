import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Edit3, Bookmark, PackageOpen, Settings, LogOut, Compass, Users, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useSocial } from '../../hooks/useSocial';
import { Avatar } from '../ui/Avatar';

const ACCOUNT_LINKS = [
  { to: '/profile/edit', label: 'Edit profile', icon: Edit3 },
  { to: '/saved', label: 'Saved memories', icon: Bookmark },
  { to: '/moments', label: 'Your moments', icon: PackageOpen },
  { to: '/settings', label: 'Settings', icon: Settings },
];

interface AccountSidebarProps {
  // The persistent desktop rail only needs the account links — Explore/
  // Friends already have their own permanent spot in Navbar's top row at
  // that width. The mobile drawer replaces that top row entirely, so it
  // also carries Explore/Friends (with the same pending-request badge
  // the dropdown menu it replaces used to show) to avoid losing them.
  showPrimaryLinks?: boolean;
  onNavigate?: () => void;
  onClose?: () => void;
  className?: string;
}

const linkClasses = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none ${
    isActive
      ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300'
      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
  }`;

// One shared sidebar, two homes: a persistent column beside the content
// on wider screens (AppShell renders it directly), and the same list
// inside a slide-in drawer below that width (opened from Navbar's menu
// button) — replacing what used to be a small dropdown off the avatar.
export const AccountSidebar: React.FC<AccountSidebarProps> = ({ showPrimaryLinks = false, onNavigate, onClose, className = '' }) => {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { getOrbitRequestsReceived } = useSocial();
  const [pendingCount, setPendingCount] = useState(0);
  const displayName = profile?.display_name || profile?.username || 'You';

  useEffect(() => {
    if (!showPrimaryLinks) return;
    getOrbitRequestsReceived().then(rows => setPendingCount(rows.length));
  }, [showPrimaryLinks, getOrbitRequestsReceived]);

  const handleSignOut = async () => {
    await signOut();
    onNavigate?.();
    navigate('/login');
  };

  return (
    <div className={`flex flex-col bg-white dark:bg-gray-900 ${className}`}>
      <div className="flex items-center gap-3 px-3.5 py-4">
        {/* The header itself is the way to your Profile now — no separate
            "Dashboard" list item duplicating it below. */}
        <NavLink to="/profile" end onClick={onNavigate} className="flex items-center gap-3 min-w-0 flex-1 rounded-xl focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none">
          <Avatar src={profile?.profile_photo_url} name={displayName} size="md" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">{displayName}</p>
            {profile?.username && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">@{profile.username}</p>}
          </div>
        </NavLink>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close menu" className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 flex-shrink-0">
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>

      <nav className="flex flex-col gap-0.5 px-2 flex-1 overflow-y-auto">
        {showPrimaryLinks && (
          <>
            <NavLink to="/explore" className={linkClasses} onClick={onNavigate}>
              <Compass size={17} aria-hidden="true" /> Explore
            </NavLink>
            <NavLink to="/friends" className={linkClasses} onClick={onNavigate}>
              <Users size={17} aria-hidden="true" />
              Friends
              {pendingCount > 0 && (
                <span className="ml-auto w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-semibold flex items-center justify-center leading-none">
                  {pendingCount > 9 ? '9+' : pendingCount}
                </span>
              )}
            </NavLink>
            <div className="my-1.5 border-t border-gray-100 dark:border-gray-800" />
          </>
        )}

        {ACCOUNT_LINKS.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={linkClasses} onClick={onNavigate}>
            <Icon size={17} aria-hidden="true" /> {label}
          </NavLink>
        ))}

        <div className="my-1.5 border-t border-gray-100 dark:border-gray-800" />
        <button
          type="button"
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none"
        >
          <LogOut size={17} aria-hidden="true" /> Sign out
        </button>
      </nav>
    </div>
  );
};
