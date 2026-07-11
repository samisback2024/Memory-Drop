import React, { useState, useCallback, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Rss, Clock, BookHeart, Search, Compass, Users, User, LayoutGrid, Bookmark, Sparkles, Settings, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useSocial } from '../../hooks/useSocial';
import { useDismissableMenu } from '../../hooks/useDismissableMenu';
import { Avatar } from '../ui/Avatar';
import { NotificationBell } from '../notifications/NotificationBell';
import { MessagesNavButton } from '../messages/MessagesNavButton';

// Feed is the primary destination now (Phase 4) — Dashboard moved into the
// account dropdown below rather than crowding the top bar. Time Capsules
// (Phase 6) and Memories (Phase 7) both get primary slots too, not just
// the dropdown — the signature feature and the emotional-heart archive
// it feeds into, not secondary utility pages.
const NAV_LINKS = [
  { to: '/feed', label: 'Feed', icon: Rss },
  { to: '/capsules', label: 'Capsules', icon: Clock },
  { to: '/memories', label: 'Memories', icon: BookHeart },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/explore', label: 'Explore', icon: Compass },
  { to: '/friends', label: 'Friends', icon: Users },
  { to: '/profile', label: 'Profile', icon: User },
];

export const Navbar: React.FC = () => {
  const { profile, signOut } = useAuth();
  const { getPendingRequestsReceived } = useSocial();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const closeDropdown = useCallback(() => setDropdownOpen(false), []);
  const dropdownRef = useDismissableMenu<HTMLDivElement>(dropdownOpen, closeDropdown);

  useEffect(() => {
    getPendingRequestsReceived().then(rows => setPendingCount(rows.length));
  }, [getPendingRequestsReceived]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const displayName = profile?.display_name || profile?.username || 'You';

  return (
    <header className="sticky top-0 z-40 h-16 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 shadow-sm transition-colors">
      <div className="flex items-center justify-between h-full max-w-2xl mx-auto px-4">
        <NavLink to="/feed" className="flex items-center gap-2">
          <img src="/icon-192.png" alt="Memory Drop" className="w-8 h-8 rounded-xl flex-shrink-0" />
          <span className="hidden sm:inline text-lg font-bold bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent">
            Memory Drop
          </span>
        </NavLink>

        <nav className="flex items-center gap-1">
          {/* Below `sm`, MobileNav's bottom bar owns primary navigation
              (Feed/Capsules/Memories/Profile) — showing the same
              destinations again as icons up here too would be a
              redundant, cluttered second nav row. Search/Explore/
              Friends/Settings remain reachable from the account menu,
              which stays visible at every width. */}
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

          <MessagesNavButton />
          <NotificationBell />

          <div className="relative ml-1" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(p => !p)}
              aria-label="Account menu"
              aria-haspopup="menu"
              aria-expanded={dropdownOpen}
              className="flex items-center gap-1.5 p-1.5 rounded-xl hover:bg-gray-100 transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none"
            >
              <Avatar src={profile?.profile_photo_url} name={displayName} size="sm" />
              <ChevronDown size={14} className="text-gray-500 hidden sm:block" aria-hidden="true" />
            </button>
            {dropdownOpen && (
              <div role="menu" className="absolute right-0 top-12 w-52 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 overflow-hidden animate-fade-in">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="font-semibold text-gray-900 text-sm truncate">{displayName}</p>
                  {profile?.username && <p className="text-xs text-gray-500 truncate">@{profile.username}</p>}
                </div>
                <div className="py-1 sm:hidden">
                  {/* Only these three are otherwise unreachable on mobile
                      now that MobileNav's bottom bar replaces the icon
                      row above — Feed/Capsules/Memories/Profile already
                      have a dedicated bottom-bar slot each. */}
                  <button
                    role="menuitem"
                    onClick={() => { navigate('/search'); setDropdownOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Search size={15} aria-hidden="true" /> Search
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => { navigate('/explore'); setDropdownOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Compass size={15} aria-hidden="true" /> Explore
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => { navigate('/friends'); setDropdownOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Users size={15} aria-hidden="true" />
                    Friends
                    {pendingCount > 0 && (
                      <span className="ml-auto w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-semibold flex items-center justify-center leading-none">
                        {pendingCount > 9 ? '9+' : pendingCount}
                      </span>
                    )}
                  </button>
                  <div className="border-t border-gray-100" />
                </div>
                <div className="py-1">
                  <button
                    role="menuitem"
                    onClick={() => { navigate('/dashboard'); setDropdownOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <LayoutGrid size={15} aria-hidden="true" /> Dashboard
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => { navigate('/profile'); setDropdownOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <User size={15} aria-hidden="true" /> Profile
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => { navigate('/profile/edit'); setDropdownOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Settings size={15} aria-hidden="true" /> Edit profile
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => { navigate('/saved'); setDropdownOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Bookmark size={15} aria-hidden="true" /> Saved memories
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => { navigate('/moments'); setDropdownOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Sparkles size={15} aria-hidden="true" /> Your moments
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => { navigate('/settings'); setDropdownOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Settings size={15} aria-hidden="true" /> Settings
                  </button>
                  <div className="border-t border-gray-100 my-1" />
                  <button
                    role="menuitem"
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={15} aria-hidden="true" /> Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
};
