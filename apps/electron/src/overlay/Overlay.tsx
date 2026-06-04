import { useState, useEffect, useRef, type CSSProperties } from 'react';
import AnswerStream from './AnswerStream';
import { formatCountdown } from '../utils';
import { useCVContext } from './hooks/useCVContext';
import { useSessionCap } from './hooks/useSessionCap';
import { useTrialCountdown } from './hooks/useTrialCountdown';
import { useHotkeys } from './hooks/useHotkeys';
import { useVAD } from './hooks/useVAD';
import { createDenoisedStream } from './noise-suppressor';

type ElectronStyle = CSSProperties & { WebkitAppRegion?: 'drag' | 'no-drag' };

const API_URL = import.meta.env.VITE_API_URL || 'https://zoomguru.onrender.com';
const FONT  = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
const SERIF = "'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif";
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

export default function Overlay({ onLogout, onTrialExpired, onOpenReferral }: { onLogout: () => void; onTrialExpired?: () => void; onOpenReferral?: () => void }) {
  // --- state ---
  const { cvText, jdText } = useCVContext();

  const [answer, setAnswer] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [micGranted, setMicGranted] = useState(false);
  const {
    questionCount,
    questionCountRef,
    sessionCap,
    sessionCapRef,
    setSessionCap,
    sessionCapped,
    increment: incrementQuestion,
    reset: resetQuestionCount,
  } = useSessionCap();

  const { trialMsLeft } = useTrialCountdown(setSessionCap, onTrialExpired);

  const [hovered, setHovered] = useState<string | null>(null);
  const [screenshotContext, setScreenshotContext] = useState<string[]>([]);
  const [noiseEnabled, setNoiseEnabled] = useState(true);
  const noiseEnabledRef = useRef(true);

  // --- refs (manual listen) ---
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const handleListenRef = useRef<() => void>(() => {});
  const handleScreenshotRef = useRef<() => void>(() => {});
  const handleClearRef = useRef<() => void>(() => {});
  const handleAutoRef = useRef<() => void>(() => {});
  const streamAbortRef = useRef<AbortController | null>(null);

  // --- streaming ---

  async function streamAnswer(transcript: string): Promise<void> {
    streamAbortRef.current?.abort();
    const abortCtrl = new AbortController();
    streamAbortRef.current = abortCtrl;
    setAnswer('');
    setIsStreaming(true);
    try {
      const [token, deviceHeaders] = await Promise.all([
        window.zoomguru.getToken(),
        makeDeviceHeaders(),
      ]);
      const response = await fetch(`${API_URL}/ai/stream`, {
        method: 'POST',
        signal: abortCtrl.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...deviceHeaders,
        },
        body: JSON.stringify({
          transcript,
          ...(cvText ? { cvText } : {}),
          ...(jdText ? { jdText } : {}),
        }),
      });
      if (response.status === 401) { onLogout(); return; }
      if (response.status === 403) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        if (body.error === 'subscription_required') { onTrialExpired?.(); return; }
        setAnswer('Subscription is locked to another device.');
        return;
      }
      if (response.status === 429) {
        const data = await response.json() as { error?: string; retryAfter?: number };
        if (data.error === 'session_cap') {
          setAnswer('Daily session limit reached. Try again tomorrow.');
        } else {
          setAnswer(`Rate limited. Try again in ${data.retryAfter ?? 60}s.`);
        }
        return;
      }
      if (!response.body) { setAnswer('No response from server.'); return; }
      incrementQuestion();
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw || raw === '[DONE]') continue;
          const data: { chunk?: string; done?: boolean } = JSON.parse(raw);
          if (data.done) return;
          if (data.chunk) setAnswer((prev) => prev + data.chunk);
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setAnswer('Connection error. Check backend.');
      }
    } finally {
      setIsStreaming(false);
    }
  }

  async function streamScreenshot(imageBase64: string): Promise<void> {
    streamAbortRef.current?.abort();
    const abortCtrl = new AbortController();
    streamAbortRef.current = abortCtrl;
    setAnswer('');
    setIsStreaming(true);
    try {
      const [token, deviceHeaders] = await Promise.all([
        window.zoomguru.getToken(),
        makeDeviceHeaders(),
      ]);
      const response = await fetch(`${API_URL}/ai/screenshot`, {
        method: 'POST',
        signal: abortCtrl.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...deviceHeaders,
        },
        body: JSON.stringify({
          image: imageBase64,
          ...(cvText ? { cvText } : {}),
          ...(jdText ? { jdText } : {}),
          ...(screenshotContext.length > 0 ? { priorContext: screenshotContext } : {}),
        }),
      });
      if (response.status === 401) { onLogout(); return; }
      if (response.status === 403) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        if (body.error === 'subscription_required') { onTrialExpired?.(); return; }
        setAnswer('Subscription is locked to another device.');
        return;
      }
      if (response.status === 429) {
        const data = await response.json() as { error?: string; retryAfter?: number };
        if (data.error === 'session_cap') {
          setAnswer('Daily session limit reached. Try again tomorrow.');
        } else {
          setAnswer(`Rate limited. Try again in ${data.retryAfter ?? 60}s.`);
        }
        return;
      }
      if (!response.body) { setAnswer('No response from server.'); return; }
      incrementQuestion();
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw || raw === '[DONE]') continue;
          const data: { chunk?: string; done?: boolean; contextSummary?: string } = JSON.parse(raw);
          if (data.done) {
            if (data.contextSummary) {
              setScreenshotContext((prev) => [...prev, data.contextSummary!].slice(-5));
            }
            return;
          }
          if (data.chunk) setAnswer((prev) => prev + data.chunk);
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setAnswer('Connection error. Check backend.');
      }
    } finally {
      setIsStreaming(false);
    }
  }

  // --- VAD ---

  const {
    isAutoMode,
    isAutoListening,
    isAutoModeRef,
    stopAutoMode,
    startAutoMode,
  } = useVAD({
    sessionCapped,
    questionCountRef,
    sessionCapRef,
    streamAnswer,
    setMicGranted,
    onLogout,
    noiseEnabled,
  });

  // --- handler refs ---

  handleListenRef.current = async () => {
    if (sessionCapped || isAutoMode) return;
    if (isListening && recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
      return;
    }
    if (isStreaming) return;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMicGranted(false);
      setAnswer('Mic access denied. Allow microphone in system settings.');
      return;
    }

    // Apply noise suppression before encoding
    let recordStream = stream;
    let noiseCleanup: (() => void) | null = null;
    if (noiseEnabledRef.current) {
      try {
        const result = await createDenoisedStream(stream);
        recordStream = result.denoisedStream;
        noiseCleanup = result.cleanup;
      } catch {
        recordStream = stream;
      }
    }

    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';
    const recorder = new MediaRecorder(recordStream, { mimeType });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      noiseCleanup?.();
      setIsListening(false);

      void (async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size === 0) {
          setAnswer('No audio captured. Speak and try again.');
          return;
        }

        let token: string;
        let base64: string;
        let deviceHeaders: Record<string, string>;
        try {
          [token, base64, deviceHeaders] = await Promise.all([
            window.zoomguru.getToken(),
            blobToBase64(blob),
            makeDeviceHeaders(),
          ]);
        } catch {
          setAnswer('Audio encoding error. Try again.');
          return;
        }

        try {
          const res = await fetch(`${API_URL}/ai/transcribe`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
              ...deviceHeaders,
            },
            body: JSON.stringify({ audio: base64 }),
          });
          if (res.status === 401) { onLogout(); return; }
          if (res.status === 403) {
            const body = await res.json().catch(() => ({})) as { error?: string };
            if (body.error === 'subscription_required') { onTrialExpired?.(); return; }
            setAnswer('Subscription is locked to another device.');
            return;
          }
          if (!res.ok) {
            setAnswer('Transcription failed. Check backend logs.');
            return;
          }
          const data = await res.json() as { transcript?: string };
          if (data.transcript?.trim()) {
            void streamAnswer(data.transcript);
          } else {
            setAnswer('No speech detected. Speak clearly and try again.');
          }
        } catch {
          setAnswer('Transcription error. Check your connection.');
        }
      })();
    };

    recorderRef.current = recorder;
    setIsListening(true);
    recorder.start();

    const autoStop = setTimeout(() => {
      if (recorder.state === 'recording') recorder.stop();
    }, 30_000);
    recorder.addEventListener('stop', () => clearTimeout(autoStop), { once: true });
  };

  handleScreenshotRef.current = async () => {
    if (sessionCapped) return;
    if (isStreaming) return;
    const imageBase64 = await window.zoomguru.captureScreen();
    await streamScreenshot(imageBase64);
  };

  handleClearRef.current = () => {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    stopAutoMode();
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    setAnswer('');
    setIsStreaming(false);
    setIsListening(false);
    resetQuestionCount();
    setScreenshotContext([]);
    chunksRef.current = [];
  };

  handleAutoRef.current = () => {
    if (isAutoModeRef.current) { stopAutoMode(); } else { void startAutoMode(); }
  };

  function toggleNoise(): void {
    const next = !noiseEnabledRef.current;
    noiseEnabledRef.current = next;
    setNoiseEnabled(next);
    void window.zoomguru.setNoiseSuppressor(next);
  }

  useHotkeys(
    () => handleListenRef.current(),
    () => handleScreenshotRef.current(),
    () => handleClearRef.current(),
    () => handleAutoRef.current(),
  );

  // --- mount ---

  useEffect(() => {
    void window.zoomguru.getNoiseSuppressor().then((v) => {
      noiseEnabledRef.current = v;
      setNoiseEnabled(v);
    });

    void window.zoomguru.requestMicPermission().then((osGranted) => {
      if (!osGranted) {
        setMicGranted(false);
        return;
      }
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then((s) => { s.getTracks().forEach((t) => t.stop()); setMicGranted(true); })
        .catch(() => setMicGranted(false));
    });

    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      stopAutoMode();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // --- helpers ---

  const isRec = isListening || isAutoListening;
  const isGen = isStreaming;
  const isAutoOn = isAutoMode && !isAutoListening;

  function fbg(id: string, activeColor?: string): CSSProperties {
    const isH = hovered === id;
    if (activeColor) {
      return { background: isH ? activeColor.replace('0.07', '0.12') : activeColor };
    }
    return { background: isH ? 'rgba(255,255,255,0.05)' : 'transparent' };
  }

  // --- render ---

  return (
    <>
      <style>{`
        @keyframes zg-pulse {
          0%, 100% { opacity: 1 }
          50% { opacity: 0.3 }
        }
        @keyframes zg-refer-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(251,191,36,0.55); }
          50% { box-shadow: 0 0 0 5px rgba(251,191,36,0); }
        }
        .zg-fbtn:active:not([disabled]) {
          transform: scale(0.96) !important;
        }
        .zg-ibtn:hover {
          background: rgba(255,255,255,0.07) !important;
          color: rgba(255,255,255,0.60) !important;
        }
      `}</style>

      <div style={s.root}>

        {/* ── Header ── */}
        <div style={s.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={s.wordmark}>ZoomGuru</span>
            {onOpenReferral && (
              <button
                className="zg-ibtn"
                style={s.referralBtn}
                onClick={onOpenReferral}
                aria-label="Referral programme"
              >
                Refer
              </button>
            )}
          </div>

          <div style={s.headerRight}>
            {/* Status */}
            {isRec && (
              <span style={s.statusRec}>
                <span style={s.recDot} />
                REC
              </span>
            )}
            {isAutoOn && !isGen && (
              <span style={s.statusAuto}>AUTO</span>
            )}
            {isGen && (
              <span style={s.statusGen}>GEN</span>
            )}
            {!micGranted && <span style={s.statusWarn}>no mic</span>}
            {!isOnline && <span style={s.statusWarn}>offline</span>}
            {questionCount > 0 && !sessionCapped && (
              <span style={s.sessionCount}>
                {sessionCap === Infinity ? questionCount : `${questionCount}/${sessionCap}`}
              </span>
            )}

            {/* Trial countdown */}
            {trialMsLeft !== null && trialMsLeft > 0 && (
              <span style={s.trialTimer}>{formatCountdown(trialMsLeft)}</span>
            )}

            {/* Buttons */}
            <button
              className="zg-ibtn"
              style={{
                ...s.logoutBtn,
                color: noiseEnabled ? 'rgba(16,185,129,0.70)' : 'rgba(255,255,255,0.22)',
              }}
              onClick={toggleNoise}
              aria-label={noiseEnabled ? 'Noise suppressor on — click to disable' : 'Noise suppressor off — click to enable'}
              title={noiseEnabled ? 'Noise: ON' : 'Noise: OFF'}
            >
              NS
            </button>
            <button
              className="zg-ibtn"
              style={s.logoutBtn}
              onClick={() => { stopAutoMode(); onLogout(); }}
              aria-label="Log out"
            >
              Logout
            </button>
            {window.zoomguru.platform === 'darwin' ? (
              /* Mac — traffic-light circle */
              <button
                style={s.macCloseBtn}
                onClick={() => { void window.zoomguru.quitApp(); }}
                aria-label="Quit"
              />
            ) : (
              /* Windows — square × */
              <button
                className="zg-ibtn"
                style={s.winCloseBtn}
                onClick={() => { void window.zoomguru.quitApp(); }}
                aria-label="Quit"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* ── Content ── */}
        {sessionCapped ? (
          <div style={s.capNotice}>
            <span style={s.capCount}>{sessionCap} / {sessionCap}</span>
            <p style={s.capMessage}>Session complete</p>
            <p style={s.capSub}>Start a new session to continue.</p>
            <button style={s.newSessionBtn} onClick={() => handleClearRef.current()}>
              New Session
            </button>
          </div>
        ) : (
          <AnswerStream answer={answer} isStreaming={isStreaming} />
        )}

        {/* ── Footer ── */}
        <div style={s.footer}>
          <button
            className="zg-fbtn"
            style={{
              ...s.footerBtn,
              ...(isListening
                ? { borderTop: '2px solid #f43f5e', ...fbg('listen', 'rgba(244,63,94,0.07)') }
                : fbg('listen')
              ),
              opacity: isStreaming || sessionCapped || isAutoMode ? 0.35 : 1,
            }}
            onMouseEnter={() => setHovered('listen')}
            onMouseLeave={() => setHovered(null)}
            onClick={() => { void handleListenRef.current(); }}
            disabled={isStreaming || sessionCapped || isAutoMode}
            aria-label={isListening ? 'Stop recording' : 'Start listening'}
          >
            <span style={s.btnLabel}>{isListening ? 'Stop' : 'Listen'}</span>
            <span style={s.btnHint}>⌘⇧L</span>
          </button>

          <button
            className="zg-fbtn"
            style={{
              ...s.footerBtn,
              ...fbg('screen'),
              opacity: isStreaming || sessionCapped ? 0.35 : 1,
            }}
            onMouseEnter={() => setHovered('screen')}
            onMouseLeave={() => setHovered(null)}
            onClick={() => { void handleScreenshotRef.current(); }}
            disabled={isStreaming || sessionCapped}
            aria-label="Screenshot"
          >
            <span style={s.btnLabel}>Screen</span>
            {screenshotContext.length > 0 && (
              <span style={{ fontSize: '8px', color: 'rgba(99,102,241,0.7)', fontFamily: FONT, lineHeight: '1', letterSpacing: '0.2px' }}>
                ctx {screenshotContext.length}
              </span>
            )}
            <span style={s.btnHint}>⌘⇧S</span>
          </button>

          <button
            className="zg-fbtn"
            style={{
              ...s.footerBtn,
              ...(isAutoListening
                ? { borderTop: '2px solid #f43f5e', ...fbg('auto', 'rgba(244,63,94,0.07)') }
                : isAutoMode
                ? { borderTop: '2px solid #10b981', ...fbg('auto', 'rgba(16,185,129,0.07)') }
                : fbg('auto')
              ),
              opacity: sessionCapped ? 0.35 : 1,
            }}
            onMouseEnter={() => setHovered('auto')}
            onMouseLeave={() => setHovered(null)}
            onClick={() => { if (isAutoMode) { stopAutoMode(); } else { void startAutoMode(); } }}
            disabled={sessionCapped}
            aria-label={isAutoMode ? 'Stop auto mode' : 'Start auto mode'}
          >
            <span style={s.btnLabel}>{isAutoMode ? 'Auto On' : 'Auto'}</span>
            <span style={s.btnHint}>⌘⇧D</span>
          </button>

          <button
            className="zg-fbtn"
            style={{ ...s.footerBtn, ...fbg('clear'), borderRight: 'none' }}
            onMouseEnter={() => setHovered('clear')}
            onMouseLeave={() => setHovered(null)}
            onClick={() => handleClearRef.current()}
            aria-label="Clear"
          >
            <span style={s.btnLabel}>{sessionCapped ? 'Reset' : 'Clear'}</span>
            <span style={s.btnHint}>⌘⇧C</span>
          </button>
        </div>

      </div>
    </>
  );
}

const s: Record<string, ElectronStyle> = {
  root: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    background: 'rgba(7, 7, 11, 0.60)',
    backdropFilter: 'blur(32px) saturate(180%)',
    WebkitBackdropFilter: 'blur(32px) saturate(180%)',
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.07)',
    fontFamily: FONT,
    overflow: 'hidden',
  },

  // Header
  header: {
    height: '40px',
    minHeight: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 12px 0 14px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    WebkitAppRegion: 'drag',
    flexShrink: 0,
  },
  wordmark: {
    fontSize: '15px',
    fontWeight: 400,
    fontStyle: 'italic',
    color: 'rgba(255,255,255,0.80)',
    letterSpacing: '0.1px',
    fontFamily: SERIF,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    WebkitAppRegion: 'no-drag',
  },

  // Status labels
  statusRec: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '0.6px',
    color: '#f43f5e',
    textTransform: 'uppercase',
    fontFamily: FONT,
  },
  recDot: {
    width: '5px',
    height: '5px',
    borderRadius: '50%',
    background: '#f43f5e',
    display: 'inline-block',
    animation: 'zg-pulse 1.2s ease-in-out infinite',
  },
  statusGen: {
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '0.6px',
    color: '#6366f1',
    textTransform: 'uppercase',
    fontFamily: FONT,
  },
  statusAuto: {
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '0.6px',
    color: '#10b981',
    textTransform: 'uppercase',
    fontFamily: FONT,
  },
  statusWarn: {
    fontSize: '9px',
    fontWeight: 500,
    letterSpacing: '0.3px',
    color: 'rgba(255,255,255,0.30)',
    textTransform: 'uppercase',
    fontFamily: FONT,
  },
  sessionCount: {
    fontSize: '9px',
    color: 'rgba(255,255,255,0.18)',
    letterSpacing: '0.3px',
    fontFamily: FONT,
  },

  // Icon buttons (header)
  iconBtn: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.25)',
    fontSize: '14px',
    lineHeight: '1',
    cursor: 'pointer',
    padding: '3px 5px',
    borderRadius: '4px',
    transition: 'background 120ms ease, color 120ms ease',
    WebkitAppRegion: 'no-drag',
    fontFamily: FONT,
  },

  // Mac traffic-light close button
  macCloseBtn: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    background: '#ff5f57',
    border: '0.5px solid rgba(0,0,0,0.18)',
    cursor: 'pointer',
    padding: 0,
    flexShrink: 0,
    WebkitAppRegion: 'no-drag',
    transition: 'filter 120ms ease',
  } as ElectronStyle,

  // Windows square × close button
  winCloseBtn: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.35)',
    fontSize: '11px',
    lineHeight: '1',
    cursor: 'pointer',
    padding: '3px 6px',
    borderRadius: '3px',
    transition: 'background 120ms ease, color 120ms ease',
    WebkitAppRegion: 'no-drag',
    fontFamily: FONT,
  } as ElectronStyle,
  trialTimer: {
    fontSize: '11px',
    fontWeight: 600,
    color: 'rgba(251,191,36,0.85)',
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '0.4px',
    fontFamily: FONT,
    padding: '2px 6px',
    background: 'rgba(251,191,36,0.10)',
    borderRadius: '4px',
    lineHeight: '1.4',
  },
  logoutBtn: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.28)',
    fontSize: '10px',
    fontWeight: 500,
    letterSpacing: '0.2px',
    lineHeight: '1',
    cursor: 'pointer',
    padding: '3px 6px',
    borderRadius: '4px',
    transition: 'background 120ms ease, color 120ms ease',
    WebkitAppRegion: 'no-drag',
    fontFamily: FONT,
  },

  referralBtn: {
    background: 'rgba(251,191,36,0.15)',
    border: '1px solid rgba(251,191,36,0.40)',
    color: 'rgba(251,191,36,0.90)',
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '0.2px',
    lineHeight: '1',
    cursor: 'pointer',
    padding: '3px 8px',
    borderRadius: '4px',
    transition: 'background 120ms ease',
    WebkitAppRegion: 'no-drag',
    fontFamily: FONT,
    animation: 'zg-refer-pulse 2s ease-in-out infinite',
  },

  // Session cap
  capNotice: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    padding: '16px',
  },
  capCount: {
    fontSize: '10px',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.14)',
    letterSpacing: '0.5px',
    fontFamily: FONT,
  },
  capMessage: {
    margin: '4px 0 0',
    fontSize: '13px',
    fontWeight: 500,
    color: 'rgba(255,255,255,0.60)',
    fontFamily: FONT,
  },
  capSub: {
    margin: '2px 0 16px',
    fontSize: '11px',
    color: 'rgba(255,255,255,0.22)',
    fontFamily: FONT,
  },
  newSessionBtn: {
    padding: '8px 22px',
    background: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    color: '#07070b',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: FONT,
    transition: 'background 120ms ease',
  },

  // Footer
  footer: {
    height: '52px',
    minHeight: '52px',
    display: 'flex',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    WebkitAppRegion: 'no-drag',
    flexShrink: 0,
  },
  footerBtn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    border: 'none',
    borderRight: '1px solid rgba(255,255,255,0.06)',
    borderTop: '2px solid transparent',
    cursor: 'pointer',
    padding: 0,
    transition: 'background 120ms ease, transform 100ms ease',
    WebkitAppRegion: 'no-drag',
  },
  btnLabel: {
    fontSize: '11px',
    fontWeight: 500,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: '1',
    fontFamily: FONT,
    letterSpacing: '0.1px',
  },
  btnHint: {
    fontSize: '9px',
    color: 'rgba(255,255,255,0.18)',
    lineHeight: '1',
    fontFamily: FONT,
  },
};
