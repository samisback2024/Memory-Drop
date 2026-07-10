import { useCallback, useRef, useState } from 'react';

export interface VoiceRecording {
  file: File;
  durationSeconds: number;
  waveform: number[];
}

const WAVEFORM_SAMPLES = 40;

// Promoted out of CapsuleWizard's private VoiceRecorder (Phase 6) into a
// shared hook — CapsuleWizard itself is left untouched (still has its
// own inline copy) to avoid refactoring already-shipped, working code
// outside this phase's scope. The core pipeline is identical
// (getUserMedia -> MediaRecorder -> Blob -> File); this adds a running
// duration timer and a live amplitude-sampled waveform via AnalyserNode,
// both purely for display.
export const useVoiceRecorder = () => {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [waveform, setWaveform] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sample = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(data);
    let sumSquares = 0;
    for (let i = 0; i < data.length; i++) {
      const centered = (data[i] - 128) / 128;
      sumSquares += centered * centered;
    }
    const amplitude = Math.min(1, Math.sqrt(sumSquares / data.length) * 4);
    setWaveform(prev => [...prev, amplitude].slice(-WAVEFORM_SAMPLES));
    rafRef.current = requestAnimationFrame(sample);
  }, []);

  const cleanup = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    void audioCtxRef.current?.close().catch(() => {});
    rafRef.current = null;
    timerRef.current = null;
    streamRef.current = null;
    audioCtxRef.current = null;
    analyserRef.current = null;
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setWaveform([]);
    setDuration(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;
      rafRef.current = requestAnimationFrame(sample);

      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorderRef.current = recorder;
      recorder.start();
      startedAtRef.current = Date.now();
      timerRef.current = setInterval(() => setDuration(Math.round((Date.now() - startedAtRef.current) / 1000)), 200);
      setRecording(true);
    } catch {
      setError('Microphone access is needed to record a voice note.');
    }
  }, [sample]);

  const stop = useCallback((): Promise<VoiceRecording | null> => {
    return new Promise(resolve => {
      const recorder = recorderRef.current;
      if (!recorder) { resolve(null); return; }
      recorder.onstop = () => {
        const finalWaveform = waveform;
        const finalDuration = duration;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        cleanup();
        setRecording(false);
        if (finalDuration < 1) { resolve(null); return; }
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: blob.type });
        resolve({ file, durationSeconds: finalDuration, waveform: finalWaveform });
      };
      recorder.stop();
    });
  }, [cleanup, waveform, duration]);

  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder) {
      recorder.onstop = null;
      recorder.stop();
    }
    cleanup();
    chunksRef.current = [];
    setRecording(false);
    setWaveform([]);
    setDuration(0);
  }, [cleanup]);

  return { recording, duration, waveform, error, start, stop, cancel };
};
