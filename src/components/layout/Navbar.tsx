import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Rss, Clock, Archive, Search, Compass, Users, User, Menu } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useSocial } from '../../hooks/useSocial';
import { Avatar } from '../ui/Avatar';
import { NotificationBell } from '../notifications/NotificationBell';
import { MessagesNavButton } from '../messages/MessagesNavButton';

// Feed is the primary destination now (Phase 4) — Dashboard moved into the
// account sidebar rather than crowding the top bar. Time Capsules
// (Phase 6) and Memories (Phase 7) both get primary slots too, not just
// the sidebar — the signature feature and the emotional-heart archive
// it feeds into, not secondary utility pages.
const NAV_LINKS = [
  { to: '/feed', label: 'Feed', icon: Rss },
  { to: '/capsules', label: 'Capsules', icon: Clock },
  { to: '/memories', label: 'Memories', icon: Archive },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/explore', label: 'Explore', icon: Compass },
  { to: '/friends', label: 'Friends', icon: Users },
  { to: '/profile', label: 'Dashboard', icon: User },
];

interface NavbarProps {
  onOpenMenu?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenMenu }) => {
  const { profile } = useAuth();
  const { getOrbitRequestsReceived } = useSocial();
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    getOrbitRequestsReceived().then(rows => setPendingCount(rows.length));
  }, [getOrbitRequestsReceived]);

  const displayName = profile?.display_name || profile?.username || 'You';

  return (
    <header className="sticky top-0 z-40 h-16 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 shadow-sm transition-colors">
      <div className="flex items-center justify-between h-full max-w-5xl mx-auto px-4">
        <div className="flex items-center gap-2">
          {/* Opens the AccountSidebar drawer below lg: — that width no
              longer has the persistent sidebar AppShell renders beside
              the content, so this is the only way to reach Dashboard/
              Edit profile/Saved/Moments/Settings/Sign out there. */}
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Open menu"
            className="lg:hidden p-2 -ml-2 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none"
          >
            <Menu size={20} aria-hidden="true" />
          </button>
          <NavLink to="/feed" className="flex items-center gap-2">
            <img src="/icon-192.png" alt="Memory Drop" className="w-8 h-8 rounded-xl flex-shrink-0" />
            <span className="hidden sm:inline text-lg font-bold bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent">
              Memory Drop
            </span>
          </NavLink>
        </div>

        <nav className="flex items-center gap-1">
          {/* Below `sm`, MobileNav's bottom bar owns primary navigation
              (Feed/Capsules/Memories/Profile) — showing the same
              destinations again as icons up here too would be a
              redundant, cluttered second nav row. Search/Explore/
              Friends remain reachable from the menu button above at
              that width. */}
          <div className="hidden sm:flex items-center gap-1">
            {NAV_LINKS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                aria-label={label}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none ${
                    isActive
                      ? 'bg-purple-50 text-purple-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`
                }
              >
                <span className="relative">
                  <Icon size={16} aria-hidden="true" />
                  {to === '/friends' && pendingCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[9px] font-semibold flex items-center justify-center leading-none">
                      {pendingCount > 9 ? '9+' : pendingCount}
                    </span>
                  )}
                </span>
                <span className="hidden sm:inline">{label}</span>
              </NavLink>
            ))}
          </div>

          {/* Icon-only, mobile-only — on desktop, Search is already a
              full labeled link in the NAV_LINKS row above. */}
          <button
            type="button"
            onClick={() => navigate('/search')}
            aria-label="Search"
            className="sm:hidden p-2 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none"
          >
            <Search size={18} aria-hidden="true" />
          </button>

          <MessagesNavButton />
          <NotificationBell />

          {/* Avatar is a direct link to Dashboard now — the account
              dropdown it used to open is gone, replaced by the
              persistent/drawer AccountSidebar. */}
          <button
            type="button"
            onClick={() => navigate('/profile')}
            aria-label="Go to Dashboard"
            className="ml-1 p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none"
          >
            <Avatar src={profile?.profile_photo_url} name={displayName} size="sm" />
          </button>
        </nav>
      </div>
    </header>
  );
};
