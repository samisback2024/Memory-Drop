import React from 'react';
import { NavLink } from 'react-router-dom';
import { Rss, PlusCircle, Archive, MessageCircle, User } from 'lucide-react';

const TABS = [
  { to: '/feed', label: 'Feed', icon: Rss },
  { to: '/memories', label: 'Memories', icon: Archive },
  { to: '/create', label: 'Create', icon: PlusCircle },
  { to: '/messages', label: 'Messages', icon: MessageCircle },
  { to: '/profile', label: 'Profile', icon: User },
];

export const BottomTabBar: React.FC = () => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100 shadow-lg safe-area-inset-bottom">
      <div className="flex items-center justify-around px-2 py-2">
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors ${
                to === '/create'
                  ? isActive
                    ? 'text-white bg-gradient-to-br from-purple-600 to-blue-500'
                    : 'text-white bg-black'
                  : isActive
                  ? 'text-purple-700'
                  : 'text-gray-400 hover:text-gray-600'
              }`
            }
          >
            <Icon size={to === '/create' ? 22 : 20} />
            <span className="text-[10px] font-medium leading-none">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
