import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image as ImageIcon, Video, X, CalendarClock, Globe2, Users, Lock } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useDrops } from '../../hooks/useDrops';
import { useSettings } from '../../hooks/useSettings';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { MoodPicker } from './MoodPicker';
import { VisibilityPicker } from './VisibilityPicker';
import { EmojiPicker } from './EmojiPicker';
import {
  validateCaption, validateImageFile, validateVideoFile,
  CAPTION_MAX, MAX_POST_IMAGES, MAX_POST_IMAGE_BYTES, MAX_POST_VIDEO_BYTES,
} from '../../lib/validators';
import { CAPTURE_PROMPTS, type Drop, type MemoryType, type Mood, type Visibility } from '../../types/feed';

interface DropComposerProps {
  isOpen: boolean;
  onClose: () => void;
  onDropped: (drop: Drop) => void;
}

interface PendingFile {
  file: File;
  previewUrl: string;
}

const DRAFT_KEY = 'memorydrop_drop_draft';

const nowForDatetimeLocal = (): string => {
  const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
};

// "Create Drop" — not "Create post." Every field here maps to a Memory
// Drop concept: what you want to remember, how you'll remember it, when
// it unlocks, who can see it, and how it felt. Leaving the unlock date at
// "now" is what makes this work as an ordinary share; pushing it into the
// future is what makes it a real time capsule.
export const DropComposer: React.FC<DropComposerProps> = ({ isOpen, onClose, onDropped }) => {
  const { profile } = useAuth();
  const { createDrop } = useDrops();
  const { getSettings } = useSettings();
  const [prompt] = useState(() => CAPTURE_PROMPTS[Math.floor(Math.random() * CAPTURE_PROMPTS.length)]);
  const [caption, setCaption] = useState('');
  const [images, setImages] = useState<PendingFile[]>([]);
  const [video, setVideo] = useState<PendingFile | null>(null);
  const [unlockDate, setUnlockDate] = useState(nowForDatetimeLocal);
  const [visibility, setVisibility] = useState<Visibility>('followers');
  const [mood, setMood] = useState<Mood | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dropping, setDropping] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft) setCaption(draft);
    // Settings' default only ever applies to a fresh, untouched composer
    // — never overrides a visibility the user already picked this session.
    getSettings().then(settings => { if (settings) setVisibility(settings.default_drop_visibility); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setUnlockDate(nowForDatetimeLocal());
    setVisibility('followers');
    setMood(null);
    setError(null);
    onClose();
  };

  const handleCancel = () => resetAndClose(true);

  const clearOtherMedia = (keep: 'images' | 'video') => {
    if (keep !== 'images') { images.forEach(img => URL.revokeObjectURL(img.previewUrl)); setImages([]); }
    if (keep !== 'video' && video) { URL.revokeObjectURL(video.previewUrl); setVideo(null); }
  };

  const handleImageSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    const remaining = MAX_POST_IMAGES - images.length;
    const selected = Array.from(files).slice(0, remaining);
    const next: PendingFile[] = [];
    let firstInvalidError: string | null = null;
    for (const file of selected) {
      const validationError = validateImageFile(file, MAX_POST_IMAGE_BYTES);
      if (validationError) { firstInvalidError ??= validationError; continue; }
      next.push({ file, previewUrl: URL.createObjectURL(file) });
    }
    if (firstInvalidError) {
      setError(firstInvalidError);
    } else if (files.length > remaining) {
      setError(`Only added ${remaining} more photo${remaining === 1 ? '' : 's'} — a drop can have up to ${MAX_POST_IMAGES}.`);
    }
    if (next.length > 0) {
      clearOtherMedia('images');
      setImages(prev => [...prev, ...next]);
    }
  };

  const handleVideoSelect = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    const validationError = validateVideoFile(file);
    if (validationError) { setError(validationError); return; }
    clearOtherMedia('video');
    setVideo({ file, previewUrl: URL.createObjectURL(file) });
  };

  const removeImage = (index: number) => {
    setImages(prev => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const memoryType: MemoryType = video ? 'video' : images.length > 0 ? 'photo' : 'text';
  const isFutureUnlock = useMemo(() => new Date(unlockDate).getTime() > Date.now() + 60000, [unlockDate]);

  const handleSubmit = async () => {
    const captionError = validateCaption(caption);
    if (captionError) { setError(captionError); return; }
    if (memoryType === 'text' && !caption.trim()) {
      setError('Write something to remember, or add a photo or video.');
      return;
    }

    setDropping(true);
    setError(null);
    const { error: dropError, drop } = await createDrop({
      caption,
      memoryType,
      images: images.map(img => img.file),
      video: video?.file ?? null,
      unlockDate: new Date(unlockDate).toISOString(),
      visibility,
      mood,
    });
    setDropping(false);

    if (dropError || !drop) {
      setError(dropError ?? 'Could not create your drop.');
      return;
    }
    onDropped(drop);
    resetAndClose(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleCancel} title="Create Drop" size="lg">
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-3">
          <Avatar src={profile?.profile_photo_url} name={profile?.display_name || profile?.username || 'You'} size="md" />
          <textarea
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder={prompt}
            maxLength={CAPTION_MAX}
            rows={4}
            aria-label="What do you want to remember?"
            className="flex-1 resize-none border-0 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-0 pt-1.5"
          />
        </div>

        {images.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {images.map((img, i) => (
              <div key={img.previewUrl} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                <img src={img.previewUrl} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => removeImage(i)} aria-label="Remove image" className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors">
                  <X size={13} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}

        {video && (
          <div className="relative rounded-xl overflow-hidden bg-black">
            <video src={video.previewUrl} controls className="w-full max-h-64" />
            <button type="button" onClick={() => clearOtherMedia('images')} aria-label="Remove video" className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors">
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        )}

        <div className="flex flex-col gap-1 border-t border-gray-100 pt-3">
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => imageInputRef.current?.click()} disabled={Boolean(video) || images.length >= MAX_POST_IMAGES} aria-label="Add photos" className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <ImageIcon size={19} aria-hidden="true" />
              <span className="text-xs font-medium">Photo</span>
            </button>
            <button type="button" onClick={() => videoInputRef.current?.click()} disabled={images.length > 0} aria-label="Add video" className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              <Video size={19} aria-hidden="true" />
              <span className="text-xs font-medium">Video</span>
            </button>
            <EmojiPicker onSelect={emoji => setCaption(c => c + emoji)} />
            <span className="ml-auto text-xs text-gray-400">{caption.length}/{CAPTION_MAX}</span>
            <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple className="hidden" onChange={e => { handleImageSelect(e.target.files); e.target.value = ''; }} />
            <input ref={videoInputRef} type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={e => { handleVideoSelect(e.target.files); e.target.value = ''; }} />
          </div>
          {images.length === 0 && !video && (
            <p className="text-[11px] text-gray-400 px-2.5">
              Up to {MAX_POST_IMAGES} photos (JPG, PNG, WebP, GIF · {MAX_POST_IMAGE_BYTES / (1024 * 1024)}MB each) or 1 video (MP4, WebM, MOV · {MAX_POST_VIDEO_BYTES / (1024 * 1024)}MB)
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="unlock-date" className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
            <CalendarClock size={15} className="text-gray-400" aria-hidden="true" />
            When should this unlock?
          </label>
          <input
            id="unlock-date"
            type="datetime-local"
            value={unlockDate}
            onChange={e => setUnlockDate(e.target.value)}
            className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-400">
            {isFutureUnlock ? "Sealed until then — nobody, not even you, can see it early." : 'Leave as-is to share right away.'}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium text-gray-700">Mood</p>
          <MoodPicker value={mood} onChange={setMood} />
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium text-gray-700">Who can see this?</p>
          <VisibilityPicker value={visibility} onChange={setVisibility} />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="gradient" fullWidth loading={dropping} onClick={handleSubmit}>
            {visibility === 'private' ? <Lock size={15} aria-hidden="true" /> : visibility === 'followers' ? <Users size={15} aria-hidden="true" /> : <Globe2 size={15} aria-hidden="true" />}
            Drop Memory
          </Button>
          <Button variant="outline" fullWidth onClick={handleCancel} disabled={dropping}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
};
