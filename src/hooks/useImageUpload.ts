import { useState } from 'react';
import { validateImageFile } from '../lib/validators';

interface UseImageUploadOptions {
  maxBytes: number;
  onUpload: (file: File) => Promise<{ error: string | null }>;
}

// Shared file-select/drag-drop/crop/upload orchestration behind AvatarUpload
// and CoverPhotoUpload — those two differ in shape and layout (a small
// circular overlay vs. a full-width banner with hover controls) but go
// through the exact same pipeline: validate -> crop -> compress -> upload.
export const useImageUpload = ({ maxBytes, onUpload }: UseImageUploadOptions) => {
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const selectFile = (file: File) => {
    setError(null);
    const validationError = validateImageFile(file, maxBytes);
    if (validationError) {
      setError(validationError);
      return;
    }
    setPendingFile(file);
  };

  const cancelCrop = () => setPendingFile(null);

  const confirmCrop = async (croppedFile: File) => {
    setPendingFile(null);
    setUploading(true);
    setError(null);
    const { error: uploadError } = await onUpload(croppedFile);
    setUploading(false);
    if (uploadError) setError(uploadError);
  };

  const dragHandlers = {
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setDragActive(true); },
    onDragLeave: () => setDragActive(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files?.[0];
      if (file) selectFile(file);
    },
  };

  return { pendingFile, uploading, error, dragActive, selectFile, cancelCrop, confirmCrop, dragHandlers };
};
