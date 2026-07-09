import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { useAuth } from '../../hooks/useAuth';
import { useSettings } from '../../hooks/useSettings';

export const AppShell: React.FC = () => {
  const { user } = useAuth();
  const { recordSession } = useSettings();

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
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
};
