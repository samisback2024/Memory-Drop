import React from 'react';
import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

// The real catch-all (see App.tsx) — RootRedirect stays for "/" itself
// (its own-purpose 302-style bounce to the right landing spot), but any
// other genuinely-unmatched URL now gets an honest "not found" page
// instead of silently redirecting into Feed/Login, which made a typo'd
// or dead link indistinguishable from a real navigation.
export const NotFoundPage: React.FC = () => {
  const { user } = useAuth();
  const homeHref = user ? '/feed' : '/login';
  const homeLabel = user ? 'Back to Feed' : 'Back to Login';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center bg-gray-50 dark:bg-gray-950 transition-colors">
      <div className="w-14 h-14 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm flex items-center justify-center">
        <Compass size={24} className="text-purple-400" aria-hidden="true" />
      </div>
      <div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Page not found</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-xs">
          The link you followed might be broken, or the page may have moved.
        </p>
      </div>
      <Link
        to={homeHref}
        className="mt-1 px-4 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-blue-500 hover:opacity-90 transition-opacity"
      >
        {homeLabel}
      </Link>
    </div>
  );
};
