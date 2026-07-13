import React, { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Video, PenLine, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useMoments } from '../../hooks/useMoments';
import { useSettings } from '../../hooks/useSettings';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { EmojiPicker } from '../feed/EmojiPicker';
import { MomentDurationSelector } from './MomentDurationSelector';
import { MomentPrivacySelector } from './MomentPrivacySelector';
import { validateMomentText, validateImageFile, validateVideoFile, MAX_POST_IMAGE_BYTES } from '../../lib/validators';
import type { Moment, MomentDurationHours, MomentMediaType, MomentPrivacy } from '../../types/moment';

interface CreateMomentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (moment: Moment) => void;
}

interface PendingFile {
  file: File;
  previewUrl: string;
}

const TYPE_OPTIONS: { type: MomentMediaType; icon: typeof ImageIcon; label: string }[] = [
  { type: 'photo', icon: ImageIcon, label: 'Photo' },
  { type: 'video', icon: Video, label: 'Video' },
  { type: 'text', icon: PenLine, label: 'Text' },
];

// "Add Moment" — not "Add to story." A moment is a single photo, video,
// or written thought that lasts exactly as long as its chosen duration,
// nothing more: no filters, no stickers, no music, no swipe-up links.
export const CreateMomentModal: React.FC<CreateMomentModalProps> = ({ isOpen, onClose, onCreated }) => {
  const { profile } = useAuth();
  const { createMoment } = useMoments();
  const { getSettings } = useSettings();

  const [mediaType, setMediaType] = useState<MomentMediaType>('text');
  const [textContent, setTextContent] = useState('');
  const [media, setMedia] = useState<PendingFile | null>(null);
  const [durationHours, setDurationHours] = useState<MomentDurationHours>(24);
  const [privacy, setPrivacy] = useState<MomentPrivacy>('everyone');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Applies once per fresh open — never overrides a privacy the user
  // already picked this session.
  useEffect(() => {
    if (!isOpen) return;
    getSettings().then(settings => { if (settings) setPrivacy(settings.default_moment_visibility); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const reset = () => {
    if (media) URL.revokeObjectURL(media.previewUrl);
    setMediaType('text');
    setTextContent('');
    setMedia(null);
    setDurationHours(24);
    setPrivacy('everyone');
    setError(null);
  };

  const handleClose = () => { reset(); onClose(); };

  const pickType = (type: MomentMediaType) => {
    setError(null);
    if (media) { URL.revokeObjectURL(media.previewUrl); setMedia(null); }
    setMediaType(type);
    if (type !== 'text') fileInputRef.current?.click();
  };

  const handleFileSelect = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    const validationError = mediaType === 'photo' ? validateImageFile(file, MAX_POST_IMAGE_BYTES) : validateVideoFile(file);
    if (validationError) { setError(validationError); return; }
    setMedia({ file, previewUrl: URL.createObjectURL(file) });
  };

  const handleSubmit = async () => {
    const textError = validateMomentText(textContent, mediaType === 'text');
    if (textError) { setError(textError); return; }
    if (mediaType !== 'text' && !media) { setError('Add a photo or video first.'); return; }

    setCreating(true);
    setError(null);
    const { error: createError, moment } = await createMoment({
      mediaType,
      textContent,
      file: media?.file ?? null,
      mood: null,
      locationText: '',
      mentionedUserId: null,
      mentionedUsername: null,
      privacy,
      durationHours,
    });
    setCreating(false);

    if (createError || !moment) {
      setError(createError ?? 'Could not save your moment.');
      return;
    }
    onCreated(moment);
    reset();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Moment" size="lg">
      <div className="flex flex-col gap-5">
        <div className="flex gap-2">
          {TYPE_OPTIONS.map(({ type, icon: Icon, label }) => (
            <button
              key={type}
              type="button"
              onClick={() => pickType(type)}
              className={[
                'flex-1 flex flex-col items-center gap-1 py-3 rounded-xl border text-xs font-medium transition-colors',
                'focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none',
                mediaType === type ? 'bg-purple-50 dark:bg-purple-950/30 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300' : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600',
              ].join(' ')}
            >
              <Icon size={18} aria-hidden="true" />
              {label}
            </button>
          ))}
          <input
            ref={fileInputRef}
            type="file"
            accept={mediaType === 'video' ? 'video/mp4,video/webm,video/quicktime' : 'image/png,image/jpeg,image/webp,image/gif'}
            className="hidden"
            onChange={e => { handleFileSelect(e.target.files); e.target.value = ''; }}
          />
        </div>

        {media && mediaType === 'photo' && (
          <div className="relative rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800">
            <img src={media.previewUrl} alt="" className="w-full max-h-72 object-cover" />
            <button type="button" onClick={() => fileInputRef.current?.click()} aria-label="Remove photo" className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors">
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        )}
        {media && mediaType === 'video' && (
          <div className="relative rounded-xl overflow-hidden bg-black">
            <video src={media.previewUrl} controls className="w-full max-h-72" />
            <button type="button" onClick={() => fileInputRef.current?.click()} aria-label="Replace video" className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors">
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        )}

        <div className="flex items-start gap-3">
          <Avatar src={profile?.profile_photo_url} name={profile?.display_name || profile?.username || 'You'} size="md" />
          <div className="flex-1 flex flex-col gap-1">
            <textarea
              value={textContent}
              onChange={e => setTextContent(e.target.value)}
              placeholder={mediaType === 'text' ? 'What moment do you want to remember?' : 'Add a caption (optional)…'}
              maxLength={500}
              rows={3}
              aria-label="Moment text"
              className="w-full resize-none border-0 bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-0 pt-1.5"
            />
            <div className="flex items-center justify-end gap-1">
              <EmojiPicker onSelect={emoji => setTextContent(c => c + emoji)} />
              <span className="text-xs text-gray-400 dark:text-gray-500">{textContent.length}/500</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium text-gray-700">Save this moment for…</p>
          <MomentDurationSelector value={durationHours} onChange={setDurationHours} />
          <p className="text-xs text-gray-400 dark:text-gray-500">Moment expires in {durationHours}h — after that, only you can still see it, in your archive.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium text-gray-700">Who can see this moment?</p>
          <MomentPrivacySelector value={privacy} onChange={setPrivacy} />
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900 rounded-xl p-3">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="gradient" fullWidth loading={creating} onClick={handleSubmit}>
            Save this moment for {durationHours}h
          </Button>
          <Button variant="outline" fullWidth onClick={handleClose} disabled={creating}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
};
