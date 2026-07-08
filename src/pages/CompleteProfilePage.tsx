import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AtSign, User, Calendar, Check, X, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Checkbox } from '../components/ui/Checkbox';
import { AuthLayout } from '../components/auth/AuthLayout';
import { validateUsername, validateDateOfBirth, normalizeUsername, maxDateOfBirthForMinAge } from '../lib/validators';

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

// Google OAuth sign-ins skip the /register form entirely, so they arrive
// with an auth.users row (and a bare profiles row, via the DB trigger) but
// no username, date of birth, or terms acceptance on file. This page closes
// that gap — see needsProfileCompletion in useAuth and AuthProtectedRoute.
export const CompleteProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, completeProfile, checkUsernameAvailable, signOut } = useAuth();

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [username, setUsername] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
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
      if (checkSeq.current !== seq) return;
      setUsernameStatus(available ? 'available' : 'taken');
    }, 450);
    return () => clearTimeout(timer);
  }, [username, checkUsernameAvailable]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const errors: Record<string, string> = {};
    if (!displayName.trim()) errors.displayName = 'Display name is required.';
    const usernameError = validateUsername(normalizeUsername(username));
    if (usernameError) errors.username = usernameError;
    else if (usernameStatus === 'taken') errors.username = 'That username is already taken.';
    const dobError = validateDateOfBirth(dateOfBirth);
    if (dobError) errors.dateOfBirth = dobError;
    if (!acceptedTerms) errors.terms = 'You must accept the Terms and Privacy Policy to continue.';

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    const { error: completeError } = await completeProfile({
      username: normalizeUsername(username),
      displayName: displayName.trim(),
      dateOfBirth,
    });
    setLoading(false);

    if (completeError) {
      setError(completeError);
      return;
    }
    navigate('/dashboard');
  };

  return (
    <AuthLayout title="Almost there" subtitle={user?.email ? `Signed in as ${user.email}` : undefined}>
      <p className="text-sm text-gray-600 mb-4">
        Pick a username and confirm your details to finish setting up your account.
      </p>

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

        <div>
          <Input
            label="Username"
            type="text"
            placeholder="alexrivera"
            value={username}
            onChange={e => setUsername(e.target.value.toLowerCase())}
            required
            autoComplete="username"
            leftIcon={<AtSign size={16} />}
            hint={usernameStatus === 'available' ? undefined : 'Lowercase letters, numbers, underscores, and periods only.'}
            error={fieldErrors.username}
            rightElement={
              usernameStatus === 'checking' ? <Loader2 size={16} className="text-gray-400 animate-spin" /> :
              usernameStatus === 'available' ? <Check size={16} className="text-green-500" /> :
              usernameStatus === 'taken' ? <X size={16} className="text-red-500" /> :
              null
            }
          />
          {usernameStatus === 'available' && !fieldErrors.username && (
            <p className="mt-1.5 text-xs text-green-600 pl-1">@{normalizeUsername(username)} is available</p>
          )}
        </div>

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
          Finish setting up
        </Button>
      </form>

      <button
        onClick={() => signOut().then(() => navigate('/login'))}
        className="w-full text-center text-xs text-gray-400 hover:text-gray-600 mt-4"
      >
        Sign out and use a different account
      </button>
    </AuthLayout>
  );
};
