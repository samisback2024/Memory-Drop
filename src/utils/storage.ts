import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

export const uploadFile = async (
  bucket: string,
  path: string,
  file: File,
): Promise<string | null> => {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) {
    logger.error('Upload error', { error: error.message, bucket });
    return null;
  }
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
};

export const deleteFile = async (bucket: string, path: string): Promise<void> => {
  await supabase.storage.from(bucket).remove([path]);
};

export const getPublicUrl = (bucket: string, path: string): string => {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
};

// Every bucket is public-read, gated only by path unguessability (see
// KNOWN_LIMITATIONS) — crypto.randomUUID() gives each file a 122-bit random
// component, vs. Math.random()'s ~31 bits, which was brute-forceable and,
// worse, not actually random enough to rely on for anything that looks like
// privacy (DM attachments in particular).
export const generateStoragePath = (userId: string, filename: string): string => {
  const ext = filename.split('.').pop() ?? 'bin';
  return `${userId}/${crypto.randomUUID()}.${ext}`;
};

// Public Supabase Storage URLs look like
// ".../storage/v1/object/public/{bucket}/{path}" — pulling the path back
// out of one lets us delete the previous avatar/cover file when a new one
// replaces it, instead of leaving orphaned uploads in the bucket forever.
export const extractStoragePath = (publicUrl: string, bucket: string): string | null => {
  const marker = `/object/public/${bucket}/`;
  const index = publicUrl.indexOf(marker);
  if (index === -1) return null;
  return publicUrl.slice(index + marker.length);
};
