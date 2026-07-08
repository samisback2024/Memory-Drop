import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { AuthLayout } from '../components/auth/AuthLayout';
import { validatePassword } from '../lib/validators';

// Reached from the "reset password" email link. Supabase's client parses the
// recovery token out of the URL and establishes a temporary session before
// this component mounts, which is why `user` (from useAuth) is what tells us
// the link was valid rather than anything in the URL itself.
export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading, updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkExpiredGrace, setLinkExpiredGrace] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLinkExpiredGrace(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const passwordError = validatePassword(password);
    if (passwordError) return setError(passwordError);
    if (password !== confirmPassword) return setError('Passwords do not match.');

    setSubmitLoading(true);
    const { error: updateError } = await updatePassword(password);
    setSubmitLoading(false);

    if (updateError) {
      setError(updateError);
      return;
    }
    navigate('/feed');
  };

  if (loading || linkExpiredGrace) {
    return (
      <AuthLayout title="Reset password">
        <div className="flex justify-center py-6">
          <div className="w-6 h-6 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
        </div>
      </AuthLayout>
    );
  }

  if (!user) {
    return (
      <AuthLayout title="Link expired">
        <div className="text-center py-2">
          <p className="text-sm text-gray-600 mb-4">
            This password reset link is invalid or has expired. Request a new one to continue.
          </p>
          <Link to="/forgot-password">
            <Button variant="primary" size="md">Request new link</Button>
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Set a new password">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <Input
          label="New password"
          type={showPassword ? 'text' : 'password'}
          placeholder="At least 8 characters"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          autoComplete="new-password"
          leftIcon={<Lock size={16} />}
          rightElement={
            <button
              type="button"
              onClick={() => setShowPassword(p => !p)}
              className="text-gray-400 hover:text-gray-600 p-0.5"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          }
        />
        <Input
          label="Confirm new password"
          type={showPassword ? 'text' : 'password'}
          placeholder="Re-enter your new password"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          required
          autoComplete="new-password"
          leftIcon={<Lock size={16} />}
        />

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <Button type="submit" variant="primary" fullWidth loading={submitLoading} size="lg">
          Update password
        </Button>
      </form>
    </AuthLayout>
  );
};
