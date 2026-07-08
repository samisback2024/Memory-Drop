import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, AtSign, Calendar, Check, X, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Checkbox } from '../components/ui/Checkbox';
import { AuthLayout } from '../components/auth/AuthLayout';
import { GoogleButton } from '../components/auth/GoogleButton';
import {
  validateEmail,
  validatePassword,
  validateUsername,
  validateDateOfBirth,
  normalizeUsername,
  maxDateOfBirthForMinAge,
} from '../lib/validators';

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { signUp, signInWithGoogle, checkUsernameAvailable } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const checkSeq = useRef(0);

  useEffect(() => {
    const formatError = validateUsername(normalizeUsername(username));
    if (!username) {
      setUsernameStatus('idle');
      return;
    }
    if (formatError) {
      setUsernameStatus('invalid');
      return;
    }
    setUsernameStatus('checking');
    const seq = ++checkSeq.current;
    const timer = setTimeout(async () => {
      const available = await checkUsernameAvailable(username);
      if (checkSeq.current !== seq) return; // stale response, a newer keystroke superseded it
      setUsernameStatus(available ? 'available' : 'taken');
    }, 450);
    return () => clearTimeout(timer);
  }, [username, checkUsernameAvailable]);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    const displayNameError = !displayName.trim() ? 'Display name is required.' : null;
    const usernameError = validateUsername(normalizeUsername(username));
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    const dobError = validateDateOfBirth(dateOfBirth);

    if (displayNameError) errors.displayName = displayNameError;
    if (usernameError) errors.username = usernameError;
    else if (usernameStatus === 'taken') errors.username = 'That username is already taken.';
    if (emailError) errors.email = emailError;
    if (passwordError) errors.password = passwordError;
    if (dobError) errors.dateOfBirth = dobError;
    if (!acceptedTerms) errors.terms = 'You must accept the Terms and Privacy Policy to continue.';

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validate()) return;

    setLoading(true);
    const result = await signUp({
      email,
      password,
      username: normalizeUsername(username),
      displayName: displayName.trim(),
      dateOfBirth,
      acceptedTerms,
    });
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    navigate(result.needsEmailVerification ? '/verify-email' : '/dashboard');
  };

  const handleGoogle = async () => {
    setError(null);
    setGoogleLoading(true);
    const { error: googleError } = await signInWithGoogle();
    if (googleError) {
      setError(googleError);
      setGoogleLoading(false);
    }
  };

  const usernameHint =
    usernameStatus === 'checking' ? undefined :
    usernameStatus === 'available' ? undefined :
    'Lowercase letters, numbers, underscores, and periods only.';

  return (
    <AuthLayout title="Create your account" subtitle="Join Memory Drop in under a minute.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <Input
          label="Display name"
          type="text"
          placeholder="Alex Rivera"
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          required
          autoComplete="name"
          leftIcon={<User size={16} />}
          error={fieldErrors.displayName}
        />

        <Input
          label="Username"
          type="text"
          placeholder="alexrivera"
          value={username}
          onChange={e => setUsername(e.target.value.toLowerCase())}
          required
          autoComplete="username"
          leftIcon={<AtSign size={16} />}
          hint={usernameHint}
          error={fieldErrors.username}
          rightElement={
            usernameStatus === 'checking' ? <Loader2 size={16} className="text-gray-400 animate-spin" /> :
            usernameStatus === 'available' ? <Check size={16} className="text-green-500" /> :
            usernameStatus === 'taken' ? <X size={16} className="text-red-500" /> :
            null
          }
        />
        {usernameStatus === 'available' && !fieldErrors.username && (
          <p className="-mt-2.5 text-xs text-green-600 pl-1">@{normalizeUsername(username)} is available</p>
        )}

        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoComplete="email"
          leftIcon={<Mail size={16} />}
          error={fieldErrors.email}
        />

        <Input
          label="Password"
          type={showPassword ? 'text' : 'password'}
          placeholder="At least 8 characters"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          autoComplete="new-password"
          leftIcon={<Lock size={16} />}
          error={fieldErrors.password}
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
          label="Date of birth"
          type="date"
          value={dateOfBirth}
          onChange={e => setDateOfBirth(e.target.value)}
          required
          max={maxDateOfBirthForMinAge()}
          leftIcon={<Calendar size={16} />}
          hint="You must be 13 or older to join."
          error={fieldErrors.dateOfBirth}
        />

        <Checkbox
          checked={acceptedTerms}
          onChange={setAcceptedTerms}
          error={fieldErrors.terms}
          label={
            <>
              I agree to the{' '}
              <Link to="/terms" target="_blank" className="text-purple-600 hover:text-purple-700 font-medium">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link to="/privacy" target="_blank" className="text-purple-600 hover:text-purple-700 font-medium">
                Privacy Policy
              </Link>
              .
            </>
          }
        />

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <Button type="submit" variant="primary" fullWidth loading={loading} size="lg">
          Create Account
        </Button>
      </form>

      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400 font-medium">or continue with</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      <GoogleButton onClick={handleGoogle} loading={googleLoading} />

      <p className="text-center text-sm text-gray-500 mt-5">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-purple-600 hover:text-purple-700">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
};
