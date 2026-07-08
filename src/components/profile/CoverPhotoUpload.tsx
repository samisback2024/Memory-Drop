import React, { useRef, useState } from 'react';
import { Camera, Trash2, Loader2 } from 'lucide-react';
import { ImageCropModal } from './ImageCropModal';
import { useImageUpload } from '../../hooks/useImageUpload';
import { MAX_COVER_BYTES } from '../../lib/validators';

interface CoverPhotoUploadProps {
  src?: string | null;
  onUpload: (file: File) => Promise<{ error: string | null }>;
  onRemove: () => Promise<{ error: string | null }>;
}

const COVER_ASPECT = 3;
const COVER_OUTPUT_WIDTH = 1500;
const COVER_OUTPUT_HEIGHT = 500;

// Controls are always visible (not hover-only) so this works identically
// with mouse, touch, and keyboard — a hover-reveal toolbar would be
// unreachable on phones and unfocusable for keyboard users.
export const CoverPhotoUpload: React.FC<CoverPhotoUploadProps> = ({ src, onUpload, onRemove }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const { pendingFile, uploading, error, dragActive, selectFile, cancelCrop, confirmCrop, dragHandlers } =
    useImageUpload({ maxBytes: MAX_COVER_BYTES, onUpload });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) selectFile(file);
  };

  const handleRemove = async () => {
    setRemoveError(null);
    setRemoving(true);
    const { error: err } = await onRemove();
    setRemoving(false);
    if (err) setRemoveError(err);
  };

  const busy = uploading || removing;

  return (
    <div className="flex flex-col gap-2">
      <div
        className={[
          'relative w-full h-32 sm:h-40 md:h-48 rounded-2xl overflow-hidden bg-gradient-to-r from-purple-600 to-blue-500',
          dragActive ? 'ring-2 ring-purple-500 ring-offset-2' : '',
        ].join(' ')}
        {...dragHandlers}
      >
        {src && <img src={src} alt="" className="w-full h-full object-cover" />}

        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <Loader2 size={22} className="text-white animate-spin" aria-hidden="true" />
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-2 p-3 bg-gradient-to-t from-black/40 to-transparent">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/90 text-gray-900 hover:bg-white transition-colors disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
          >
            <Camera size={13} aria-hidden="true" />
            {src ? 'Replace cover' : 'Upload cover'}
          </button>
          {src && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/90 text-red-600 hover:bg-white transition-colors disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
              aria-label="Remove cover photo"
            >
              <Trash2 size={13} aria-hidden="true" />
              Remove
            </button>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={handleFileChange}
          className="hidden"
          aria-label="Upload cover photo"
        />
      </div>
      {(error || removeError) && (
        <p className="text-xs text-red-500">
          {error ?? removeError}{' '}
          <button
            type="button"
            onClick={() => (error ? inputRef.current?.click() : handleRemove())}
            className="underline font-medium"
          >
            Try again
          </button>
        </p>
      )}

      {pendingFile && (
        <ImageCropModal
          file={pendingFile}
          title="Adjust your cover photo"
          aspect={COVER_ASPECT}
          shape="rect"
          outputWidth={COVER_OUTPUT_WIDTH}
          outputHeight={COVER_OUTPUT_HEIGHT}
          onCancel={cancelCrop}
          onConfirm={confirmCrop}
        />
      )}
    </div>
  );
};
