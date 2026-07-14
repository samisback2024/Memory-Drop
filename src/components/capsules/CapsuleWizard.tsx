import React, { useMemo, useRef, useState } from 'react';
import {
  Image as ImageIcon, Video, Lock, Globe2, Users,
  ChevronLeft, ChevronRight, X, CalendarClock,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useCapsules } from '../../hooks/useCapsules';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { MoodPicker } from '../feed/MoodPicker';
import { EmojiPicker } from '../feed/EmojiPicker';
import { CapsuleCountdown } from './CapsuleCountdown';
import { MEMORY_TYPE_ICONS } from './CapsuleLockedCard';
import { validateCapsuleTitle, validateCapsuleMemoryText, validateImageFile, validateVideoFile, MAX_POST_IMAGE_BYTES, MAX_POST_VIDEO_BYTES } from '../../lib/validators';
import { formatDate } from '../../utils/date';
import {
  MEMORY_TYPE_OPTIONS, CAPSULE_VISIBILITY_META, UNLOCK_PRESETS, computePresetDate,
  CAPSULE_TITLE_MAX, CAPSULE_MEMORY_TEXT_MAX, CAPSULE_MAX_PHOTOS, CAPSULE_MAX_VIDEOS,
  type Capsule, type CapsuleMemoryType, type CapsuleVisibility, type UnlockPresetId,
} from '../../types/capsule';
import { MOOD_META, type Mood } from '../../types/feed';

interface CapsuleWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (capsule: Capsule) => void;
}

interface PendingMedia {
  type: CapsuleMemoryType;
  file: File;
  previewUrl: string;
}

const STEP_TITLES = [
  'What kind of memory is this?',
  'Give it a title',
  'Write the memory',
  'Attach media',
  'How does it feel?',
  'Who can open this?',
  'When does it unlock?',
  'Review your capsule',
  'Memory Locked',
];

const MEDIA_CAPS: Partial<Record<CapsuleMemoryType, number>> = {
  photo: CAPSULE_MAX_PHOTOS, video: CAPSULE_MAX_VIDEOS,
};

// Nine steps, one deliberate decision at a time — the opposite of a
// composer's single scrolling form. Each step is small enough to feel
// like part of a ritual ("sealing" the capsule), not a settings form.
export const CapsuleWizard: React.FC<CapsuleWizardProps> = ({ isOpen, onClose, onCreated }) => {
  const { profile } = useAuth();
  const { createCapsule } = useCapsules();

  const [step, setStep] = useState(1);
  const [memoryTypes, setMemoryTypes] = useState<CapsuleMemoryType[]>(['text']);
  const [title, setTitle] = useState('');
  const [memoryText, setMemoryText] = useState('');
  const [media, setMedia] = useState<PendingMedia[]>([]);
  const [mood, setMood] = useState<Mood | null>(null);
  const [visibility, setVisibility] = useState<CapsuleVisibility>('only_me');
  const [preset, setPreset] = useState<UnlockPresetId | null>(null);
  const [customDate, setCustomDate] = useState('');
  const [customDateTime, setCustomDateTime] = useState('');
  const [unlockDate, setUnlockDate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdCapsule, setCreatedCapsule] = useState<Capsule | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const mediaCount = (type: CapsuleMemoryType) => media.filter(m => m.type === type).length;

  const resetAndClose = () => {
    media.forEach(m => URL.revokeObjectURL(m.previewUrl));
    setStep(1);
    setMemoryTypes(['text']);
    setTitle('');
    setMemoryText('');
    setMedia([]);
    setMood(null);
    setVisibility('only_me');
    setPreset(null);
    setCustomDate('');
    setCustomDateTime('');
    setUnlockDate(null);
    setError(null);
    setCreatedCapsule(null);
    onClose();
  };

  const toggleType = (type: CapsuleMemoryType) => {
    setError(null);
    setMemoryTypes(prev => {
      if (prev.includes(type)) {
        if (prev.length === 1) return prev;
        return prev.filter(t => t !== type);
      }
      return [...prev, type];
    });
  };

  const addMediaFiles = (type: CapsuleMemoryType, files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    const cap = MEDIA_CAPS[type] ?? 0;
    const remaining = Math.max(cap - mediaCount(type), 0);
    const selected = Array.from(files).slice(0, remaining);
    const next: PendingMedia[] = [];
    let firstInvalidError: string | null = null;
    for (const file of selected) {
      const validationError = type === 'photo' ? validateImageFile(file, MAX_POST_IMAGE_BYTES) : validateVideoFile(file);
      if (validationError) { firstInvalidError ??= validationError; continue; }
      next.push({ type, file, previewUrl: URL.createObjectURL(file) });
    }
    if (firstInvalidError) {
      setError(firstInvalidError);
    } else if (files.length > remaining) {
      setError(`Only added ${remaining} more ${type}${remaining === 1 ? '' : 's'} — a capsule can have up to ${cap}.`);
    }
    setMedia(prev => [...prev, ...next]);
  };

  const removeMedia = (index: number) => {
    setMedia(prev => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const pickPreset = (id: UnlockPresetId) => {
    setError(null);
    setPreset(id);
    if (id === 'custom_date' || id === 'custom_datetime') { setUnlockDate(null); return; }
    setUnlockDate(computePresetDate(id));
  };

  const applyCustomDate = (value: string) => {
    setCustomDate(value);
    if (!value) { setUnlockDate(null); return; }
    setUnlockDate(new Date(`${value}T09:00:00`));
  };

  const applyCustomDateTime = (value: string) => {
    setCustomDateTime(value);
    setUnlockDate(value ? new Date(value) : null);
  };

  const validateStep = (): string | null => {
    if (step === 1 && memoryTypes.length === 0) return 'Choose at least one memory type.';
    if (step === 2) return validateCapsuleTitle(title);
    if (step === 3) {
      const textError = validateCapsuleMemoryText(memoryText);
      if (textError) return textError;
      if (!memoryText.trim() && media.length === 0 && !title.trim()) return 'Write something, or attach a photo or video in the next step.';
    }
    if (step === 7 && (!unlockDate || unlockDate.getTime() <= Date.now())) return 'Choose a moment in the future for this capsule to unlock.';
    return null;
  };

  const goNext = () => {
    const validationError = validateStep();
    if (validationError) { setError(validationError); return; }
    setError(null);
    setStep(s => Math.min(s + 1, 8));
  };

  const goBack = () => { setError(null); setStep(s => Math.max(s - 1, 1)); };

  const handleLockMemory = async () => {
    if (!unlockDate) { setError('Choose an unlock date first.'); return; }
    setSubmitting(true);
    setError(null);
    const { error: createError, capsule } = await createCapsule({
      title,
      memoryText,
      memoryTypes,
      media: media.map(m => ({ type: m.type, file: m.file })),
      mood,
      visibility,
      unlockDate: unlockDate.toISOString(),
    });
    setSubmitting(false);
    if (createError || !capsule) { setError(createError ?? 'Could not lock your capsule.'); return; }
    setCreatedCapsule(capsule);
    setStep(9);
  };

  const handleDone = () => {
    if (createdCapsule) onCreated(createdCapsule);
    resetAndClose();
  };

  const displayName = profile?.display_name || profile?.username || 'You';
  const nonTextTypes = useMemo(() => memoryTypes.filter(t => t !== 'text'), [memoryTypes]);

  return (
    <Modal isOpen={isOpen} onClose={step === 9 ? handleDone : resetAndClose} title={STEP_TITLES[step - 1]} size="lg">
      <div className="flex flex-col gap-5">
        {step < 9 && (
          <div className="flex gap-1" aria-label={`Step ${step} of 8`}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full ${i < step ? 'bg-purple-500' : 'bg-gray-100'}`} />
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="grid grid-cols-3 gap-2">
            {MEMORY_TYPE_OPTIONS.map(({ type, label }) => {
              const Icon = MEMORY_TYPE_ICONS[type];
              const selected = memoryTypes.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleType(type)}
                  aria-pressed={selected}
                  className={[
                    'flex flex-col items-center gap-1.5 py-4 rounded-xl border text-xs font-medium transition-colors',
                    selected ? 'bg-purple-50 border-purple-300 text-purple-700' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300',
                  ].join(' ')}
                >
                  <Icon size={20} aria-hidden="true" />
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-1.5">
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={CAPSULE_TITLE_MAX}
              placeholder="Give this memory a name…"
              autoFocus
              className="border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-400 text-right">{title.length}/{CAPSULE_TITLE_MAX}</p>
          </div>
        )}

        {step === 3 && (
          <div className="flex items-start gap-3">
            <Avatar src={profile?.profile_photo_url} name={displayName} size="md" />
            <div className="flex-1 flex flex-col gap-1">
              <textarea
                value={memoryText}
                onChange={e => setMemoryText(e.target.value)}
                rows={6}
                autoFocus
                placeholder="What do you want your future self (or someone else) to know?"
                maxLength={CAPSULE_MEMORY_TEXT_MAX}
                className="w-full resize-none border-0 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-0"
              />
              <div className="flex items-center justify-end gap-1">
                <EmojiPicker onSelect={emoji => setMemoryText(t => t + emoji)} />
                <span className="text-xs text-gray-400">{memoryText.length}/{CAPSULE_MEMORY_TEXT_MAX}</span>
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-4">
            {nonTextTypes.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">Text only — nothing to attach. Move on to the next step whenever you're ready.</p>
            )}

            {nonTextTypes.includes('photo') && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <ImageIcon size={15} className="text-gray-400" aria-hidden="true" /> Photos
                  <span className="text-xs font-normal text-gray-400">{mediaCount('photo')}/{CAPSULE_MAX_PHOTOS} · JPG, PNG, WebP, GIF · {MAX_POST_IMAGE_BYTES / (1024 * 1024)}MB each</span>
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {media.filter(m => m.type === 'photo').map((m) => {
                    const index = media.indexOf(m);
                    return (
                      <div key={m.previewUrl} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                        <img src={m.previewUrl} alt="" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => removeMedia(index)} aria-label="Remove photo" className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center">
                          <X size={11} aria-hidden="true" />
                        </button>
                      </div>
                    );
                  })}
                  {mediaCount('photo') < CAPSULE_MAX_PHOTOS && (
                    <button type="button" onClick={() => photoInputRef.current?.click()} className="aspect-square rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-400 hover:border-purple-300 hover:text-purple-500 transition-colors">
                      <ImageIcon size={18} aria-hidden="true" />
                    </button>
                  )}
                </div>
                <input ref={photoInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple className="hidden" onChange={e => { addMediaFiles('photo', e.target.files); e.target.value = ''; }} />
              </div>
            )}

            {nonTextTypes.includes('video') && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <Video size={15} className="text-gray-400" aria-hidden="true" /> Videos
                  <span className="text-xs font-normal text-gray-400">{mediaCount('video')}/{CAPSULE_MAX_VIDEOS} · MP4, WebM, MOV · {MAX_POST_VIDEO_BYTES / (1024 * 1024)}MB each</span>
                </p>
                {media.filter(m => m.type === 'video').map(m => {
                  const index = media.indexOf(m);
                  return (
                    <div key={m.previewUrl} className="relative rounded-xl overflow-hidden bg-black">
                      <video src={m.previewUrl} controls className="w-full max-h-48" />
                      <button type="button" onClick={() => removeMedia(index)} aria-label="Remove video" className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center">
                        <X size={12} aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}
                {mediaCount('video') < CAPSULE_MAX_VIDEOS && (
                  <button type="button" onClick={() => videoInputRef.current?.click()} className="py-3 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center gap-1.5 text-gray-400 hover:border-purple-300 hover:text-purple-500 transition-colors text-sm">
                    <Video size={16} aria-hidden="true" /> Add a video
                  </button>
                )}
                <input ref={videoInputRef} type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={e => { addMediaFiles('video', e.target.files); e.target.value = ''; }} />
              </div>
            )}
          </div>
        )}

        {step === 5 && (
          <div className="flex flex-col gap-2">
            <MoodPicker value={mood} onChange={setMood} />
            <p className="text-xs text-gray-400">Optional — how this memory feels right now.</p>
          </div>
        )}

        {step === 6 && (
          <div className="flex flex-col gap-2">
            {(['only_me', 'followers', 'public'] as CapsuleVisibility[]).map(option => {
              const meta = CAPSULE_VISIBILITY_META[option];
              const selected = visibility === option;
              const Icon = option === 'public' ? Globe2 : option === 'followers' ? Users : Lock;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setVisibility(option)}
                  className={[
                    'flex items-start gap-3 px-3.5 py-2.5 rounded-xl border text-left transition-colors',
                    selected ? 'bg-purple-50 border-purple-300' : 'bg-white border-gray-200 hover:border-gray-300',
                  ].join(' ')}
                >
                  <span className={['w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5', selected ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-500'].join(' ')}>
                    <Icon size={15} aria-hidden="true" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className={`block text-sm font-medium ${selected ? 'text-purple-900' : 'text-gray-900'}`}>{meta.label}</span>
                    <span className="block text-xs text-gray-500 mt-0.5">{meta.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {step === 7 && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              {UNLOCK_PRESETS.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pickPreset(p.id)}
                  className={[
                    'py-2.5 rounded-xl text-sm font-medium border transition-colors',
                    preset === p.id ? 'bg-gradient-to-r from-purple-600 to-blue-500 border-transparent text-white shadow-sm' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300',
                  ].join(' ')}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {preset === 'custom_date' && (
              <input type="date" value={customDate} min={new Date().toISOString().slice(0, 10)} onChange={e => applyCustomDate(e.target.value)} className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
            )}
            {preset === 'custom_datetime' && (
              <input type="datetime-local" value={customDateTime} onChange={e => applyCustomDateTime(e.target.value)} className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
            )}
            {unlockDate && (
              <p className="text-sm text-gray-500 flex items-center gap-1.5">
                <CalendarClock size={14} className="text-gray-400" aria-hidden="true" />
                Unlocks {formatDate(unlockDate.toISOString())}
              </p>
            )}
          </div>
        )}

        {step === 8 && (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl bg-gradient-to-br from-purple-50 to-blue-50 p-4 flex flex-col gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                {memoryTypes.map(type => {
                  const Icon = MEMORY_TYPE_ICONS[type];
                  return <span key={type} className="w-6 h-6 rounded-full bg-white flex items-center justify-center"><Icon size={12} className="text-purple-500" aria-hidden="true" /></span>;
                })}
                {mood && <span className="text-sm" aria-label={MOOD_META[mood].label}>{MOOD_META[mood].emoji}</span>}
              </div>
              {title && <p className="text-sm font-semibold text-gray-900">{title}</p>}
              {memoryText && <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-4">{memoryText}</p>}
              {media.length > 0 && <p className="text-xs text-gray-500">{media.length} attachment{media.length !== 1 ? 's' : ''}</p>}
              <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                <span>{CAPSULE_VISIBILITY_META[visibility].label}</span>
                {unlockDate && <span>Unlocks {formatDate(unlockDate.toISOString())}</span>}
              </div>
            </div>
            <p className="text-xs text-gray-400 text-center">Once sealed, nobody — not even you — can see this again until it unlocks.</p>
          </div>
        )}

        {step === 9 && createdCapsule && (
          <div className="flex flex-col items-center gap-4 text-center py-2">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center shadow-lg">
              <Lock size={24} className="text-white" aria-hidden="true" />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">Memory Locked</p>
              <p className="text-sm text-gray-500 mt-1">Unlocks on {formatDate(createdCapsule.unlock_date)}</p>
            </div>
            <div className="w-full rounded-2xl bg-gradient-to-br from-purple-800 via-fuchsia-800 to-blue-800 p-4">
              <CapsuleCountdown unlockDate={createdCapsule.unlock_date} size="lg" />
            </div>
            <p className="text-sm text-gray-400 italic">You just sent a memory into the future.</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          {step === 9 ? (
            <Button variant="gradient" fullWidth onClick={handleDone}>Done</Button>
          ) : (
            <>
              {step > 1 && (
                <Button variant="outline" onClick={goBack}>
                  <ChevronLeft size={15} aria-hidden="true" /> Back
                </Button>
              )}
              {step < 8 ? (
                <Button variant="gradient" fullWidth onClick={goNext}>
                  Next <ChevronRight size={15} aria-hidden="true" />
                </Button>
              ) : (
                <Button variant="gradient" fullWidth loading={submitting} onClick={handleLockMemory}>
                  <Lock size={14} aria-hidden="true" /> Lock Memory
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
};
