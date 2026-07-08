import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AtSign, User, Check, X, Loader2, ArrowLeft } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { AvatarUpload } from '../components/profile/AvatarUpload';
import { Input, Textarea } from '../components/ui/Input';
import { Toggle } from '../components/ui/Toggle';
import { Button } from '../components/ui/Button';
import {
  validateUsername,
  validateDisplayName,
  validateBio,
  normalizeUsername,
  DISPLAY_NAME_MAX,
  BIO_MAX,
} from '../lib/validators';

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

export const EditProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { profile, updateProfile, uploadAvatar, checkUsernameAvailable } = useAuth();

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [isPrivate, setIsPrivate] = useState(profile?.is_private ?? false);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const checkSeq = useRef(0);

  useEffect(() => {
    const normalized = normalizeUsername(username);
    if (normalized === profile?.username) {
      setUsernameStatus('idle');
      return;
    }
    const formatError = validateUsername(normalized);
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
  }, [username, profile?.username, checkUsernameAvailable]);

  if (!profile) return null;

  const handleAvatarUpload = async (file: File) => uploadAvatar(file);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const errors: Record<string, string> = {};
    const displayNameError = validateDisplayName(displayName);
    const usernameError = validateUsername(normalizeUsername(username));
    const bioError = validateBio(bio);

    if (displayNameError) errors.displayName = displayNameError;
    if (usernameError) errors.username = usernameError;
    else if (usernameStatus === 'taken') errors.username = 'That username is already taken.';
    if (bioError) errors.bio = bioError;

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    const { error: saveError } = await updateProfile({ displayName, username, bio, isPrivate });
    setLoading(false);

    if (saveError) {
      setError(saveError);
      return;
    }
    setSaved(true);
  };

  return (
    <div className="flex flex-col gap-4">
      <Link to="/profile" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 w-fit">
        <ArrowLeft size={15} />
        Back to profile
      </Link>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h1 className="text-lg font-bold text-gray-900 mb-5">Edit profile</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
          <AvatarUpload
            src={profile.profile_photo_url}
            name={profile.display_name || profile.username || 'You'}
            onUpload={handleAvatarUpload}
          />

          <Input
            label="Display name"
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            maxLength={DISPLAY_NAME_MAX}
            leftIcon={<User size={16} />}
            error={fieldErrors.displayName}
            hint={`${displayName.length}/${DISPLAY_NAME_MAX}`}
          />

          <div>
            <Input
              label="Username"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value.toLowerCase())}
              leftIcon={<AtSign size={16} />}
              error={fieldErrors.username}
              hint={usernameStatus === 'available' ? undefined : 'Lowercase letters, numbers, underscores, and periods only.'}
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

          <Textarea
            label="Bio"
            value={bio}
            onChange={e => setBio(e.target.value)}
            maxLength={BIO_MAX}
            rows={3}
            placeholder="Tell people a little about yourself..."
            error={fieldErrors.bio}
            hint={`${bio.length}/${BIO_MAX}`}
          />

          <Toggle
            id="is-private"
            checked={isPrivate}
            onChange={setIsPrivate}
            label="Private account"
            description="Only you can see your bio when your account is private."
          />

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
          {saved && !error && (
            <div className="bg-green-50 border border-green-100 rounded-xl p-3">
              <p className="text-sm text-green-600">Profile updated.</p>
            </div>
          )}

          <div className="flex gap-3">
            <Button type="submit" variant="primary" loading={loading} size="lg">
              Save changes
            </Button>
            <Button type="button" variant="outline" size="lg" onClick={() => navigate('/profile')}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
