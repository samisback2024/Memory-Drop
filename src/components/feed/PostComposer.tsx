import React, { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Video, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useFeed } from '../../hooks/useFeed';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { EmojiPicker } from './EmojiPicker';
import {
  validateCaption, validateImageFile, validateVideoFile,
  CAPTION_MAX, MAX_POST_IMAGES, MAX_POST_IMAGE_BYTES,
} from '../../lib/validators';
import type { FeedPost, PostType } from '../../types/feed';

interface PostComposerProps {
  isOpen: boolean;
  onClose: () => void;
  onPosted: (post: FeedPost) => void;
}

interface PendingImage {
  file: File;
  previewUrl: string;
}

const DRAFT_KEY = 'memorydrop_post_draft';

// Draft is caption-only, stored in localStorage — media can't survive a
// page reload as a File object, so "Draft (optional)" only covers the text
// half, which is the part worth not losing.
export const PostComposer: React.FC<PostComposerProps> = ({ isOpen, onClose, onPosted }) => {
  const { profile } = useAuth();
  const { createPost } = useFeed();
  const [caption, setCaption] = useState('');
  const [images, setImages] = useState<PendingImage[]>([]);
  const [video, setVideo] = useState<PendingImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft) setCaption(draft);
  }, [isOpen]);

  const releaseMedia = () => {
    images.forEach(img => URL.revokeObjectURL(img.previewUrl));
    if (video) URL.revokeObjectURL(video.previewUrl);
  };

  const resetAndClose = (keepDraft: boolean) => {
    if (keepDraft && caption.trim()) localStorage.setItem(DRAFT_KEY, caption);
    else localStorage.removeItem(DRAFT_KEY);
    releaseMedia();
    setCaption('');
    setImages([]);
    setVideo(null);
    setError(null);
    onClose();
  };

  const handleCancel = () => resetAndClose(true);

  const handleImageSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    const remaining = MAX_POST_IMAGES - images.length;
    const selected = Array.from(files).slice(0, remaining);
    const next: PendingImage[] = [];
    for (const file of selected) {
      const validationError = validateImageFile(file, MAX_POST_IMAGE_BYTES);
      if (validationError) { setError(validationError); continue; }
      next.push({ file, previewUrl: URL.createObjectURL(file) });
    }
    if (next.length > 0) {
      if (video) URL.revokeObjectURL(video.previewUrl);
      setVideo(null);
      setImages(prev => [...prev, ...next]);
    }
  };

  const handleVideoSelect = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    const validationError = validateVideoFile(file);
    if (validationError) { setError(validationError); return; }
    images.forEach(img => URL.revokeObjectURL(img.previewUrl));
    setImages([]);
    setVideo({ file, previewUrl: URL.createObjectURL(file) });
  };

  const removeImage = (index: number) => {
    setImages(prev => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const removeVideo = () => {
    if (video) URL.revokeObjectURL(video.previewUrl);
    setVideo(null);
  };

  const postType: PostType = video ? 'video' : images.length > 0 ? 'photo' : 'text';

  const handleSubmit = async () => {
    const captionError = validateCaption(caption);
    if (captionError) { setError(captionError); return; }
    if (postType === 'text' && !caption.trim()) {
      setError('Write something, or add a photo or video.');
      return;
    }

    setPosting(true);
    setError(null);
    const { error: postError, post } = await createPost({
      caption,
      postType,
      images: images.map(img => img.file),
      video: video?.file ?? null,
    });
    setPosting(false);

    if (postError || !post) {
      setError(postError ?? 'Could not create post.');
      return;
    }
    onPosted(post);
    resetAndClose(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleCancel} title="Create post" size="lg">
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <Avatar src={profile?.profile_photo_url} name={profile?.display_name || profile?.username || 'You'} size="md" />
          <textarea
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder="What's on your mind?"
            maxLength={CAPTION_MAX}
            rows={4}
            aria-label="Caption"
            className="flex-1 resize-none border-0 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-0 pt-1.5"
          />
        </div>

        {images.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {images.map((img, i) => (
              <div key={img.previewUrl} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                <img src={img.previewUrl} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  aria-label="Remove image"
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                >
                  <X size={13} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}

        {video && (
          <div className="relative rounded-xl overflow-hidden bg-black">
            <video src={video.previewUrl} controls className="w-full max-h-64" />
            <button
              type="button"
              onClick={removeVideo}
              aria-label="Remove video"
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-gray-100 pt-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={Boolean(video) || images.length >= MAX_POST_IMAGES}
              aria-label="Add photos"
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ImageIcon size={19} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              disabled={images.length > 0}
              aria-label="Add video"
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Video size={19} aria-hidden="true" />
            </button>
            <EmojiPicker onSelect={emoji => setCaption(c => c + emoji)} />
            <input
              ref={imageInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              multiple
              className="hidden"
              onChange={e => { handleImageSelect(e.target.files); e.target.value = ''; }}
            />
            <input
              ref={videoInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              className="hidden"
              onChange={e => { handleVideoSelect(e.target.files); e.target.value = ''; }}
            />
          </div>
          <span className="text-xs text-gray-400">{caption.length}/{CAPTION_MAX}</span>
        </div>

        <div className="flex gap-3">
          <Button variant="primary" fullWidth loading={posting} onClick={handleSubmit}>
            Post
          </Button>
          <Button variant="outline" fullWidth onClick={handleCancel} disabled={posting}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
};
