import { useState, useRef, type MutableRefObject } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://zoomguru.onrender.com';
const VAD_THRESHOLD = 0.015;
const SILENCE_MS = 1500;
const MIN_SPEECH_MS = 2500;
const MIN_BLOB_BYTES = 25_000;
const MIN_WORDS = 4;

async function makeDeviceHeaders(): Promise<Record<string, string>> {
  const { keyId, timestamp, signature } = await window.zoomguru.signRequest();
  return {
    'X-Key-ID': keyId,
    'X-Timestamp': String(timestamp),
    'X-Signature': signature,
  };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

interface UseVADOptions {
  sessionCapped: boolean;
  questionCountRef: MutableRefObject<number>;
  sessionCapRef: MutableRefObject<number>;
  streamAnswer: (transcript: string) => Promise<void>;
  setMicGranted: (v: boolean) => void;
  onLogout: () => void;
}

export function useVAD({
  sessionCapped,
  questionCountRef,
  sessionCapRef,
  streamAnswer,
  setMicGranted,
  onLogout,
}: UseVADOptions) {
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [isAutoListening, setIsAutoListening] = useState(false);

  const isAutoModeRef = useRef(false);
  const vadStateRef = useRef<'idle' | 'recording' | 'processing'>('idle');
  const speechStartRef = useRef(0);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoStreamRef = useRef<MediaStream | null>(null);
  const autoContextRef = useRef<AudioContext | null>(null);
  const autoAnalyserRef = useRef<AnalyserNode | null>(null);
  const autoRecorderRef = useRef<MediaRecorder | null>(null);
  const autoChunksRef = useRef<BlobPart[]>([]);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startSegmentRef = useRef<() => void>(() => {});
  const processSegmentRef = useRef<(mimeType: string) => Promise<void>>(async () => {});

  function stopAutoMode(): void {
    isAutoModeRef.current = false;
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (autoRecorderRef.current?.state === 'recording') {
      autoRecorderRef.current.stop();
    }
    autoStreamRef.current?.getTracks().forEach((t) => t.stop());
    void autoContextRef.current?.close();
    autoStreamRef.current = null;
    autoContextRef.current = null;
    autoAnalyserRef.current = null;
    autoRecorderRef.current = null;
    vadStateRef.current = 'idle';
    setIsAutoMode(false);
    setIsAutoListening(false);
  }

  processSegmentRef.current = async (mimeType: string): Promise<void> => {
    vadStateRef.current = 'processing';
    setIsAutoListening(false);

    const duration = Date.now() - speechStartRef.current;
    const blob = new Blob(autoChunksRef.current, { type: mimeType });

    if (duration < MIN_SPEECH_MS) { vadStateRef.current = 'idle'; return; }
    if (blob.size < MIN_BLOB_BYTES) { vadStateRef.current = 'idle'; return; }

    try {
      const [token, base64, deviceHeaders] = await Promise.all([
        window.zoomguru.getToken(),
        blobToBase64(blob),
        makeDeviceHeaders(),
      ]);
      const res = await fetch(`${API_URL}/ai/transcribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...deviceHeaders,
        },
        body: JSON.stringify({ audio: base64 }),
      });
      if (res.status === 401) { stopAutoMode(); onLogout(); return; }
      if (!res.ok) { vadStateRef.current = 'idle'; return; }

      const data = await res.json() as { transcript?: string };
      const transcript = data.transcript?.trim() ?? '';

      if (transcript.split(/\s+/).filter(Boolean).length < MIN_WORDS) {
        vadStateRef.current = 'idle';
        return;
      }

      if (questionCountRef.current >= sessionCapRef.current) {
        stopAutoMode();
        return;
      }

      await streamAnswer(transcript);

      if (questionCountRef.current >= sessionCapRef.current) {
        stopAutoMode();
      }
    } catch {
      // discard failed segments silently in auto mode
    } finally {
      if (vadStateRef.current === 'processing') vadStateRef.current = 'idle';
    }
  };

  startSegmentRef.current = (): void => {
    if (!autoStreamRef.current) return;
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';
    const recorder = new MediaRecorder(autoStreamRef.current, { mimeType });
    autoChunksRef.current = [];
    speechStartRef.current = Date.now();

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) autoChunksRef.current.push(e.data);
    };
    recorder.onstop = () => { void processSegmentRef.current(mimeType); };

    autoRecorderRef.current = recorder;
    vadStateRef.current = 'recording';
    setIsAutoListening(true);
    recorder.start(100);
  };

  async function startAutoMode(): Promise<void> {
    if (sessionCapped) return;

    let stream: MediaStream;
    try {
      const sourceId = await window.zoomguru.getSystemAudioSourceId();
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: sourceId },
        } as unknown as MediaTrackConstraints,
        video: {
          mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: sourceId },
        } as unknown as MediaTrackConstraints,
      });
      stream.getVideoTracks().forEach((t) => t.stop());
    } catch {
      setMicGranted(false);
      return;
    }

    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    context.createMediaStreamSource(stream).connect(analyser);

    autoStreamRef.current = stream;
    autoContextRef.current = context;
    autoAnalyserRef.current = analyser;
    vadStateRef.current = 'idle';
    isAutoModeRef.current = true;
    setIsAutoMode(true);

    const dataArray = new Uint8Array(analyser.fftSize);

    pollIntervalRef.current = setInterval(() => {
      if (!isAutoModeRef.current || !autoAnalyserRef.current) return;
      if (vadStateRef.current === 'processing') return;

      autoAnalyserRef.current.getByteTimeDomainData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const norm = (dataArray[i] - 128) / 128;
        sum += norm * norm;
      }
      const rms = Math.sqrt(sum / dataArray.length);
      const speaking = rms > VAD_THRESHOLD;

      if (speaking && vadStateRef.current === 'idle') {
        startSegmentRef.current();
      } else if (!speaking && vadStateRef.current === 'recording') {
        if (!silenceTimerRef.current) {
          silenceTimerRef.current = setTimeout(() => {
            silenceTimerRef.current = null;
            if (vadStateRef.current === 'recording') {
              autoRecorderRef.current?.stop();
            }
          }, SILENCE_MS);
        }
      } else if (speaking && vadStateRef.current === 'recording') {
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
      }
    }, 80);
  }

  return { isAutoMode, isAutoListening, isAutoModeRef, stopAutoMode, startAutoMode };
}
