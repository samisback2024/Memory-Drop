import React, { useCallback, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Rss, Clock, Plus, Archive, User, Sparkles, PackageOpen, X } from 'lucide-react';
import { DropComposer } from '../feed/DropComposer';
import { useDismissableMenu } from '../../hooks/useDismissableMenu';

const NAV_LINKS = [
  { to: '/feed', label: 'Feed', icon: Rss },
  { to: '/capsules', label: 'Capsules', icon: Clock },
];
const NAV_LINKS_RIGHT = [
  { to: '/memories', label: 'Memories', icon: Archive },
  { to: '/profile', label: 'Dashboard', icon: User },
];

// A fixed bottom bar shown only below the `sm` breakpoint — additive to
// the existing top Navbar (unchanged, still renders at every width),
// not a replacement. Feed/Capsules/Memories/Profile are the same
// primary destinations Navbar already links to; Create is new here —
// it opens a small action sheet rather than navigating directly, since
// "create" isn't a single destination (Drop/Moment/Capsule each have
// their own composer). Moment and Capsule creation reuse the existing
// /moments/create and /capsules/create routes; Drop creation has no
// dedicated route (DropComposer is normally opened from a button on
// FeedPage), so this mounts its own DropComposer instance and, on
// success, navigates to /feed — remounting FeedPage there refetches
// fresh data, so the new Drop shows up without any shared state needed
// between this component and FeedPage.
export const MobileNav: React.FC = () => {
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [dropComposerOpen, setDropComposerOpen] = useState(false);
  const closeSheet = useCallback(() => setCreateOpen(false), []);
  const sheetRef = useDismissableMenu<HTMLDivElement>(createOpen, closeSheet);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 py-1.5 text-[10px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none rounded-lg ${
      isActive ? 'text-purple-600' : 'text-gray-500 dark:text-gray-400'
    }`;

  return (
    <>
      {createOpen && (
        <div
          ref={sheetRef}
          role="menu"
          aria-label="Create"
          className="sm:hidden fixed bottom-[76px] left-3 right-3 z-50 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl overflow-hidden animate-slide-up"
        >
          <button
            role="menuitem"
            onClick={() => { setCreateOpen(false); setDropComposerOpen(true); }}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <Sparkles size={17} className="text-purple-500" aria-hidden="true" /> Create Drop
          </button>
          <button
            role="menuitem"
            onClick={() => { setCreateOpen(false); navigate('/moments/create'); }}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-t border-gray-50 dark:border-gray-800"
          >
            <PackageOpen size={17} className="text-purple-500" aria-hidden="true" /> Create Moment
          </button>
          <button
            role="menuitem"
            onClick={() => { setCreateOpen(false); navigate('/capsules/create'); }}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-t border-gray-50 dark:border-gray-800"
          >
            <Clock size={17} className="text-purple-500" aria-hidden="true" /> Create Capsule
          </button>
        </div>
      )}

      <nav
        aria-label="Primary"
        className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-t border-gray-100 dark:border-gray-800 overflow-x-hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-stretch max-w-2xl mx-auto px-1">
          {NAV_LINKS.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} aria-label={label} className={linkClass}>
              <Icon size={20} aria-hidden="true" />
              <span className="truncate w-full text-center">{label}</span>
            </NavLink>
          ))}

          <button
            type="button"
            onClick={() => setCreateOpen(p => !p)}
            aria-label="Create"
            aria-haspopup="menu"
            aria-expanded={createOpen}
            className="flex flex-col items-center justify-center flex-1 min-w-0 py-1.5"
          >
            <span className="w-9 h-9 rounded-full bg-gradient-to-r from-purple-600 to-blue-500 flex items-center justify-center shadow-md -mt-4 transition-transform">
              {createOpen ? <X size={18} className="text-white" aria-hidden="true" /> : <Plus size={18} className="text-white" aria-hidden="true" />}
            </span>
          </button>

          {NAV_LINKS_RIGHT.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} aria-label={label} className={linkClass}>
              <Icon size={20} aria-hidden="true" />
              <span className="truncate w-full text-center">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      <DropComposer
        isOpen={dropComposerOpen}
        onClose={() => setDropComposerOpen(false)}
        onDropped={() => { setDropComposerOpen(false); navigate('/feed'); }}
      />
    </>
  );
};
