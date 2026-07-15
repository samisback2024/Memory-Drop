import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
import { OfflineBanner } from './OfflineBanner';
import { MobileNav } from './MobileNav';
import { AccountSidebar } from './AccountSidebar';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { useAuth } from '../../hooks/useAuth';
import { useSettings } from '../../hooks/useSettings';

export const AppShell: React.FC = () => {
  const { user } = useAuth();
  const { recordSession } = useSettings();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Once per browser tab per login, not on every route change within
  // the app — a plain per-navigation record would flood user_sessions.
  useEffect(() => {
    if (!user) return;
    const flagKey = `memorydrop_session_recorded_${user.id}`;
    if (sessionStorage.getItem(flagKey)) return;
    sessionStorage.setItem(flagKey, '1');
    recordSession();
  }, [user, recordSession]);

  // Route changes (tapping a link inside the drawer) should close it —
  // without this the drawer would stay open over the new page.
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col transition-colors">
      <Navbar onOpenMenu={() => setMenuOpen(true)} />
      <OfflineBanner />
      <div className="flex-1 flex max-w-5xl w-full mx-auto">
        {/* Persistent below lg: — replaces the avatar dropdown menu
            entirely at that width, so the account items are always one
            tap away instead of two. Sticky, not fixed: scrolls with the
            page shell but stays put within the viewport as you scroll
            the (independently scrolling) main content beside it. */}
        <AccountSidebar
          className="hidden lg:flex w-60 flex-shrink-0 border-r border-gray-100 dark:border-gray-800 sticky top-16 h-[calc(100vh-4rem)]"
        />

        {/* Keyed by pathname so the fade/slide-up replays on every route
            change — a lightweight page-transition without framer-motion
            (not installed) or a route-transition library. */}
        <main key={location.pathname} className="flex-1 min-w-0 max-w-2xl w-full mx-auto px-4 py-6 pb-24 sm:pb-6 animate-page-enter">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
      <MobileNav />

      {menuOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 lg:hidden animate-fade-in"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <AccountSidebar
            showPrimaryLinks
            onNavigate={() => setMenuOpen(false)}
            onClose={() => setMenuOpen(false)}
            className="fixed inset-y-0 left-0 z-50 w-72 max-w-[80vw] shadow-2xl lg:hidden animate-slide-in-left"
          />
        </>
      )}
    </div>
  );
};
