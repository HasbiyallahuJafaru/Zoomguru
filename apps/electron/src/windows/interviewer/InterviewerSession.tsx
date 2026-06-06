import { useState, useEffect, useRef, useCallback } from 'react';
import type { SessionConfig } from './InterviewerApp';
import { KokoroTTS } from 'kokoro-js';
import { makeDeviceHeaders, blobToBase64 } from '../../utils';

const API_URL = import.meta.env.VITE_API_URL || 'https://zoomguru.onrender.com';
const VOICE = 'af_heart';
const MAX_QUESTIONS = 30;

export interface TranscriptEntry {
  questionNumber: number;
  question: string;
  answer: string;
}

interface Props {
  config: SessionConfig;
  onEnd: (transcript: TranscriptEntry[]) => void;
}

type SessionPhase =
  | 'init'
  | 'generating'
  | 'speaking'
  | 'listening'
  | 'processing'
  | 'ended'
  | 'error';

interface Question {
  text: string;
  number: number;
}

const InterviewerSession = ({ config, onEnd }: Props) => {
  const [phase, setPhase] = useState<SessionPhase>('init');
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [questionText, setQuestionText] = useState('');
  const [priorQuestions, setPriorQuestions] = useState<string[]>([]);
  const [lastAnswerQuality, setLastAnswerQuality] = useState<'good' | 'average' | 'poor' | undefined>(undefined);
  const [errorMsg, setErrorMsg] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [answerDuration, setAnswerDuration] = useState(0);
  const [ttsReady, setTtsReady] = useState(false);

  const ttsRef = useRef<KokoroTTS | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef(false);
  const sessionTranscriptRef = useRef<TranscriptEntry[]>([]);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const generateAbortRef = useRef<AbortController | null>(null);
  const answerDurationRef = useRef(0);

  const cleanup = useCallback(() => {
    abortRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop();
    }
    generateAbortRef.current?.abort();
    void readerRef.current?.cancel();
  }, []);

  // Initialise TTS and start first question.
  useEffect(() => {
    void (async () => {
      await window.zoomguru.setSessionActive(true);
      try {
        ttsRef.current = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0', {
          dtype: 'fp32',
          device: 'wasm',
        });
        setTtsReady(true);
        await generateQuestion(1, [], undefined);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load voice model';
        setErrorMsg(msg);
        setPhase('error');
      }
    })();
    return cleanup;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generateQuestion(
    number: number,
    prior: string[],
    answerQuality: 'good' | 'average' | 'poor' | undefined,
  ): Promise<void> {
    if (abortRef.current) return;
    setPhase('generating');
    setQuestionText('');

    const token = await window.zoomguru.getToken();
    const deviceHeaders = await makeDeviceHeaders();

    generateAbortRef.current?.abort();
    const abortCtrl = new AbortController();
    generateAbortRef.current = abortCtrl;

    let text = '';
    try {
      const response = await fetch(`${API_URL}/ai/interviewer-question`, {
        method: 'POST',
        signal: abortCtrl.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...deviceHeaders,
        },
        body: JSON.stringify({
          cvText: config.cvText || undefined,
          jdText: config.jdText || undefined,
          difficulty: config.difficulty,
          questionNumber: number,
          priorQuestions: prior.slice(-10),
          lastAnswerQuality: answerQuality,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Server returned ${response.status}`);
      }

      const reader = response.body.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done || abortRef.current) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data:')) continue;
          try {
            const json = JSON.parse(line.slice(5).trim()) as { chunk?: string; done?: boolean };
            if (json.chunk) {
              text += json.chunk;
              setQuestionText(text);
            }
            if (json.done) break;
          } catch {
            // partial line, continue
          }
        }
      }
    } catch (err) {
      if (abortRef.current || (err instanceof Error && err.name === 'AbortError')) return;
      const msg = err instanceof Error ? err.message : 'Failed to generate question';
      setErrorMsg(msg);
      setPhase('error');
      return;
    }

    if (abortRef.current) return;
    const q: Question = { text, number };
    setCurrentQuestion(q);
    await speakQuestion(text, q, prior);
  }

  async function speakQuestion(text: string, q: Question, prior: string[]): Promise<void> {
    if (abortRef.current || !ttsRef.current) return;
    setPhase('speaking');

    try {
      const audio = await ttsRef.current.generate(text, { voice: VOICE });
      if (abortRef.current) return;

      const audioCtx = new AudioContext();
      try {
        const buffer = audioCtx.createBuffer(1, audio.audio.length, audio.sampling_rate);
        buffer.getChannelData(0).set(audio.audio as Float32Array);
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtx.destination);

        await new Promise<void>((resolve) => {
          source.onended = () => {
            void audioCtx.close();
            resolve();
          };
          source.start();
        });
      } finally {
        if (audioCtx.state !== 'closed') {
          void audioCtx.close();
        }
      }
    } catch {
      // TTS failed — continue silently, user can still answer
    }

    if (abortRef.current) return;
    startListening(q, prior);
  }

  function startListening(q: Question, prior: string[]): void {
    if (abortRef.current) return;
    setPhase('listening');
    setIsListening(true);
    setAnswerDuration(0);
    answerDurationRef.current = 0;
    audioChunksRef.current = [];

    timerRef.current = setInterval(() => {
      setAnswerDuration((d) => {
        const next = d + 1;
        answerDurationRef.current = next;
        return next;
      });
    }, 1000);

    navigator.mediaDevices
      .getUserMedia({ audio: true, video: false })
      .then((stream) => {
        if (abortRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        const mr = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
        mediaRecorderRef.current = mr;

        mr.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        mr.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          if (timerRef.current) clearInterval(timerRef.current);
          if (!abortRef.current) {
            void submitAnswer(q, prior);
          }
        };

        mr.start();
        setIsListening(true);
      })
      .catch(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        setIsListening(false);
        sessionTranscriptRef.current.push({ questionNumber: q.number, question: q.text, answer: '' });
        void moveToNextQuestion(q, prior, undefined);
      });
  }

  function stopListening(): void {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsListening(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  async function submitAnswer(q: Question, prior: string[]): Promise<void> {
    if (abortRef.current) return;
    setPhase('processing');

    let transcript = '';
    const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

    if (blob.size > 500) {
      try {
        const base64 = await blobToBase64(blob);
        const token = await window.zoomguru.getToken();
        const deviceHeaders = await makeDeviceHeaders();

        const res = await fetch(`${API_URL}/ai/transcribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            ...deviceHeaders,
          },
          body: JSON.stringify({ audio: base64 }),
        });

        if (res.ok) {
          const data = (await res.json()) as { transcript: string };
          transcript = data.transcript ?? '';
        }
      } catch {
        // Transcription failed — continue without quality signal
      }
    }

    sessionTranscriptRef.current.push({
      questionNumber: q.number,
      question: q.text,
      answer: transcript,
    });
    const quality = inferQuality(transcript, answerDurationRef.current);
    setLastAnswerQuality(quality);
    await moveToNextQuestion(q, prior, quality);
  }

  async function moveToNextQuestion(
    q: Question,
    prior: string[],
    quality: 'good' | 'average' | 'poor' | undefined,
  ): Promise<void> {
    if (abortRef.current) return;
    const updatedPrior = [...prior, q.text];
    setPriorQuestions(updatedPrior);

    if (q.number >= MAX_QUESTIONS) {
      setPhase('ended');
      await window.zoomguru.setSessionActive(false);
      onEnd(sessionTranscriptRef.current);
      return;
    }

    await generateQuestion(q.number + 1, updatedPrior, quality);
  }

  function inferQuality(
    transcript: string,
    duration: number,
  ): 'good' | 'average' | 'poor' {
    const words = transcript.trim().split(/\s+/).filter(Boolean).length;
    if (duration < 10 || words < 10) return 'poor';
    if (duration > 40 && words > 50) return 'good';
    return 'average';
  }

  async function handleEndSession(): Promise<void> {
    cleanup();
    await window.zoomguru.setSessionActive(false);
    onEnd(sessionTranscriptRef.current);
  }

  function formatDuration(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  if (phase === 'init' || (!ttsReady && phase !== 'error')) {
    return (
      <div style={styles.root}>
        <div style={styles.center}>
          <div style={styles.spinner} />
          <span style={styles.statusText}>Loading voice model…</span>
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div style={styles.root}>
        <div style={styles.center}>
          <span style={{ color: '#ef4444', fontSize: 16 }}>Something went wrong</span>
          <span style={styles.statusText}>{errorMsg}</span>
          <button style={styles.btnPrimary} onClick={() => void handleEndSession()}>
            Exit
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'ended') {
    return (
      <div style={styles.root}>
        <div style={styles.center}>
          <span style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>Session complete</span>
          <span style={styles.statusText}>
            You answered {priorQuestions.length} question{priorQuestions.length !== 1 ? 's' : ''}
          </span>
          <div style={styles.spinner} />
        </div>
      </div>
    );
  }

  return (
    <div style={styles.root}>
      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); opacity: 1; }
          50% { transform: translateY(-3px); opacity: 0.6; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div style={styles.topBar}>
        <span style={styles.questionCounter}>
          Question {currentQuestion?.number ?? '…'} of {MAX_QUESTIONS}
        </span>
        <span style={styles.difficulty}>{config.difficulty.toUpperCase()}</span>
        <button style={styles.endBtn} onClick={() => void handleEndSession()}>
          End session
        </button>
      </div>

      <div style={styles.questionArea}>
        {phase === 'generating' && !questionText && (
          <div style={styles.generating}>
            <div style={styles.spinner} />
          </div>
        )}
        {questionText && (
          <p style={styles.questionText}>{questionText}</p>
        )}
        {phase === 'speaking' && (
          <div style={styles.speakingIndicator}>
            <span style={styles.speakingDot} />
            <span style={styles.speakingDot} />
            <span style={styles.speakingDot} />
            <span style={styles.statusText}>Speaking…</span>
          </div>
        )}
      </div>

      <div style={styles.controls}>
        {phase === 'listening' && (
          <>
            <div style={styles.listeningRow}>
              <span style={styles.recDot} />
              <span style={styles.listeningLabel}>Recording your answer</span>
              <span style={styles.timer}>{formatDuration(answerDuration)}</span>
            </div>
            <button style={styles.btnStop} onClick={stopListening}>
              Done answering
            </button>
          </>
        )}
        {phase === 'processing' && (
          <span style={styles.statusText}>Processing…</span>
        )}
        {(phase === 'generating' || phase === 'speaking') && (
          <span style={styles.statusText}>
            {phase === 'generating' ? 'Generating question…' : 'Listen to the question'}
          </span>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  root: {
    width: '100vw',
    height: '100vh',
    background: '#0a0a0a',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    color: '#fff',
  },
  center: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 28px',
    borderBottom: '1px solid #1a1a1a',
    WebkitAppRegion: 'drag',
  },
  questionCounter: {
    fontSize: 14,
    color: '#888',
    fontVariantNumeric: 'tabular-nums',
  },
  difficulty: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.1em',
    color: '#555',
  },
  endBtn: {
    background: 'none',
    border: '1px solid #333',
    color: '#888',
    fontSize: 13,
    padding: '6px 14px',
    borderRadius: 6,
    cursor: 'pointer',
    WebkitAppRegion: 'no-drag',
  },
  questionArea: {
    flex: 1,
    padding: '40px 48px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 24,
  },
  generating: {
    display: 'flex',
    justifyContent: 'center',
  },
  questionText: {
    fontSize: 22,
    lineHeight: 1.6,
    color: '#fff',
    fontWeight: 500,
    maxWidth: 680,
  },
  speakingIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  speakingDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#fff',
    opacity: 0.7,
    animation: 'bounce 1s infinite',
  },
  controls: {
    padding: '24px 48px',
    borderTop: '1px solid #1a1a1a',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    minHeight: 100,
    justifyContent: 'center',
  },
  listeningRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  recDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: '#ef4444',
    animation: 'pulse 1.2s infinite',
  },
  listeningLabel: {
    fontSize: 14,
    color: '#aaa',
  },
  timer: {
    fontSize: 14,
    color: '#fff',
    fontVariantNumeric: 'tabular-nums',
    fontWeight: 600,
    minWidth: 36,
  },
  btnStop: {
    padding: '12px 32px',
    borderRadius: 10,
    border: 'none',
    background: '#fff',
    color: '#0a0a0a',
    fontWeight: 700,
    fontSize: 15,
    cursor: 'pointer',
  },
  btnPrimary: {
    padding: '12px 32px',
    borderRadius: 10,
    border: 'none',
    background: '#fff',
    color: '#0a0a0a',
    fontWeight: 700,
    fontSize: 15,
    cursor: 'pointer',
  },
  statusText: {
    fontSize: 14,
    color: '#666',
  },
  spinner: {
    width: 28,
    height: 28,
    border: '3px solid #333',
    borderTop: '3px solid #fff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
};

export default InterviewerSession;
