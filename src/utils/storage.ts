import { supabase } from '../lib/supabase';

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
    console.error('Upload error:', error);
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

export const generateStoragePath = (userId: string, filename: string): string => {
  const ext = filename.split('.').pop() ?? 'bin';
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `${userId}/${timestamp}-${random}.${ext}`;
};
