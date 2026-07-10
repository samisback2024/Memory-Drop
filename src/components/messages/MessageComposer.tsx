import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Send, Plus, Image as ImageIcon, Video, FileText, MapPin, X, Loader2 } from 'lucide-react';
import { EmojiPicker } from '../feed/EmojiPicker';
import { StickerPicker } from './StickerPicker';
import { VoiceRecorderBar, VoiceRecordTrigger } from './VoiceRecorderBar';
import { useMessages } from '../../hooks/useMessages';
import { useToast } from '../../hooks/useToast';
import { uploadFile, generateStoragePath } from '../../utils/storage';
import { compressImageFile } from '../../lib/image';
import { MAX_POST_IMAGE_BYTES, MAX_POST_VIDEO_BYTES, MAX_VOICE_RECORDING_BYTES } from '../../lib/validators';
import type { VoiceRecording } from '../../hooks/useVoiceRecorder';
import type { Message } from '../../types/message';

interface MessageComposerProps {
  conversationId: string;
  replyingTo: Message | null;
  onCancelReply: () => void;
  editingMessage: Message | null;
  onCancelEdit: () => void;
  onSent: () => void;
  disabled?: boolean;
}

const TYPING_IDLE_MS = 4000;
const BUCKET = 'chat-media';
// Mirrors the chat-media bucket's server-side allowed_mime_types allowlist
// (supabase/phase13_production_hardening.sql) for the generic "file" attach
// option — image/video/audio go through their own dedicated attach paths
// with their own mime handling, so this list only needs to cover documents.
const ALLOWED_FILE_MIME_TYPES = [
  'application/pdf', 'text/plain',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

// Handles its own file uploads (image compression via the existing
// compressImageFile(), same pipeline avatar/cover/feed photos already
// use) before calling send_message() with a ready-made attachments
// array — send_message() itself never touches Storage, just records
// what the client already uploaded, same division of responsibility as
// every other upload flow in this app (DropComposer, CapsuleWizard).
export const MessageComposer: React.FC<MessageComposerProps> = ({
  conversationId, replyingTo, onCancelReply, editingMessage, onCancelEdit, onSent, disabled = false,
}) => {
  const { sendMessage, editMessage, setTyping } = useMessages();
  const { showToast } = useToast();
  const [text, setText] = useState('');
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [recordingVoice, setRecordingVoice] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.content || '');
      textareaRef.current?.focus();
    }
  }, [editingMessage]);

  useEffect(() => {
    if (replyingTo) textareaRef.current?.focus();
  }, [replyingTo]);

  const notifyTyping = useCallback((value: string) => {
    const hasText = value.trim().length > 0;
    if (hasText && !isTypingRef.current) {
      isTypingRef.current = true;
      void setTyping(conversationId, true);
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      void setTyping(conversationId, false);
    }, TYPING_IDLE_MS);
  }, [conversationId, setTyping]);

  useEffect(() => () => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (isTypingRef.current) void setTyping(conversationId, false);
  }, [conversationId, setTyping]);

  const stopTyping = () => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    isTypingRef.current = false;
    void setTyping(conversationId, false);
  };

  const handleSendText = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    stopTyping();

    if (editingMessage) {
      const { error } = await editMessage(editingMessage.id, trimmed);
      setSending(false);
      if (error) { showToast(error, 'error'); return; }
      setText('');
      onCancelEdit();
      onSent();
      return;
    }

    const { error } = await sendMessage(conversationId, 'text', trimmed, {}, replyingTo?.id ?? null);
    setSending(false);
    if (error) { showToast(error, 'error'); return; }
    setText('');
    onCancelReply();
    onSent();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSendText();
    }
  };

  const uploadOne = async (file: File, kind: 'image' | 'video' | 'file'): Promise<{ error: string | null }> => {
    if (kind === 'image' && file.size > MAX_POST_IMAGE_BYTES) return { error: `Images must be ${Math.round(MAX_POST_IMAGE_BYTES / 1024 / 1024)}MB or smaller.` };
    if (kind === 'video' && file.size > MAX_POST_VIDEO_BYTES) return { error: `Videos must be ${Math.round(MAX_POST_VIDEO_BYTES / 1024 / 1024)}MB or smaller.` };
    // "File" had no client-side cap at all before Phase 13 — the bucket's
    // blanket 50MB limit was the only backstop. Reusing the video cap
    // here gives a real, immediate error instead of a confusing failed
    // upload once the file reaches Storage.
    if (kind === 'file' && file.size > MAX_POST_VIDEO_BYTES) return { error: `Files must be ${Math.round(MAX_POST_VIDEO_BYTES / 1024 / 1024)}MB or smaller.` };
    if (kind === 'file' && !ALLOWED_FILE_MIME_TYPES.includes(file.type)) return { error: 'That file type isn\'t supported yet — try a PDF, Word document, or plain text file.' };

    setUploading(true);
    const finalFile = kind === 'image' && file.type !== 'image/gif' ? await compressImageFile(file) : file;
    const path = generateStoragePath(conversationId, finalFile.name);
    const url = await uploadFile(BUCKET, path, finalFile);
    setUploading(false);
    if (!url) return { error: 'Upload failed.' };

    const messageType = kind === 'image' && file.type === 'image/gif' ? 'gif' : kind;
    const dims = kind === 'image' ? await readImageDimensions(finalFile) : null;

    const { error } = await sendMessage(conversationId, messageType, kind === 'file' ? file.name : null, {}, replyingTo?.id ?? null, null, [{
      bucket: BUCKET, storage_path: path, url, mime_type: finalFile.type, size_bytes: finalFile.size,
      width: dims?.width, height: dims?.height,
    }]);
    if (error) return { error };
    onCancelReply();
    onSent();
    return { error: null };
  };

  const readImageDimensions = (file: File): Promise<{ width: number; height: number } | null> =>
    new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve(null);
      img.src = URL.createObjectURL(file);
    });

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>, kind: 'image' | 'video' | 'file') => {
    const file = e.target.files?.[0];
    e.target.value = '';
    setAttachMenuOpen(false);
    if (!file) return;
    const { error } = await uploadOne(file, kind);
    if (error) showToast(error, 'error');
  };

  const handleLocation = () => {
    setAttachMenuOpen(false);
    if (!navigator.geolocation) { showToast('Location is not available in this browser.', 'error'); return; }
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { error } = await sendMessage(conversationId, 'location', null, {
          lat: pos.coords.latitude, lng: pos.coords.longitude,
        }, replyingTo?.id ?? null);
        if (error) showToast(error, 'error');
        else { onCancelReply(); onSent(); }
      },
      () => showToast('Could not get your location.', 'error'),
    );
  };

  const handleSticker = async (emoji: string) => {
    const { error } = await sendMessage(conversationId, 'sticker', null, { emoji }, replyingTo?.id ?? null);
    if (error) showToast(error, 'error');
    else { onCancelReply(); onSent(); }
  };

  const handleVoiceSend = async (recording: VoiceRecording) => {
    setRecordingVoice(false);
    if (recording.file.size > MAX_VOICE_RECORDING_BYTES) {
      showToast(`Voice notes must be ${Math.round(MAX_VOICE_RECORDING_BYTES / 1024 / 1024)}MB or smaller.`, 'error');
      return;
    }
    setUploading(true);
    const path = generateStoragePath(conversationId, recording.file.name);
    const url = await uploadFile(BUCKET, path, recording.file);
    setUploading(false);
    if (!url) { showToast('Upload failed.', 'error'); return; }
    const { error } = await sendMessage(conversationId, 'audio', null, {}, replyingTo?.id ?? null, null, [{
      bucket: BUCKET, storage_path: path, url, mime_type: recording.file.type, size_bytes: recording.file.size,
      duration_seconds: recording.durationSeconds, waveform: recording.waveform,
    }]);
    if (error) showToast(error, 'error');
    else { onCancelReply(); onSent(); }
  };

  if (recordingVoice) {
    return <div className="p-2"><VoiceRecorderBar onSend={handleVoiceSend} onCancel={() => setRecordingVoice(false)} /></div>;
  }

  return (
    <div className="flex flex-col gap-2 p-2 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
      {(replyingTo || editingMessage) && (
        <div className="flex items-center justify-between px-2 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-xl text-xs">
          <span className="text-gray-500 dark:text-gray-400 truncate">
            {editingMessage ? 'Editing message' : `Replying to ${replyingTo?.sender_display_name || 'message'}`}
          </span>
          <button type="button" onClick={editingMessage ? onCancelEdit : onCancelReply} aria-label="Cancel" className="p-1 text-gray-400 hover:text-gray-600">
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-1.5">
        <div className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => setAttachMenuOpen(p => !p)}
            aria-label="Attach"
            aria-expanded={attachMenuOpen}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none"
          >
            <Plus size={20} aria-hidden="true" className={`transition-transform ${attachMenuOpen ? 'rotate-45' : ''}`} />
          </button>
          {attachMenuOpen && (
            <div className="absolute left-0 bottom-11 w-44 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl shadow-xl z-30 py-1 animate-fade-in">
              <button type="button" onClick={() => imageInputRef.current?.click()} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">
                <ImageIcon size={16} aria-hidden="true" /> Photo or GIF
              </button>
              <button type="button" onClick={() => videoInputRef.current?.click()} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">
                <Video size={16} aria-hidden="true" /> Video
              </button>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">
                <FileText size={16} aria-hidden="true" /> File
              </button>
              <button type="button" onClick={handleLocation} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">
                <MapPin size={16} aria-hidden="true" /> Location
              </button>
            </div>
          )}
          <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleFilePicked(e, 'image')} />
          <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={e => handleFilePicked(e, 'video')} />
          <input ref={fileInputRef} type="file" accept={ALLOWED_FILE_MIME_TYPES.join(',')} className="hidden" onChange={e => handleFilePicked(e, 'file')} />
        </div>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => { setText(e.target.value); notifyTyping(e.target.value); }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={disabled ? 'You can\'t message this conversation' : 'Message…'}
          rows={1}
          className="flex-1 resize-none max-h-32 px-3 py-2 rounded-2xl bg-gray-100 dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none disabled:opacity-60"
        />

        <div className="flex items-center gap-0.5 flex-shrink-0">
          <EmojiPicker onSelect={emoji => setText(t => t + emoji)} />
          <StickerPicker onSelect={handleSticker} />
          {!text.trim() && !editingMessage && <VoiceRecordTrigger onClick={() => setRecordingVoice(true)} />}
        </div>

        <button
          type="button"
          onClick={handleSendText}
          disabled={!text.trim() || sending || disabled}
          aria-label="Send"
          className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-600 to-blue-500 text-white flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-opacity"
        >
          {sending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Send size={15} className="ml-0.5" aria-hidden="true" />}
        </button>
      </div>

      {uploading && (
        <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1.5 px-1">
          <Loader2 size={11} className="animate-spin" aria-hidden="true" /> Uploading…
        </p>
      )}
    </div>
  );
};
