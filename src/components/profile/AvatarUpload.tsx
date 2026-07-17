import React, { lazy, Suspense, useRef, useState } from 'react';
import { Camera, Loader2, Sparkles } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { AvatarPickerModal } from './AvatarPickerModal';
import { useImageUpload } from '../../hooks/useImageUpload';
import { MAX_AVATAR_BYTES } from '../../lib/validators';

interface AvatarUploadProps {
  src?: string | null;
  name: string;
  onUpload: (file: File) => Promise<{ error: string | null }>;
}

const AVATAR_OUTPUT_SIZE = 512;
// The crop UI (canvas drawing, drag/pinch handling) only matters once a
// user actually picks a photo — deferred out of every profile-editing
// page's first paint.
const ImageCropModal = lazy(() => import('./ImageCropModal').then(m => ({ default: m.ImageCropModal })));

export const AvatarUpload: React.FC<AvatarUploadProps> = ({ src, name, onUpload }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { pendingFile, uploading, error, dragActive, selectFile, cancelCrop, confirmCrop, dragHandlers } =
    useImageUpload({ maxBytes: MAX_AVATAR_BYTES, onUpload });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) selectFile(file);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={['relative rounded-2xl', dragActive ? 'ring-2 ring-purple-500 ring-offset-2' : ''].join(' ')}
        {...dragHandlers}
      >
        <Avatar src={src} name={name} size="2xl" shape="square" ring className="border-4 border-white shadow-md" />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-black flex items-center justify-center hover:bg-gray-800 transition-colors border-2 border-white disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none"
          aria-label="Change profile photo"
        >
          {uploading ? (
            <Loader2 size={14} className="text-white animate-spin" aria-hidden="true" />
          ) : (
            <Camera size={14} className="text-white" aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          disabled={uploading}
          className="absolute bottom-0 left-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center hover:opacity-90 transition-opacity border-2 border-white disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none"
          aria-label="Choose a generated avatar"
        >
          <Sparkles size={14} className="text-white" aria-hidden="true" />
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={handleFileChange}
          className="hidden"
          aria-label="Upload profile photo"
        />
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500">Drag a photo, tap the camera icon, or pick a generated avatar</p>
      {error && (
        <p className="text-xs text-red-500 dark:text-red-400">
          {error}{' '}
          <button type="button" onClick={() => inputRef.current?.click()} className="underline font-medium">
            Try again
          </button>
        </p>
      )}

      {pendingFile && (
        <Suspense fallback={null}>
          <ImageCropModal
            file={pendingFile}
            title="Adjust your photo"
            aspect={1}
            shape="rect"
            outputWidth={AVATAR_OUTPUT_SIZE}
            outputHeight={AVATAR_OUTPUT_SIZE}
            onCancel={cancelCrop}
            onConfirm={confirmCrop}
          />
        </Suspense>
      )}

      <AvatarPickerModal isOpen={pickerOpen} onClose={() => setPickerOpen(false)} onUpload={onUpload} />
    </div>
  );
};
