import React, { useEffect, useRef, useState } from 'react';
import { Mic, Square, Trash2, Play, Pause, Send } from 'lucide-react';
import { useVoiceRecorder, type VoiceRecording } from '../../hooks/useVoiceRecorder';

interface VoiceRecorderBarProps {
  onSend: (recording: VoiceRecording) => void;
  onCancel: () => void;
}

const formatDuration = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

// Two states: recording (live waveform via useVoiceRecorder's
// AnalyserNode sampling) and preview (the recorded clip, with its own
// play/pause before committing to Send). Delete discards the preview
// and returns to idle; Cancel aborts an in-progress recording outright.
export const VoiceRecorderBar: React.FC<VoiceRecorderBarProps> = ({ onSend, onCancel }) => {
  const { recording, duration, waveform, error, start, stop, cancel } = useVoiceRecorder();
  const [preview, setPreview] = useState<VoiceRecording | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => { void start(); }, [start]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const handleStop = async () => {
    const result = await stop();
    if (!result) { onCancel(); return; }
    setPreview(result);
    setPreviewUrl(URL.createObjectURL(result.file));
  };

  const handleDelete = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreview(null);
    setPreviewUrl(null);
    onCancel();
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else void audio.play();
  };

  if (preview && previewUrl) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 dark:bg-purple-950/30 rounded-2xl">
        <audio ref={audioRef} src={previewUrl} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
        <button type="button" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'} className="w-9 h-9 rounded-full bg-purple-600 text-white flex items-center justify-center flex-shrink-0">
          {playing ? <Pause size={15} aria-hidden="true" /> : <Play size={15} className="ml-0.5" aria-hidden="true" />}
        </button>
        <div className="flex-1 flex items-center gap-0.5 h-8" aria-hidden="true">
          {preview.waveform.map((v, i) => (
            <span key={i} className="flex-1 bg-purple-400 dark:bg-purple-500 rounded-full" style={{ height: `${Math.max(15, v * 100)}%` }} />
          ))}
        </div>
        <span className="text-xs text-purple-700 dark:text-purple-300 font-medium flex-shrink-0">{formatDuration(preview.durationSeconds)}</span>
        <button type="button" onClick={handleDelete} aria-label="Delete recording" className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors flex-shrink-0">
          <Trash2 size={16} aria-hidden="true" />
        </button>
        <button type="button" onClick={() => onSend(preview)} aria-label="Send voice message" className="p-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors flex-shrink-0">
          <Send size={16} aria-hidden="true" />
        </button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-red-50 dark:bg-red-950/30 rounded-2xl">
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        <button type="button" onClick={onCancel} className="text-xs font-medium text-red-700 dark:text-red-300">Close</button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-red-50 dark:bg-red-950/30 rounded-2xl">
      <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" aria-hidden="true" />
      <div className="flex-1 flex items-center gap-0.5 h-8" aria-hidden="true">
        {waveform.length === 0 ? (
          <span className="text-xs text-red-500">Listening…</span>
        ) : (
          waveform.map((v, i) => (
            <span key={i} className="flex-1 bg-red-400 dark:bg-red-500 rounded-full" style={{ height: `${Math.max(15, v * 100)}%` }} />
          ))
        )}
      </div>
      <span className="text-xs text-red-700 dark:text-red-300 font-medium flex-shrink-0">{formatDuration(duration)}</span>
      <button type="button" onClick={cancel} aria-label="Cancel recording" className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors flex-shrink-0">
        <Trash2 size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={handleStop}
        disabled={!recording}
        aria-label="Stop recording"
        className="w-9 h-9 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center flex-shrink-0 disabled:opacity-50"
      >
        <Square size={13} className="fill-current" aria-hidden="true" />
      </button>
    </div>
  );
};

// Trigger button that mounts VoiceRecorderBar (the composer swaps its
// whole input row for this while recording/previewing).
export const VoiceRecordTrigger: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Record a voice note"
    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:outline-none"
  >
    <Mic size={18} aria-hidden="true" />
  </button>
);
