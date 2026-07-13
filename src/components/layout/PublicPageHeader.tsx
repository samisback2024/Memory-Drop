import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

interface PublicPageHeaderProps {
  title?: React.ReactNode;
}

// Shared by every page reachable while logged out (PublicProfilePage,
// FollowersPage, FollowingPage at /u/:username/...) — a back button, the
// logo (or a page title in its place), and a sign-in prompt for anon
// visitors.
export const PublicPageHeader: React.FC<PublicPageHeaderProps> = ({ title }) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
      <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 -ml-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors flex-shrink-0 focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none"
          aria-label="Go back"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </button>

        {title ? (
          <span className="font-semibold text-gray-900 truncate flex-1 text-center">{title}</span>
        ) : (
          <Link to="/" className="flex items-center gap-2">
            <img src="/icon-192.png" alt="Memory Drop" className="w-7 h-7 rounded-lg flex-shrink-0" />
            <span className="font-bold text-gray-900">Memory Drop</span>
          </Link>
        )}

        {!user ? (
          <Link to="/login" className="text-sm font-medium text-purple-600 hover:text-purple-700 flex-shrink-0">
            Sign in
          </Link>
        ) : (
          <span className="w-10 flex-shrink-0" aria-hidden="true" />
        )}
      </div>
    </header>
  );
};
