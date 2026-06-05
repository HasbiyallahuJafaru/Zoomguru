import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { makeDeviceHeaders } from '../../utils';

type ES = CSSProperties & { WebkitAppRegion?: 'drag' | 'no-drag' };

const SANS = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
const API_URL = import.meta.env.VITE_API_URL || 'https://zoomguru.onrender.com';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function serializeDoc(doc: ParsedDoc): string {
  if (doc.fileType === 'pdf') {
    const pages = doc.parsedContent as ParsedPdfPage[];
    return pages
      .filter((p) => !p.isEmpty)
      .map((p) => `--- Page ${p.pageNumber} ---\n${p.text}`)
      .join('\n\n');
  }
  const slides = doc.parsedContent as ParsedSlide[];
  return slides
    .map((sl) => {
      let out = `--- Slide ${sl.slideNumber}${sl.title ? `: ${sl.title}` : ''} ---\n`;
      if (sl.textBlocks.length > 0) out += sl.textBlocks.join('\n') + '\n';
      for (const tbl of sl.tables) {
        out += '\nTable:\n';
        if (tbl.headers.length > 0) out += tbl.headers.join(' | ') + '\n';
        for (const row of tbl.rows) out += row.join(' | ') + '\n';
      }
      if (sl.chartWarnings.length > 0) out += '\n' + sl.chartWarnings.join('\n') + '\n';
      return out;
    })
    .join('\n');
}

function makeCacheKey(docs: ParsedDoc[]): string {
  return docs.map((d) => d.docId).sort().join(':');
}

interface Props {
  docs: ParsedDoc[];
  onBackToSetup: () => void;
}

type ListenState = 'idle' | 'recording' | 'processing' | 'streaming';

export default function DocCopilotOverlay({ docs, onBackToSetup }: Props) {
  const [listenState, setListenState] = useState<ListenState>('idle');
  const [answer, setAnswer]           = useState('');
  const [error, setError]             = useState('');

  const recorderRef      = useRef<MediaRecorder | null>(null);
  const chunksRef        = useRef<BlobPart[]>([]);
  const streamAbortRef   = useRef<AbortController | null>(null);
  const handleListenRef  = useRef<() => void>(() => {});
  const handleClearRef   = useRef<() => void>(() => {});

  // Hotkey listeners from main process
  useEffect(() => {
    window.zoomguru.onTrigger('doccopilot-listen', () => { handleListenRef.current(); });
    window.zoomguru.onTrigger('doccopilot-clear',  () => { handleClearRef.current(); });
    return () => {
      window.zoomguru.offTrigger('doccopilot-listen');
      window.zoomguru.offTrigger('doccopilot-clear');
    };
  }, []);

  handleClearRef.current = () => {
    streamAbortRef.current?.abort();
    recorderRef.current?.stop();
    setAnswer('');
    setError('');
    setListenState('idle');
  };

  async function streamDocAnswer(transcript: string): Promise<void> {
    streamAbortRef.current?.abort();
    const ctrl = new AbortController();
    streamAbortRef.current = ctrl;

    setAnswer('');
    setError('');
    setListenState('streaming');

    try {
      const [token, deviceHeaders] = await Promise.all([
        window.zoomguru.getToken(),
        makeDeviceHeaders(),
      ]);

      const serializedDocs = docs.map((d) => ({
        docId: d.docId,
        fileName: d.fileName,
        serializedContent: serializeDoc(d),
      }));

      const cacheKey = makeCacheKey(docs);

      const res = await fetch(`${API_URL}/ai/doc-copilot`, {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...deviceHeaders,
        },
        body: JSON.stringify({ transcript, documents: serializedDocs, cacheKey }),
      });

      if (res.status === 401) { setError('Session expired — reopen Doc Copilot.'); return; }
      if (res.status === 403) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setError(body.error === 'subscription_required' ? 'Subscription required.' : 'Access denied.');
        return;
      }
      if (res.status === 429) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        setError(body.error === 'quota_exceeded' ? 'Doc Copilot quota reached for this period.' : 'Too many requests. Try again shortly.');
        return;
      }
      if (!res.ok || !res.body) { setError('Request failed. Please try again.'); return; }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data) as { chunk?: string; done?: boolean };
            if (parsed.chunk) setAnswer((prev) => prev + parsed.chunk);
            if (parsed.done) break;
          } catch { /* skip malformed */ }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError('Connection failed. Check your network.');
    } finally {
      setListenState('idle');
    }
  }

  handleListenRef.current = () => {
    if (listenState === 'recording') {
      recorderRef.current?.stop();
      return;
    }
    if (listenState !== 'idle') return;

    void (async () => {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        setError('Microphone access denied.');
        return;
      }

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setListenState('processing');
        void (async () => {
          try {
            const blob = new Blob(chunksRef.current, { type: mimeType });
            if (blob.size < 5000) { setListenState('idle'); return; }
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
            if (!res.ok) { setListenState('idle'); return; }
            const data = await res.json() as { transcript?: string };
            const transcript = data.transcript?.trim() ?? '';
            if (!transcript || transcript.split(/\s+/).length < 2) { setListenState('idle'); return; }
            await streamDocAnswer(transcript);
          } catch {
            setListenState('idle');
          }
        })();
      };

      recorderRef.current = recorder;
      setListenState('recording');
      recorder.start(100);
    })();
  };

  const isListening  = listenState === 'recording';
  const isProcessing = listenState === 'processing' || listenState === 'streaming';
  const canListen    = listenState === 'idle';

  return (
    <>
      <style>{`
        .zg-doc-listen:hover:not(:disabled) { opacity: 0.85; }
        .zg-doc-back:hover { color: rgba(255,255,255,0.55) !important; }
        .zg-doc-clear:hover:not(:disabled) { color: rgba(255,255,255,0.55) !important; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.45} }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={s.root}>
        {/* Drag handle + controls */}
        <div style={s.topBar}>
          <div style={s.docPills}>
            {docs.map((d) => (
              <span key={d.docId} style={s.docPill} title={d.fileName}>
                {d.fileType === 'pdf' ? '📑' : '📊'} {d.fileName.length > 18 ? d.fileName.slice(0, 16) + '…' : d.fileName}
              </span>
            ))}
          </div>
          <div style={s.topActions}>
            <button
              className="zg-doc-back"
              style={s.backBtn}
              onClick={onBackToSetup}
              title="Back to document setup"
            >
              ← Docs
            </button>
            <button
              className="zg-doc-clear"
              style={s.clearBtn}
              disabled={!answer && !error}
              onClick={handleClearRef.current}
              title="Clear answer (Ctrl+Shift+N)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Answer area */}
        {(answer || error) && (
          <div style={s.answerArea}>
            {error ? (
              <p style={s.errorText}>{error}</p>
            ) : (
              <p style={s.answerText}>{answer}</p>
            )}
          </div>
        )}

        {/* Listen button */}
        <div style={s.listenRow}>
          {isProcessing ? (
            <div style={s.processingRow}>
              <span style={{ ...s.spinner }} />
              <span style={s.processingLabel}>
                {listenState === 'processing' ? 'Transcribing…' : 'Searching docs…'}
              </span>
            </div>
          ) : (
            <button
              className="zg-doc-listen"
              style={{
                ...s.listenBtn,
                ...(isListening ? s.listenBtnActive : s.listenBtnIdle),
                ...((!canListen && !isListening) ? { cursor: 'not-allowed', opacity: 0.4 } : {}),
              }}
              disabled={!canListen && !isListening}
              onClick={handleListenRef.current}
            >
              {isListening ? (
                <>
                  <span style={s.recordDot} /> Recording… (click to stop)
                </>
              ) : (
                <>
                  🎙 Ask from docs
                  <span style={s.hotkey}>Ctrl+Shift+M</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

const s: Record<string, ES> = {
  root: {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '10px 12px',
    fontFamily: SANS,
    WebkitAppRegion: 'drag',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    WebkitAppRegion: 'drag',
  },
  docPills: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '4px',
    flex: 1,
    minWidth: 0,
  },
  docPill: {
    fontSize: '9px',
    color: 'rgba(255,255,255,0.40)',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '4px',
    padding: '2px 6px',
    fontFamily: SANS,
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '140px',
  },
  topActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    WebkitAppRegion: 'no-drag',
    flexShrink: 0,
  },
  backBtn: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.30)',
    fontSize: '10px',
    cursor: 'pointer',
    padding: '3px 6px',
    fontFamily: SANS,
    transition: 'color 120ms ease',
    borderRadius: '4px',
  },
  clearBtn: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.22)',
    fontSize: '11px',
    cursor: 'pointer',
    padding: '3px 5px',
    fontFamily: SANS,
    transition: 'color 120ms ease',
    borderRadius: '4px',
  },
  answerArea: {
    flex: 1,
    background: 'rgba(7,7,11,0.88)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px',
    padding: '12px 14px',
    overflowY: 'auto',
    WebkitAppRegion: 'no-drag',
  },
  answerText: {
    fontSize: '12px',
    lineHeight: '1.65',
    color: 'rgba(255,255,255,0.88)',
    fontFamily: SANS,
    margin: 0,
    whiteSpace: 'pre-wrap' as const,
  },
  errorText: {
    fontSize: '11px',
    color: 'rgba(248,113,113,0.85)',
    fontFamily: SANS,
    margin: 0,
  },
  listenRow: {
    WebkitAppRegion: 'no-drag',
  },
  listenBtn: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '8px',
    fontSize: '11px',
    fontWeight: 500,
    fontFamily: SANS,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'opacity 120ms ease',
    letterSpacing: '0.1px',
  },
  listenBtnIdle: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: 'rgba(255,255,255,0.65)',
  },
  listenBtnActive: {
    background: 'rgba(248,113,113,0.12)',
    border: '1px solid rgba(248,113,113,0.30)',
    color: 'rgba(248,113,113,0.90)',
    animation: 'pulse 1.4s ease-in-out infinite',
  },
  recordDot: {
    width: '7px',
    height: '7px',
    background: 'rgba(248,113,113,0.9)',
    borderRadius: '50%',
    display: 'inline-block',
    flexShrink: 0,
  },
  hotkey: {
    fontSize: '9px',
    color: 'rgba(255,255,255,0.22)',
    fontFamily: SANS,
    marginLeft: '4px',
  },
  processingRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '10px',
  },
  spinner: {
    display: 'inline-block',
    width: '12px',
    height: '12px',
    border: '2px solid rgba(255,255,255,0.15)',
    borderTopColor: 'rgba(255,255,255,0.65)',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
    flexShrink: 0,
  },
  processingLabel: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.45)',
    fontFamily: SANS,
  },
};
