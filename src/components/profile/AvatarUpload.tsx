import React, { useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { Avatar } from '../ui/Avatar';

interface AvatarUploadProps {
  src?: string | null;
  name: string;
  onUpload: (file: File) => Promise<{ error: string | null }>;
}

export const AvatarUpload: React.FC<AvatarUploadProps> = ({ src, name, onUpload }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError(null);
    setUploading(true);
    const { error: uploadError } = await onUpload(file);
    setUploading(false);
    if (uploadError) setError(uploadError);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <Avatar src={src} name={name} size="2xl" ring className="border-4 border-white shadow-md" />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-black flex items-center justify-center hover:bg-gray-800 transition-colors border-2 border-white disabled:opacity-60"
          aria-label="Change profile photo"
        >
          {uploading ? (
            <Loader2 size={14} className="text-white animate-spin" />
          ) : (
            <Camera size={14} className="text-white" />
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
};
