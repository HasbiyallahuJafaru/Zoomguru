import { useState, useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';

type Phase =
  | 'starting'
  | 'generating'
  | 'speaking'
  | 'waiting'
  | 'listening'
  | 'transcribing'
  | 'evaluating'
  | 'finishing'
  | 'error';

type Difficulty = 'easy' | 'medium' | 'hard' | 'dynamic';
type AnswerQuality = 'good' | 'average' | 'poor';

export interface QAEntry {
  question: string;
  answer: string;
}

interface Props {
  cvText?: string;
  jdText?: string;
  difficulty: Difficulty;
  onFinish: (entries: QAEntry[]) => void;
  onExit: () => void;
}

const TOTAL_QUESTIONS = 25;
const API_URL = import.meta.env.VITE_API_URL || 'https://zoomguru.onrender.com';
const SANS = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";

const ORB_CSS = `
@keyframes orb-generate {
  0%, 100% { transform: scale(1); box-shadow: 0 0 40px rgba(99,102,241,0.35); }
  50%       { transform: scale(1.08); box-shadow: 0 0 65px rgba(99,102,241,0.55); }
}
@keyframes orb-speak {
  0%, 100% { transform: scale(1); box-shadow: 0 0 40px rgba(99,102,241,0.35); }
  50%       { transform: scale(1.10); box-shadow: 0 0 70px rgba(99,102,241,0.65); }
}
@keyframes orb-listen {
  0%, 100% { transform: scale(1); box-shadow: 0 0 30px rgba(244,63,94,0.40); }
  50%       { transform: scale(1.07); box-shadow: 0 0 55px rgba(244,63,94,0.70); }
}
@keyframes orb-transcribe {
  0%, 100% { transform: scale(1); opacity: 1; box-shadow: 0 0 30px rgba(251,191,36,0.30); }
  50%       { transform: scale(1.04); opacity: 0.7; box-shadow: 0 0 50px rgba(251,191,36,0.50); }
}
`;

function getOrbStyle(phase: Phase): CSSProperties {
  const base: CSSProperties = {
    width: '160px',
    height: '160px',
    borderRadius: '50%',
    flexShrink: 0,
    transition: 'background 400ms ease',
  };
  switch (phase) {
    case 'generating':
      return { ...base, background: 'radial-gradient(circle at 40% 40%, rgba(139,92,246,0.8), rgba(99,102,241,0.45))', animation: 'orb-generate 1.4s ease-in-out infinite' };
    case 'speaking':
      return { ...base, background: 'radial-gradient(circle at 40% 40%, rgba(139,92,246,0.9), rgba(99,102,241,0.55))', animation: 'orb-speak 1.2s ease-in-out infinite' };
    case 'listening':
      return { ...base, background: 'radial-gradient(circle at 40% 40%, rgba(251,113,133,0.9), rgba(244,63,94,0.55))', animation: 'orb-listen 0.9s ease-in-out infinite' };
    case 'transcribing':
      return { ...base, background: 'radial-gradient(circle at 40% 40%, rgba(251,191,36,0.8), rgba(245,158,11,0.45))', animation: 'orb-transcribe 1.4s ease-in-out infinite' };
    case 'error':
      return { ...base, background: 'radial-gradient(circle at 40% 40%, rgba(239,68,68,0.45), rgba(185,28,28,0.25))', boxShadow: '0 0 20px rgba(239,68,68,0.2)' };
    default:
      return { ...base, background: 'radial-gradient(circle at 40% 40%, rgba(75,85,99,0.35), rgba(55,65,81,0.18))', boxShadow: '0 0 12px rgba(0,0,0,0.3)' };
  }
}

function phaseLabel(phase: Phase, qNum: number, total: number): string {
  switch (phase) {
    case 'starting':     return 'Starting interview…';
    case 'generating':   return `Question ${qNum} of ${total} — thinking…`;
    case 'speaking':     return 'Listen carefully…';
    case 'waiting':      return 'Your turn to answer';
    case 'listening':    return 'Listening… speak your answer';
    case 'transcribing': return 'Processing your answer…';
    case 'evaluating':   return 'Moving to next question…';
    case 'finishing':    return 'Preparing your report…';
    case 'error':        return 'An error occurred';
    default: return '';
  }
}

function computeQuality(answer: string): AnswerQuality {
  const words = answer.trim().split(/\s+/).filter(Boolean).length;
  if (words < 20) return 'poor';
  if (words <= 60) return 'average';
  return 'good';
}

export default function InterviewerSession({ cvText, jdText, difficulty, onFinish, onExit }: Props) {
  const [phase, setPhase] = useState<Phase>('starting');
  const [questionNumber, setQuestionNumber] = useState(1);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const abortRef = useRef(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const silenceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function cleanup() {
    if (silenceIntervalRef.current) { clearInterval(silenceIntervalRef.current); silenceIntervalRef.current = null; }
    try { if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop(); } catch { /* noop */ }
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    try { audioContextRef.current?.close(); } catch { /* noop */ }
    mediaStreamRef.current = null;
    mediaRecorderRef.current = null;
    audioContextRef.current = null;
  }

  useEffect(() => {
    let cancelled = false;
    abortRef.current = false;

    async function getHeaders(): Promise<Record<string, string>> {
      const token = await window.zoomguru.getToken();
      let userId = '';
      try { userId = (JSON.parse(atob(token.split('.')[1])) as { sub?: string }).sub ?? ''; } catch { /* ignore */ }
      const sig = await window.zoomguru.signRequest(userId);
      return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Key-ID': sig.keyId,
        'X-Timestamp': String(sig.timestamp),
        'X-Signature': sig.signature,
      };
    }

    async function fetchQuestion(
      qNum: number,
      priorQuestions: string[],
      lastQuality: AnswerQuality | undefined,
    ): Promise<string> {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/ai/interviewer-question`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ cvText, jdText, difficulty, questionNumber: qNum, priorQuestions, lastAnswerQuality: lastQuality }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let text = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith('data: ')) continue;
          const d = t.slice(6);
          if (d === '[DONE]') break;
          try {
            const p = JSON.parse(d) as { chunk?: string; done?: boolean };
            if (p.chunk) text += p.chunk;
          } catch { /* skip */ }
        }
      }
      return text.trim();
    }

    async function playTts(text: string): Promise<void> {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/ai/tts`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return; // non-fatal: skip TTS, continue to listening
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      return new Promise((resolve) => {
        const audio = new Audio(url);
        audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
        audio.onerror = () => { URL.revokeObjectURL(url); resolve(); }; // non-fatal
        audio.play().catch(() => { URL.revokeObjectURL(url); resolve(); });
      });
    }

    function recordAnswer(): Promise<string> {
      return new Promise((resolve, reject) => {
        navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
          mediaStreamRef.current = stream;

          const audioCtx = new AudioContext();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 512;
          source.connect(analyser);

          const chunks: Blob[] = [];
          const recorder = new MediaRecorder(stream);
          mediaRecorderRef.current = recorder;

          recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

          recorder.onstop = () => {
            if (silenceIntervalRef.current) { clearInterval(silenceIntervalRef.current); silenceIntervalRef.current = null; }
            stream.getTracks().forEach((t) => t.stop());
            try { audioCtx.close(); } catch { /* noop */ }
            const blob = new Blob(chunks, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result as string;
              resolve(result.split(',')[1] ?? '');
            };
            reader.readAsDataURL(blob);
          };

          recorder.onerror = () => reject(new Error('Recording error'));
          recorder.start(100);

          let silenceMs = 0;
          let recordingMs = 0;
          const timeDomain = new Uint8Array(analyser.fftSize);

          silenceIntervalRef.current = setInterval(() => {
            recordingMs += 100;
            analyser.getByteTimeDomainData(timeDomain);

            let sum = 0;
            for (let i = 0; i < timeDomain.length; i++) {
              const v = (timeDomain[i] - 128) / 128;
              sum += v * v;
            }
            const rms = Math.sqrt(sum / timeDomain.length);

            if (rms < 0.01) {
              if (recordingMs >= 1000) silenceMs += 100;
              if (silenceMs >= 2500 && recorder.state === 'recording') recorder.stop();
            } else {
              silenceMs = 0;
            }

            if (recordingMs >= 120_000 && recorder.state === 'recording') recorder.stop();
          }, 100);
        }).catch(reject);
      });
    }

    async function transcribeAudio(audioBase64: string): Promise<string> {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/ai/transcribe`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ audio: audioBase64 }),
      });
      if (!res.ok) return '';
      const data = await res.json() as { transcript?: string };
      return data.transcript ?? '';
    }

    async function runSession() {
      const hasMic = await window.zoomguru.requestMicPermission();
      if (!hasMic || cancelled) {
        if (!cancelled) { setErrorMsg('Microphone permission required.'); setPhase('error'); }
        return;
      }

      const entries: QAEntry[] = [];
      const priorQuestions: string[] = [];
      let lastQuality: AnswerQuality | undefined = undefined;

      while (entries.length < TOTAL_QUESTIONS && !cancelled) {
        const qNum = entries.length + 1;
        setQuestionNumber(qNum);

        // Generate question
        setPhase('generating');
        let question = '';
        try {
          question = await fetchQuestion(qNum, priorQuestions, lastQuality);
        } catch {
          if (cancelled) return;
          setErrorMsg('Failed to generate question. Please try again.');
          setPhase('error');
          return;
        }
        if (cancelled) return;

        setCurrentQuestion(question);
        priorQuestions.push(question);

        // Speak question
        setPhase('speaking');
        try { await playTts(question); } catch { /* non-fatal */ }
        if (cancelled) return;

        // Brief pause before listening
        setPhase('waiting');
        await new Promise((r) => setTimeout(r, 400));
        if (cancelled) return;

        // Record answer
        setPhase('listening');
        let audioBase64 = '';
        try {
          audioBase64 = await recordAnswer();
        } catch {
          if (cancelled) return;
          setErrorMsg('Could not record audio. Check microphone permissions.');
          setPhase('error');
          return;
        }
        if (cancelled) return;

        // Transcribe
        setPhase('transcribing');
        let answer = '';
        try { answer = await transcribeAudio(audioBase64); } catch { /* empty answer is valid */ }
        if (cancelled) return;

        // Evaluate
        setPhase('evaluating');
        entries.push({ question, answer });
        lastQuality = computeQuality(answer);
        await new Promise((r) => setTimeout(r, 300));
        if (cancelled) return;
      }

      setPhase('finishing');
      onFinish(entries);
    }

    void runSession();

    return () => {
      cancelled = true;
      abortRef.current = true;
      cleanup();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleEnd() {
    abortRef.current = true;
    cleanup();
    onExit();
  }

  return (
    <>
      <style>{ORB_CSS}</style>
      <div style={s.root}>
        <div style={s.inner}>
          {/* Progress */}
          <div style={s.progressRow}>
            <span style={s.progressLabel}>
              Question {questionNumber} / {TOTAL_QUESTIONS}
            </span>
            <button style={s.endBtn} onClick={handleEnd}>End Interview</button>
          </div>

          {/* Orb */}
          <div style={s.orbWrap}>
            <div style={getOrbStyle(phase)} />
          </div>

          {/* Phase label */}
          <div style={s.phaseLabel}>{phaseLabel(phase, questionNumber, TOTAL_QUESTIONS)}</div>

          {/* Current question text */}
          {currentQuestion && (phase === 'speaking' || phase === 'waiting' || phase === 'listening') && (
            <div style={s.questionBox}>
              <p style={s.questionText}>{currentQuestion}</p>
            </div>
          )}

          {/* Error */}
          {phase === 'error' && (
            <div style={s.errorBox}>
              <p style={s.errorText}>{errorMsg}</p>
              <button style={s.retryBtn} onClick={handleEnd}>Exit</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

const s: Record<string, CSSProperties> = {
  root: {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(7, 7, 11, 0.97)',
    borderRadius: '16px',
    fontFamily: SANS,
  },
  inner: {
    width: '100%',
    maxWidth: '340px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
    padding: '0 16px',
    WebkitAppRegion: 'no-drag' as unknown as undefined,
  },
  progressRow: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.28)',
    letterSpacing: '0.3px',
    fontFamily: SANS,
  },
  endBtn: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '4px',
    color: 'rgba(255,255,255,0.30)',
    fontSize: '10px',
    fontFamily: SANS,
    padding: '3px 8px',
    cursor: 'pointer',
    transition: 'opacity 120ms ease',
  },
  orbWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px 0',
  },
  phaseLabel: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.45)',
    fontFamily: SANS,
    letterSpacing: '0.1px',
    textAlign: 'center' as const,
  },
  questionBox: {
    width: '100%',
    padding: '12px 14px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '8px',
    maxHeight: '120px',
    overflowY: 'auto',
  },
  questionText: {
    margin: 0,
    fontSize: '12px',
    color: 'rgba(255,255,255,0.70)',
    fontFamily: SANS,
    lineHeight: '1.55',
  },
  errorBox: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  },
  errorText: {
    margin: 0,
    fontSize: '11px',
    color: 'rgba(248,113,113,0.85)',
    textAlign: 'center' as const,
    fontFamily: SANS,
  },
  retryBtn: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '6px',
    color: 'rgba(255,255,255,0.55)',
    fontSize: '11px',
    fontFamily: SANS,
    padding: '7px 16px',
    cursor: 'pointer',
  },
};
