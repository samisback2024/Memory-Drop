const USERNAME_PATTERN = /^[a-z0-9_.]{3,20}$/;

export const validateUsername = (username: string): string | null => {
  if (!username) return 'Username is required.';
  if (username.length < 3 || username.length > 20) return 'Username must be 3-20 characters.';
  if (!USERNAME_PATTERN.test(username)) {
    return 'Only lowercase letters, numbers, underscores, and periods are allowed.';
  }
  return null;
};

export const normalizeUsername = (username: string): string => username.trim().toLowerCase();

export const validateEmail = (email: string): string | null => {
  if (!email) return 'Email is required.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address.';
  return null;
};

export const validatePassword = (password: string): string | null => {
  if (!password) return 'Password is required.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  return null;
};

const MIN_AGE_YEARS = 13;

export const calculateAge = (dateOfBirth: string): number => {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
};

export const validateDateOfBirth = (dateOfBirth: string): string | null => {
  if (!dateOfBirth) return 'Date of birth is required.';
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return 'Enter a valid date.';
  if (dob > new Date()) return 'Date of birth cannot be in the future.';
  if (calculateAge(dateOfBirth) < MIN_AGE_YEARS) {
    return `You must be at least ${MIN_AGE_YEARS} years old to join Memory Drop.`;
  }
  return null;
};

export const maxDateOfBirthForMinAge = (): string => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - MIN_AGE_YEARS);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const DISPLAY_NAME_MAX = 50;
export const BIO_MAX = 150;
export const LOCATION_MAX = 60;
export const WEBSITE_MAX = 200;
export const PRONOUNS_MAX = 30;

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
export const MAX_COVER_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export const validateDisplayName = (displayName: string): string | null => {
  if (!displayName.trim()) return 'Display name is required.';
  if (displayName.length > DISPLAY_NAME_MAX) return `Display name must be ${DISPLAY_NAME_MAX} characters or fewer.`;
  return null;
};

export const validateBio = (bio: string): string | null => {
  if (bio.length > BIO_MAX) return `Bio must be ${BIO_MAX} characters or fewer.`;
  return null;
};

export const validateLocation = (location: string): string | null => {
  if (location.length > LOCATION_MAX) return `Location must be ${LOCATION_MAX} characters or fewer.`;
  return null;
};

export const validatePronouns = (pronouns: string): string | null => {
  if (pronouns.length > PRONOUNS_MAX) return `Pronouns must be ${PRONOUNS_MAX} characters or fewer.`;
  return null;
};

// Accepts "example.com" as well as "https://example.com" — normalizeWebsite
// is what actually prepends the protocol before it's stored, this just
// checks the result is a plausible http(s) URL.
export const validateWebsite = (website: string): string | null => {
  if (!website) return null;
  if (website.length > WEBSITE_MAX) return `Website must be ${WEBSITE_MAX} characters or fewer.`;
  const candidate = /^https?:\/\//i.test(website) ? website : `https://${website}`;
  try {
    const url = new URL(candidate);
    if (!url.hostname.includes('.')) return 'Enter a valid website URL.';
    return null;
  } catch {
    return 'Enter a valid website URL.';
  }
};

export const normalizeWebsite = (website: string): string | null => {
  const trimmed = website.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

// Strips the protocol and any trailing slash for compact display, e.g.
// "https://example.com/" -> "example.com".
export const displayWebsite = (website: string): string =>
  website.replace(/^https?:\/\//i, '').replace(/\/$/, '');

export const validateImageFile = (file: File, maxBytes: number): string | null => {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return 'Use a PNG, JPEG, WebP, or GIF image.';
  if (file.size > maxBytes) return `Image must be ${Math.round(maxBytes / (1024 * 1024))}MB or smaller.`;
  return null;
};

export const CAPTION_MAX = 2200;
export const MAX_POST_IMAGES = 10;
export const MAX_POST_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_POST_VIDEO_BYTES = 50 * 1024 * 1024;
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

export const validateCaption = (caption: string): string | null => {
  if (caption.length > CAPTION_MAX) return `Caption must be ${CAPTION_MAX} characters or fewer.`;
  return null;
};

export const validateVideoFile = (file: File): string | null => {
  if (!ALLOWED_VIDEO_TYPES.includes(file.type)) return 'Use an MP4, WebM, or MOV video.';
  if (file.size > MAX_POST_VIDEO_BYTES) return `Video must be ${Math.round(MAX_POST_VIDEO_BYTES / (1024 * 1024))}MB or smaller.`;
  return null;
};

export const MAX_POST_AUDIO_BYTES = 20 * 1024 * 1024;
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm'];

export const validateAudioFile = (file: File): string | null => {
  if (!ALLOWED_AUDIO_TYPES.includes(file.type)) return 'Use an MP3, M4A, WAV, or WebM audio file.';
  if (file.size > MAX_POST_AUDIO_BYTES) return `Audio must be ${Math.round(MAX_POST_AUDIO_BYTES / (1024 * 1024))}MB or smaller.`;
  return null;
};

const USERNAME_COOLDOWN_DAYS = 30;

// Mirrors enforce_username_cooldown() in supabase/phase2b_polish.sql — the
// DB trigger is the real enforcement, this is just what lets the UI warn
// the user before they waste a submit on it.
export const getUsernameCooldownDaysRemaining = (usernameChangedAt: string | null): number => {
  if (!usernameChangedAt) return 0;
  const changedAt = new Date(usernameChangedAt);
  const eligibleAt = new Date(changedAt);
  eligibleAt.setDate(eligibleAt.getDate() + USERNAME_COOLDOWN_DAYS);
  const msRemaining = eligibleAt.getTime() - Date.now();
  return msRemaining > 0 ? Math.ceil(msRemaining / (1000 * 60 * 60 * 24)) : 0;
};
