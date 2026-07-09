import React, { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Video, PenLine, X, MapPin, AtSign } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useSocial } from '../../hooks/useSocial';
import { useMoments } from '../../hooks/useMoments';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { MoodPicker } from '../feed/MoodPicker';
import { EmojiPicker } from '../feed/EmojiPicker';
import { MomentDurationSelector } from './MomentDurationSelector';
import { MomentPrivacySelector } from './MomentPrivacySelector';
import { validateMomentText, validateMomentLocation, validateImageFile, validateVideoFile, MAX_POST_IMAGE_BYTES } from '../../lib/validators';
import type { Mood } from '../../types/feed';
import type { SocialUserWithRelationship } from '../../types/social';
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
  const { searchUsers } = useSocial();
  const { createMoment } = useMoments();

  const [mediaType, setMediaType] = useState<MomentMediaType>('text');
  const [textContent, setTextContent] = useState('');
  const [media, setMedia] = useState<PendingFile | null>(null);
  const [mood, setMood] = useState<Mood | null>(null);
  const [locationText, setLocationText] = useState('');
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionResults, setMentionResults] = useState<SocialUserWithRelationship[]>([]);
  const [mentioned, setMentioned] = useState<{ id: string; username: string } | null>(null);
  const [durationHours, setDurationHours] = useState<MomentDurationHours>(24);
  const [privacy, setPrivacy] = useState<MomentPrivacy>('everyone');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mentioned || !mentionQuery.trim()) { setMentionResults([]); return; }
    let cancelled = false;
    const timer = setTimeout(() => {
      searchUsers(mentionQuery).then(results => { if (!cancelled) setMentionResults(results.slice(0, 6)); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [mentionQuery, mentioned, searchUsers]);

  const reset = () => {
    if (media) URL.revokeObjectURL(media.previewUrl);
    setMediaType('text');
    setTextContent('');
    setMedia(null);
    setMood(null);
    setLocationText('');
    setMentionQuery('');
    setMentionResults([]);
    setMentioned(null);
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
    const locationError = validateMomentLocation(locationText);
    if (locationError) { setError(locationError); return; }
    if (mediaType !== 'text' && !media) { setError('Add a photo or video first.'); return; }

    setCreating(true);
    setError(null);
    const { error: createError, moment } = await createMoment({
      mediaType,
      textContent,
      file: media?.file ?? null,
      mood,
      locationText,
      mentionedUserId: mentioned?.id ?? null,
      mentionedUsername: mentioned?.username ?? null,
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
                mediaType === type ? 'bg-purple-50 border-purple-300 text-purple-700' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300',
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
          <div className="relative rounded-xl overflow-hidden bg-gray-100">
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
              className="w-full resize-none border-0 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-0 pt-1.5"
            />
            <div className="flex items-center justify-end gap-1">
              <EmojiPicker onSelect={emoji => setTextContent(c => c + emoji)} />
              <span className="text-xs text-gray-400">{textContent.length}/500</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="moment-location" className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
            <MapPin size={15} className="text-gray-400" aria-hidden="true" />
            Location <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            id="moment-location"
            type="text"
            value={locationText}
            onChange={e => setLocationText(e.target.value)}
            maxLength={60}
            placeholder="Where was this?"
            className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        <div className="relative flex flex-col gap-1.5">
          <label htmlFor="moment-mention" className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
            <AtSign size={15} className="text-gray-400" aria-hidden="true" />
            Mention someone <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          {mentioned ? (
            <div className="flex items-center gap-2 border border-purple-200 bg-purple-50 rounded-xl px-3 py-2 text-sm text-purple-800">
              @{mentioned.username}
              <button type="button" onClick={() => setMentioned(null)} aria-label="Remove mention" className="ml-auto text-purple-500 hover:text-purple-700">
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <input
              id="moment-mention"
              type="text"
              value={mentionQuery}
              onChange={e => setMentionQuery(e.target.value)}
              placeholder="Search a username…"
              className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          )}
          {!mentioned && mentionResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-10 overflow-hidden">
              {mentionResults.map(u => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => { setMentioned({ id: u.id, username: u.username }); setMentionQuery(''); setMentionResults([]); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 transition-colors"
                >
                  <Avatar src={u.profile_photo_url} name={u.display_name || u.username} size="xs" />
                  <span className="text-sm text-gray-800">@{u.username}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium text-gray-700">Mood</p>
          <MoodPicker value={mood} onChange={setMood} />
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium text-gray-700">Save this moment for…</p>
          <MomentDurationSelector value={durationHours} onChange={setDurationHours} />
          <p className="text-xs text-gray-400">Moment expires in {durationHours}h — after that, only you can still see it, in your archive.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium text-gray-700">Who can see this moment?</p>
          <MomentPrivacySelector value={privacy} onChange={setPrivacy} />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-3">
            <p className="text-sm text-red-600">{error}</p>
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
