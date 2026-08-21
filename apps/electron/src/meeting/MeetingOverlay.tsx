import { useState, useRef, useEffect, type CSSProperties } from 'react';
import AnswerStream from '../overlay/AnswerStream';
import { API_URL, blobToBase64, makeDeviceHeaders } from '../utils';

interface MeetingOverlayProps {
  docText: string;
  docFilename: string;
  onEnd: () => void;
  onLogout: () => void;
}

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";

export default function MeetingOverlay({ docText, docFilename, onEnd, onLogout }: MeetingOverlayProps) {
  const [answer, setAnswer] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamAbortRef = useRef<AbortController | null>(null);
  const handleListenRef = useRef<() => void>(() => {});
  const handleClearRef = useRef<() => void>(() => {});

  async function startListen(): Promise<void> {
    const granted = await window.zoomguru.requestMicPermission();
    if (!granted) { setAnswer('Microphone permission denied.'); return; }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch {
      setAnswer('Could not access microphone.');
      return;
    }

    const recorder = new MediaRecorder(stream);
    recorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      setIsStreaming(true);
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      const audioBase64 = await blobToBase64(blob);

      try {
        const [token, deviceHeaders] = await Promise.all([
          window.zoomguru.getToken(),
          makeDeviceHeaders(),
        ]);
        const transcribeRes = await fetch(`${API_URL}/ai/transcribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            ...deviceHeaders,
          },
          body: JSON.stringify({ audio: audioBase64 }),
        });
        if (!transcribeRes.ok) {
          setAnswer('Transcription failed. Try again.');
          setIsStreaming(false);
          return;
        }
        const { transcript } = await transcribeRes.json() as { transcript: string };
        if (!transcript.trim()) {
          setAnswer('No speech detected.');
          setIsStreaming(false);
          return;
        }
        await streamMeetingAnswer(transcript);
      } catch {
        setAnswer('Network error. Check connection.');
        setIsStreaming(false);
      }
    };

    recorder.start();
    setIsListening(true);
  }

  function stopListen(): void {
    recorderRef.current?.stop();
    setIsListening(false);
  }

  handleListenRef.current = () => {
    if (isListening) { stopListen(); return; }
    if (isStreaming) return;
    void startListen();
  };

  handleClearRef.current = () => {
    streamAbortRef.current?.abort();
    setAnswer('');
    setIsStreaming(false);
  };

  async function streamMeetingAnswer(transcript: string): Promise<void> {
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
      const response = await fetch(`${API_URL}/ai/meeting-stream`, {
        method: 'POST',
        signal: abortCtrl.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...deviceHeaders,
        },
        body: JSON.stringify({ transcript, docText }),
      });

      if (response.status === 401) { onLogout(); return; }
      if (response.status === 403) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        if (body.error === 'subscription_required') { onEnd(); return; }
        setAnswer('Access denied. Check your subscription.');
        return;
      }
      if (response.status === 429) {
        const data = await response.json() as { error?: string; retryAfter?: number };
        setAnswer(`Rate limited. Try again in ${data.retryAfter ?? 60}s.`);
        return;
      }
      if (!response.body) { setAnswer('No response from server.'); return; }

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

  useEffect(() => {
    return () => { streamAbortRef.current?.abort(); };
  }, []);

  function fbg(id: string, activeColor?: string): CSSProperties {
    const isH = hovered === id;
    if (activeColor) {
      return { background: isH ? activeColor.replace('0.07', '0.12') : activeColor };
    }
    return { background: isH ? 'rgba(255,255,255,0.05)' : 'transparent' };
  }

  return (
    <>
      <style>{`
        .zg-fbtn:active:not([disabled]) { transform: scale(0.96) !important; }
        .zg-ibtn:hover {
          background: rgba(255,255,255,0.07) !important;
          color: rgba(255,255,255,0.60) !important;
        }
        .zg-scroll::-webkit-scrollbar { width: 2px; }
        .zg-scroll::-webkit-scrollbar-track { background: transparent; }
        .zg-scroll::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.08);
          border-radius: 2px;
        }
      `}</style>

      <div style={s.root}>

        {/* ── Header ── */}
        <div style={s.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
            <span style={s.wordmark}>Meeting</span>
            <span style={s.docPill} title={docFilename}>{docFilename}</span>
          </div>

          <div style={s.headerRight}>
            {isListening && (
              <span style={s.statusRec}>
                <span style={s.recDot} />
                REC
              </span>
            )}
            {isStreaming && <span style={s.statusGen}>GEN</span>}

            <button
              className="zg-ibtn"
              style={s.iconBtn}
              onClick={onEnd}
              aria-label="End meeting"
              title="End Meeting"
            >
              End
            </button>
            <button
              className="zg-ibtn"
              style={s.iconBtn}
              onClick={onLogout}
              aria-label="Log out"
            >
              Logout
            </button>
            {window.zoomguru.platform === 'darwin' ? (
              <button
                style={s.macCloseBtn}
                onClick={() => { void window.zoomguru.quitApp(); }}
                aria-label="Quit"
              />
            ) : (
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
        <AnswerStream answer={answer} isStreaming={isStreaming} />

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
              opacity: isStreaming ? 0.35 : 1,
            }}
            onMouseEnter={() => setHovered('listen')}
            onMouseLeave={() => setHovered(null)}
            onClick={() => handleListenRef.current()}
            disabled={isStreaming}
            aria-label={isListening ? 'Stop recording' : 'Start listening'}
          >
            <span style={s.btnLabel}>{isListening ? 'Stop' : 'Listen'}</span>
          </button>

          <button
            className="zg-fbtn"
            style={{ ...s.footerBtn, ...fbg('clear') }}
            onMouseEnter={() => setHovered('clear')}
            onMouseLeave={() => setHovered(null)}
            onClick={() => handleClearRef.current()}
            aria-label="Clear answer"
          >
            <span style={s.btnLabel}>Clear</span>
          </button>
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
    flexDirection: 'column',
    background: 'rgba(7,7,11,0.97)',
    borderRadius: '16px',
    overflow: 'hidden',
    fontFamily: FONT,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 10px 0 14px',
    height: '36px',
    flexShrink: 0,
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  wordmark: {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.4px',
    color: 'rgba(255,255,255,0.55)',
    fontFamily: FONT,
    flexShrink: 0,
  },
  docPill: {
    fontSize: '9px',
    color: 'rgba(255,255,255,0.22)',
    fontFamily: FONT,
    maxWidth: '120px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    flexShrink: 0,
  },
  statusRec: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '9px',
    fontWeight: 700,
    color: '#f43f5e',
    letterSpacing: '0.6px',
    fontFamily: FONT,
  },
  recDot: {
    width: '5px',
    height: '5px',
    borderRadius: '50%',
    background: '#f43f5e',
    animation: 'zg-pulse 1.2s ease-in-out infinite',
  },
  statusGen: {
    fontSize: '9px',
    fontWeight: 700,
    color: 'rgba(99,102,241,0.75)',
    letterSpacing: '0.6px',
    fontFamily: FONT,
  },
  iconBtn: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.28)',
    fontSize: '10px',
    cursor: 'pointer',
    padding: '4px 6px',
    borderRadius: '4px',
    fontFamily: FONT,
    transition: 'background 120ms ease, color 120ms ease',
    letterSpacing: '0.2px',
  },
  macCloseBtn: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.15)',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    flexShrink: 0,
  },
  winCloseBtn: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.22)',
    fontSize: '11px',
    cursor: 'pointer',
    padding: '3px 6px',
    borderRadius: '4px',
    fontFamily: FONT,
    transition: 'background 120ms ease, color 120ms ease',
    lineHeight: '1',
  },
  footer: {
    display: 'flex',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    flexShrink: 0,
  },
  footerBtn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '3px',
    height: '46px',
    background: 'transparent',
    border: 'none',
    borderTop: '2px solid transparent',
    cursor: 'pointer',
    transition: 'background 120ms ease',
  },
  btnLabel: {
    fontSize: '10px',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.38)',
    fontFamily: FONT,
    letterSpacing: '0.4px',
    textTransform: 'uppercase',
    lineHeight: '1',
  },
};
