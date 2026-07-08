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
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export const validateDisplayName = (displayName: string): string | null => {
  if (!displayName.trim()) return 'Display name is required.';
  if (displayName.length > DISPLAY_NAME_MAX) return `Display name must be ${DISPLAY_NAME_MAX} characters or fewer.`;
  return null;
};

export const validateBio = (bio: string): string | null => {
  if (bio.length > BIO_MAX) return `Bio must be ${BIO_MAX} characters or fewer.`;
  return null;
};

export const validateAvatarFile = (file: File): string | null => {
  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) return 'Use a PNG, JPEG, WebP, or GIF image.';
  if (file.size > MAX_AVATAR_BYTES) return 'Image must be 5MB or smaller.';
  return null;
};
