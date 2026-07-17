import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AtSign, User, Check, X, Loader2, ArrowLeft, MapPin, Link2, Calendar, Smile, Lock } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useUsernameAvailability } from '../hooks/useUsernameAvailability';
import { AvatarUpload } from '../components/profile/AvatarUpload';
import { CoverPhotoUpload } from '../components/profile/CoverPhotoUpload';
import { Input, Textarea } from '../components/ui/Input';
import { Toggle } from '../components/ui/Toggle';
import { Button } from '../components/ui/Button';
import {
  validateUsername,
  validateDisplayName,
  validateBio,
  validateLocation,
  validateWebsite,
  validatePronouns,
  validateDateOfBirth,
  normalizeUsername,
  getUsernameCooldownDaysRemaining,
  DISPLAY_NAME_MAX,
  BIO_MAX,
  LOCATION_MAX,
  WEBSITE_MAX,
  PRONOUNS_MAX,
} from '../lib/validators';

const SectionCard: React.FC<{ title: string; description?: string; children: React.ReactNode }> = ({
  title, description, children,
}) => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
    <h2 className="text-base font-semibold text-gray-900">{title}</h2>
    {description && <p className="text-xs text-gray-500 mt-0.5 mb-4">{description}</p>}
    <div className={description ? 'flex flex-col gap-5' : 'flex flex-col gap-5 mt-4'}>{children}</div>
  </div>
);

export const EditProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { profile, updateProfile, uploadAvatar, uploadCoverPhoto, removeCoverPhoto } = useAuth();

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [pronouns, setPronouns] = useState(profile?.pronouns ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [location, setLocation] = useState(profile?.location ?? '');
  const [website, setWebsite] = useState(profile?.website ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(profile?.date_of_birth ?? '');
  const [isPrivate, setIsPrivate] = useState(profile?.is_private ?? false);

  // On a fresh page load straight to /profile/edit (not navigated to
  // from within the app), useAuth's profile fetch is still async when
  // this component first mounts — the useState initializers above run
  // before it resolves and capture an empty profile, then never
  // re-sync once it arrives, since a hook's initial value only runs
  // once. Left unfixed, every field here silently stays blank even
  // though the page clearly shows your real name/username elsewhere,
  // and hitting Save would wipe them. Runs exactly once, the first time
  // `profile` actually has data — not on every profile change, so it
  // doesn't clobber an in-progress edit if the profile object updates
  // for an unrelated reason later.
  const hydrated = useRef(false);
  useEffect(() => {
    if (!profile || hydrated.current) return;
    hydrated.current = true;
    setDisplayName(profile.display_name ?? '');
    setUsername(profile.username ?? '');
    setPronouns(profile.pronouns ?? '');
    setBio(profile.bio ?? '');
    setLocation(profile.location ?? '');
    setWebsite(profile.website ?? '');
    setDateOfBirth(profile.date_of_birth ?? '');
    setIsPrivate(profile.is_private ?? false);
  }, [profile]);

  const usernameStatus = useUsernameAvailability(username, profile?.username);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!profile) return null;

  const usernameCooldownDays = getUsernameCooldownDaysRemaining(profile.username_changed_at);
  const usernameLocked = usernameCooldownDays > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const errors: Record<string, string> = {};
    const displayNameError = validateDisplayName(displayName);
    const usernameError = validateUsername(normalizeUsername(username));
    const bioError = validateBio(bio);
    const locationError = validateLocation(location);
    const websiteError = validateWebsite(website);
    const pronounsError = validatePronouns(pronouns);
    const dobError = validateDateOfBirth(dateOfBirth);

    if (displayNameError) errors.displayName = displayNameError;
    if (usernameError) errors.username = usernameError;
    else if (usernameStatus === 'taken') errors.username = 'That username is already taken.';
    if (bioError) errors.bio = bioError;
    if (locationError) errors.location = locationError;
    if (websiteError) errors.website = websiteError;
    if (pronounsError) errors.pronouns = pronounsError;
    if (dobError) errors.dateOfBirth = dobError;

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    const { error: saveError } = await updateProfile({
      displayName, username, bio, location, website, pronouns, dateOfBirth, isPrivate,
    });
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
        <ArrowLeft size={15} aria-hidden="true" />
        Back to profile
      </Link>

      <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 -mb-1">Edit profile</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <SectionCard title="Photos">
          <CoverPhotoUpload src={profile.cover_photo_url} onUpload={uploadCoverPhoto} onRemove={removeCoverPhoto} />
          <AvatarUpload
            src={profile.profile_photo_url}
            name={profile.display_name || profile.username || 'You'}
            onUpload={uploadAvatar}
          />
        </SectionCard>

        <SectionCard title="Basic info">
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
              disabled={usernameLocked}
              leftIcon={<AtSign size={16} />}
              error={fieldErrors.username}
              hint={
                usernameLocked
                  ? undefined
                  : usernameStatus === 'available' ? undefined
                  : 'Lowercase letters, numbers, underscores, and periods only.'
              }
              rightElement={
                usernameStatus === 'checking' ? <Loader2 size={16} className="text-gray-400 animate-spin" /> :
                usernameStatus === 'available' ? <Check size={16} className="text-green-500" /> :
                usernameStatus === 'taken' ? <X size={16} className="text-red-500" /> :
                null
              }
            />
            {usernameLocked ? (
              <p className="mt-1.5 text-xs text-gray-400 pl-1 flex items-center gap-1">
                <Lock size={11} aria-hidden="true" />
                You can change your username again in {usernameCooldownDays} day{usernameCooldownDays === 1 ? '' : 's'}.
              </p>
            ) : usernameStatus === 'available' && !fieldErrors.username ? (
              <p className="mt-1.5 text-xs text-green-600 pl-1">@{normalizeUsername(username)} is available</p>
            ) : null}
          </div>

          <Input
            label="Pronouns"
            type="text"
            placeholder="she/her, he/him, they/them..."
            value={pronouns}
            onChange={e => setPronouns(e.target.value)}
            maxLength={PRONOUNS_MAX}
            leftIcon={<Smile size={16} />}
            error={fieldErrors.pronouns}
            hint="Optional"
          />
        </SectionCard>

        <SectionCard title="About">
          <div>
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
            {bio && (
              <div className="mt-2 rounded-xl bg-gray-50 border border-gray-100 p-3">
                <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400 mb-1">Preview</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{bio}</p>
              </div>
            )}
          </div>

          <Input
            label="Location"
            type="text"
            placeholder="Salt Lake City, Tokyo, London..."
            value={location}
            onChange={e => setLocation(e.target.value)}
            maxLength={LOCATION_MAX}
            leftIcon={<MapPin size={16} />}
            error={fieldErrors.location}
            hint="Optional — just a place name, not a map pin"
          />

          <Input
            label="Website"
            type="text"
            placeholder="yourwebsite.com"
            value={website}
            onChange={e => setWebsite(e.target.value)}
            maxLength={WEBSITE_MAX}
            leftIcon={<Link2 size={16} />}
            error={fieldErrors.website}
            hint="Optional — one link, shown as a clickable button on your profile"
          />
        </SectionCard>

        <SectionCard title="Birthday" description="Used only to confirm you're 13 or older — never shown on your profile.">
          <Input
            label="Date of birth"
            type="date"
            value={dateOfBirth}
            onChange={e => setDateOfBirth(e.target.value)}
            leftIcon={<Calendar size={16} />}
            error={fieldErrors.dateOfBirth}
          />
        </SectionCard>

        <SectionCard title="Privacy">
          <Toggle
            id="is-private"
            checked={isPrivate}
            onChange={setIsPrivate}
            label="Private account"
            description="Only you can see your bio, location, and website when your account is private."
          />
        </SectionCard>

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
  );
};
