import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutGrid, User, Settings, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Avatar } from '../ui/Avatar';

const NAV_LINKS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutGrid },
  { to: '/profile', label: 'Profile', icon: User },
];

// Deliberately just two destinations — grows as later phases add Feed,
// Messages, etc. One responsive bar covers every breakpoint at this size,
// so there's no separate mobile bottom-tab component yet.
export const Navbar: React.FC = () => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const displayName = profile?.display_name || profile?.username || 'You';

  return (
    <header className="sticky top-0 z-40 h-16 bg-white border-b border-gray-100 shadow-sm">
      <div className="flex items-center justify-between h-full max-w-2xl mx-auto px-4">
        <NavLink to="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">M</span>
          </div>
          <span className="hidden sm:inline text-lg font-bold bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent">
            Memory Drop
          </span>
        </NavLink>

        <nav className="flex items-center gap-1">
          {NAV_LINKS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-purple-50 text-purple-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <Icon size={16} />
              <span className="hidden sm:inline">{label}</span>
            </NavLink>
          ))}

          <div className="relative ml-1" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(p => !p)}
              className="flex items-center gap-1.5 p-1.5 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <Avatar src={profile?.profile_photo_url} name={displayName} size="sm" />
              <ChevronDown size={14} className="text-gray-500 hidden sm:block" />
            </button>
            {dropdownOpen && (
              <div className="absolute right-0 top-12 w-52 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 overflow-hidden animate-fade-in">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="font-semibold text-gray-900 text-sm truncate">{displayName}</p>
                  {profile?.username && <p className="text-xs text-gray-500 truncate">@{profile.username}</p>}
                </div>
                <div className="py-1">
                  <button
                    onClick={() => { navigate('/profile'); setDropdownOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <User size={15} /> Profile
                  </button>
                  <button
                    onClick={() => { navigate('/profile/edit'); setDropdownOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Settings size={15} /> Edit profile
                  </button>
                  <div className="border-t border-gray-100 my-1" />
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={15} /> Sign out
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
