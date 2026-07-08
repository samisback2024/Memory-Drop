import { useEffect, useRef, useState } from 'react';
import { useAuth } from './useAuth';
import { validateUsername, normalizeUsername } from '../lib/validators';

export type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

const DEBOUNCE_MS = 450;

// Shared by RegisterPage, CompleteProfilePage, and EditProfilePage — all
// three need the same "debounce, then hit is_username_available" behavior.
// `currentUsername` lets EditProfilePage skip the check entirely when the
// field hasn't actually changed from what's already saved.
export const useUsernameAvailability = (username: string, currentUsername?: string | null): UsernameStatus => {
  const { checkUsernameAvailable } = useAuth();
  const [status, setStatus] = useState<UsernameStatus>('idle');
  const seqRef = useRef(0);

  useEffect(() => {
    const normalized = normalizeUsername(username);
    if (!username) {
      setStatus('idle');
      return;
    }
    if (currentUsername && normalized === currentUsername) {
      setStatus('idle');
      return;
    }
    const formatError = validateUsername(normalized);
    if (formatError) {
      setStatus('invalid');
      return;
    }
    setStatus('checking');
    const seq = ++seqRef.current;
    const timer = setTimeout(async () => {
      const available = await checkUsernameAvailable(username);
      if (seqRef.current !== seq) return; // stale response, a newer keystroke superseded it
      setStatus(available ? 'available' : 'taken');
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [username, currentUsername, checkUsernameAvailable]);

  return status;
};
