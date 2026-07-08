import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { AuthSpinner } from './AuthLayout';

// Wrap pages that require a signed-in user (item 12: auth-protected routes).
// Also enforces the sign-up rules that OAuth can't collect up front: a
// Google sign-in lands here with no username/date_of_birth yet, so it's
// bounced to /complete-profile before it can reach the real page.
export const AuthProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, needsProfileCompletion } = useAuth();
  const location = useLocation();

  if (loading) return <AuthSpinner />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (needsProfileCompletion && location.pathname !== '/complete-profile') {
    return <Navigate to="/complete-profile" replace />;
  }
  return <>{children}</>;
};

// Wrap pages that only make sense while signed out (item 13: redirect
// logged-in users away from /login, /register, /forgot-password).
export const PublicOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, needsProfileCompletion } = useAuth();

  if (loading) return <AuthSpinner />;
  if (user) {
    return <Navigate to={needsProfileCompletion ? '/complete-profile' : '/dashboard'} replace />;
  }
  return <>{children}</>;
};

// Used at "/" and as the catch-all so any unmatched URL resolves to the
// right place instead of a dead route (item 14: redirect logged-out users
// to login).
export const RootRedirect: React.FC = () => {
  const { user, loading, needsProfileCompletion } = useAuth();

  if (loading) return <AuthSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (needsProfileCompletion) return <Navigate to="/complete-profile" replace />;
  return <Navigate to="/dashboard" replace />;
};
