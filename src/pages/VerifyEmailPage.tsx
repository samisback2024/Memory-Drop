import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { AuthLayout, AuthSpinner } from '../components/auth/AuthLayout';

const RESEND_COOLDOWN_SECONDS = 30;

export const VerifyEmailPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading, emailVerified, resendVerificationEmail, refreshUser, signOut } = useAuth();
  const [cooldown, setCooldown] = useState(0);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendSent, setResendSent] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (!loading && emailVerified) navigate('/dashboard', { replace: true });
  }, [loading, emailVerified, navigate]);

  if (loading) return <AuthSpinner />;

  if (!user) {
    navigate('/login', { replace: true });
    return null;
  }

  const handleResend = async () => {
    setResendError(null);
    setResendSent(false);
    const { error } = await resendVerificationEmail();
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
    await signOut();
    navigate('/register');
  };

  return (
    <AuthLayout title="Verify your email">
      <div className="flex flex-col items-center text-center gap-3 py-2">
        <div className="w-14 h-14 rounded-2xl bg-purple-50 flex items-center justify-center">
          <MailCheck size={26} className="text-purple-600" />
        </div>
        <p className="text-sm text-gray-600">
          We sent a verification link to <span className="font-medium text-gray-900">{user.email}</span>. Click it,
          then come back here.
        </p>

        {resendError && <p className="text-sm text-red-500">{resendError}</p>}
        {resendSent && !resendError && <p className="text-sm text-green-600">Verification email resent.</p>}

        <Button variant="primary" fullWidth size="lg" onClick={handleCheckAgain} loading={checking}>
          I&apos;ve verified — continue
        </Button>
        <Button
          variant="outline"
          fullWidth
          size="md"
          onClick={handleResend}
          disabled={cooldown > 0}
        >
          {cooldown > 0 ? `Resend email (${cooldown}s)` : 'Resend verification email'}
        </Button>
        <button
          onClick={handleUseDifferentEmail}
          className="text-xs text-gray-400 hover:text-gray-600 mt-1"
        >
          Use a different email address
        </button>
      </div>
    </AuthLayout>
  );
};
