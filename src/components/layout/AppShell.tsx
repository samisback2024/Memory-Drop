import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
import { OfflineBanner } from './OfflineBanner';
import { MobileNav } from './MobileNav';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { useAuth } from '../../hooks/useAuth';
import { useSettings } from '../../hooks/useSettings';

export const AppShell: React.FC = () => {
  const { user } = useAuth();
  const { recordSession } = useSettings();
  const location = useLocation();

  // Once per browser tab per login, not on every route change within
  // the app — a plain per-navigation record would flood user_sessions.
  useEffect(() => {
    if (!user) return;
    const flagKey = `memorydrop_session_recorded_${user.id}`;
    if (sessionStorage.getItem(flagKey)) return;
    sessionStorage.setItem(flagKey, '1');
    recordSession();
  }, [user, recordSession]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col transition-colors">
      <Navbar />
      <OfflineBanner />
      {/* Keyed by pathname so the fade/slide-up replays on every route
          change — a lightweight page-transition without framer-motion
          (not installed) or a route-transition library. */}
      <main key={location.pathname} className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 pb-24 sm:pb-6 animate-page-enter">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>
      <MobileNav />
    </div>
  );
};
