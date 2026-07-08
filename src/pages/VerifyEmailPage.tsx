import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { AuthLayout, AuthSpinner } from '../components/auth/AuthLayout';

const RESEND_COOLDOWN_SECONDS = 30;

// Right after registration, Supabase's signUp() returns no session when
// email confirmation is required — so `user` from useAuth is still null
// here, and the only way we know who to show/resend to is the email the
// register form handed off via router state. That's also why this can't
// just redirect to /login when `user` is missing: that IS the expected
// state for most visitors to this page, not an error.
export const VerifyEmailPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, emailVerified, resendVerificationEmail, refreshUser, signOut } = useAuth();
  const [cooldown, setCooldown] = useState(0);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendSent, setResendSent] = useState(false);
  const [checking, setChecking] = useState(false);

  const stateEmail = (location.state as { email?: string } | null)?.email;
  const email = user?.email ?? stateEmail ?? null;

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (!loading && emailVerified) navigate('/feed', { replace: true });
  }, [loading, emailVerified, navigate]);

  if (loading) return <AuthSpinner />;

  const handleResend = async () => {
    setResendError(null);
    setResendSent(false);
    const { error } = await resendVerificationEmail(email ?? undefined);
    if (error) {
      setResendError(error);
    } else {
      setResendSent(true);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    }
  };

  const handleCheckAgain = async () => {
    setChecking(true);
    await refreshUser();
    setChecking(false);
  };

  const handleUseDifferentEmail = async () => {
    if (user) await signOut();
    navigate('/register');
  };

  return (
    <AuthLayout title="Verify your email">
      <div className="flex flex-col items-center text-center gap-3 py-2">
        <div className="w-14 h-14 rounded-2xl bg-purple-50 flex items-center justify-center">
          <MailCheck size={26} className="text-purple-600" />
        </div>

        {email ? (
          <p className="text-sm text-gray-600">
            We sent a verification link to <span className="font-medium text-gray-900">{email}</span>. Click it,
            then come back here.
          </p>
        ) : (
          <p className="text-sm text-gray-600">
            We sent you a verification link. Click it to activate your account, then sign in.
          </p>
        )}

        {resendError && <p className="text-sm text-red-500">{resendError}</p>}
        {resendSent && !resendError && <p className="text-sm text-green-600">Verification email resent.</p>}

        {user ? (
          <Button variant="primary" fullWidth size="lg" onClick={handleCheckAgain} loading={checking}>
            I&apos;ve verified — continue
          </Button>
        ) : (
          <Link to="/login" className="w-full">
            <Button variant="primary" fullWidth size="lg">
              Go to sign in
            </Button>
          </Link>
        )}

        {email && (
          <Button variant="outline" fullWidth size="md" onClick={handleResend} disabled={cooldown > 0}>
            {cooldown > 0 ? `Resend email (${cooldown}s)` : 'Resend verification email'}
          </Button>
        )}

        <button onClick={handleUseDifferentEmail} className="text-xs text-gray-400 hover:text-gray-600 mt-1">
          Use a different email address
        </button>
      </div>
    </AuthLayout>
  );
};
