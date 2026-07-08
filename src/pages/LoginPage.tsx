import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { AuthLayout } from '../components/auth/AuthLayout';
import { GoogleButton } from '../components/auth/GoogleButton';
import { validateEmail } from '../lib/validators';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { signIn, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const emailError = validateEmail(email);
    if (emailError) return setError(emailError);
    if (!password) return setError('Password is required.');

    setLoading(true);
    const { error: signInError } = await signIn(email, password);
    setLoading(false);

    if (signInError) {
      setError(signInError);
      return;
    }
    navigate('/dashboard');
  };

  const handleGoogle = async () => {
    setError(null);
    setGoogleLoading(true);
    const { error: googleError } = await signInWithGoogle();
    if (googleError) {
      setError(googleError);
      setGoogleLoading(false);
    }
    // On success the browser is redirected away to Google, so no further
    // state update is needed here.
  };

  return (
    <AuthLayout
      title="Memory Drop"
      subtitle="Capture today. Unlock tomorrow."
      footer={
        <>
          By continuing, you agree to our{' '}
          <Link to="/terms" className="underline hover:text-white">Terms of Service</Link>{' '}
          and{' '}
          <Link to="/privacy" className="underline hover:text-white">Privacy Policy</Link>.
        </>
      }
    >
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Sign in</h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoComplete="email"
          leftIcon={<Mail size={16} />}
        />
        <div>
          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter your password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
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
          <div className="flex justify-end mt-1.5">
            <Link to="/forgot-password" className="text-xs font-medium text-purple-600 hover:text-purple-700">
              Forgot password?
            </Link>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <Button type="submit" variant="primary" fullWidth loading={loading} size="lg">
          Sign In
        </Button>
      </form>

      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400 font-medium">or continue with</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      <GoogleButton onClick={handleGoogle} loading={googleLoading} />

      <p className="text-center text-sm text-gray-500 mt-5">
        Don&apos;t have an account?{' '}
        <Link to="/register" className="font-medium text-purple-600 hover:text-purple-700">
          Sign up
        </Link>
      </p>
    </AuthLayout>
  );
};
