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

function parseStatusColor(doc: ParsedDoc): string {
  if (doc.warnings.length === 0) return 'rgba(74,222,128,0.75)';
  if (doc.warnings.some((w) => w.toLowerCase().includes('chart'))) return 'rgba(251,191,36,0.75)';
  return 'rgba(251,146,60,0.80)';
}

function parseStatusLabel(doc: ParsedDoc): string {
  if (doc.warnings.length === 0) return 'Parsed';
  if (doc.warnings.some((w) => w.toLowerCase().includes('chart'))) return 'Charts flagged';
  return 'Partial parse';
}

function docMeta(doc: ParsedDoc): string {
  if (doc.fileType === 'pdf') return `PDF · ${doc.pageCount ?? '?'} pages`;
  return `PPTX · ${doc.slideCount ?? '?'} slides`;
}

interface Props {
  docs: ParsedDoc[];
  onBackToSetup: () => void;
  isParsing: boolean;
  onAddDoc: () => void;
  onRemoveDoc: (docId: string) => void;
}

type ListenState = 'idle' | 'recording' | 'processing' | 'streaming';

export default function DocCopilotOverlay({ docs, onBackToSetup, isParsing, onAddDoc, onRemoveDoc }: Props) {
  const [listenState, setListenState] = useState<ListenState>('idle');
  const [answer, setAnswer]           = useState('');
  const [error, setError]             = useState('');
  const [trayOpen, setTrayOpen]       = useState(false);

  const recorderRef         = useRef<MediaRecorder | null>(null);
  const chunksRef           = useRef<BlobPart[]>([]);
  const streamAbortRef      = useRef<AbortController | null>(null);
  const transcribeAbortRef  = useRef<AbortController | null>(null);
  const handleListenRef     = useRef<() => void>(() => {});
  const handleClearRef      = useRef<() => void>(() => {});

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
    transcribeAbortRef.current?.abort();
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
    if (isParsing) return;
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
            transcribeAbortRef.current?.abort();
            const transcribeCtrl = new AbortController();
            transcribeAbortRef.current = transcribeCtrl;
            const res = await fetch(`${API_URL}/ai/transcribe`, {
              method: 'POST',
              signal: transcribeCtrl.signal,
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
          } catch (err) {
            if ((err as Error).name !== 'AbortError') setListenState('idle');
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
  const canListen    = listenState === 'idle' && !isParsing;
  const atCap        = docs.length >= 3;

  return (
    <>
      <style>{`
        .zg-doc-listen:hover:not(:disabled) { opacity: 0.85; }
        .zg-doc-back:hover { color: rgba(255,255,255,0.55) !important; }
        .zg-doc-clear:hover:not(:disabled) { color: rgba(255,255,255,0.55) !important; }
        .zg-doc-tray-btn:hover { background: rgba(255,255,255,0.10) !important; }
        .zg-tray-remove:hover { color: rgba(248,113,113,0.75) !important; }
        .zg-tray-add:hover:not(:disabled) { opacity: 0.85; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.45} }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={s.root}>
        {/* Top bar */}
        <div style={s.topBar}>
          {/* Document indicator */}
          <div style={s.docIndicator}>
            {isParsing ? (
              <span style={s.loadingLabel}>
                <span style={{ ...s.spinnerTiny }} /> Loading document…
              </span>
            ) : docs.length === 0 ? (
              <span style={s.noDocsLabel}>No documents</span>
            ) : (
              docs.map((d) => (
                <span key={d.docId} style={s.docChip} title={d.fileName}>
                  {d.fileType === 'pdf' ? '📑' : '📊'}
                  {' '}
                  {d.fileName.length > 16 ? d.fileName.slice(0, 14) + '…' : d.fileName}
                </span>
              ))
            )}
          </div>

          <div style={s.topActions}>
            {/* Tray toggle */}
            <button
              className="zg-doc-tray-btn"
              style={s.trayToggleBtn}
              onClick={() => setTrayOpen((o) => !o)}
              title={trayOpen ? 'Close document tray' : 'Manage documents'}
            >
              {trayOpen ? '▾ Docs' : `▸ Docs ${docs.length}/3`}
            </button>

            <button
              className="zg-doc-back"
              style={s.backBtn}
              onClick={onBackToSetup}
              title="Back to document setup"
            >
              ← Setup
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

        {/* Document tray panel */}
        {trayOpen && (
          <div style={s.trayPanel}>
            <div style={s.trayList}>
              {docs.length === 0 ? (
                <span style={s.trayEmpty}>No documents loaded</span>
              ) : (
                docs.map((doc) => (
                  <div key={doc.docId} style={s.trayItem}>
                    <span style={s.trayIcon}>{doc.fileType === 'pdf' ? '📑' : '📊'}</span>
                    <div style={s.trayInfo}>
                      <span style={s.trayName} title={doc.fileName}>
                        {doc.fileName.length > 22 ? doc.fileName.slice(0, 20) + '…' : doc.fileName}
                      </span>
                      <div style={s.trayMetaRow}>
                        <span style={s.trayMeta}>{docMeta(doc)}</span>
                        <span style={{ ...s.statusDot, background: parseStatusColor(doc) }} title={parseStatusLabel(doc)} />
                        <span style={{ ...s.statusTxt, color: parseStatusColor(doc) }}>{parseStatusLabel(doc)}</span>
                      </div>
                    </div>
                    <button
                      className="zg-tray-remove"
                      style={s.trayRemoveBtn}
                      onClick={() => onRemoveDoc(doc.docId)}
                      title="Remove document"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Add / cap notice */}
            {atCap ? (
              <p style={s.trayCapNotice}>Remove a document to add another (max 3)</p>
            ) : (
              <button
                className="zg-tray-add"
                style={{ ...s.trayAddBtn, ...(isParsing ? s.trayAddDisabled : s.trayAddEnabled) }}
                disabled={isParsing}
                onClick={onAddDoc}
              >
                {isParsing ? 'Loading…' : `+ Add Document (${docs.length}/3)`}
              </button>
            )}
          </div>
        )}

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

        {/* Listen button / loading blocker */}
        <div style={s.listenRow}>
          {isParsing ? (
            <div style={s.processingRow}>
              <span style={{ ...s.spinner }} />
              <span style={s.processingLabel}>Loading document — please wait…</span>
            </div>
          ) : isProcessing ? (
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
              ) : docs.length === 0 ? (
                <>📂 Add a document to start</>
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
    gap: '6px',
    WebkitAppRegion: 'drag',
  },
  docIndicator: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '4px',
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
  },
  docChip: {
    fontSize: '9px',
    color: 'rgba(255,255,255,0.38)',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '4px',
    padding: '2px 6px',
    fontFamily: SANS,
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '130px',
  },
  loadingLabel: {
    fontSize: '9px',
    color: 'rgba(255,255,255,0.35)',
    fontFamily: SANS,
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
  },
  spinnerTiny: {
    display: 'inline-block',
    width: '8px',
    height: '8px',
    border: '1.5px solid rgba(255,255,255,0.12)',
    borderTopColor: 'rgba(255,255,255,0.50)',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
    flexShrink: 0,
  },
  noDocsLabel: {
    fontSize: '9px',
    color: 'rgba(255,255,255,0.22)',
    fontFamily: SANS,
  },
  topActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
    WebkitAppRegion: 'no-drag',
    flexShrink: 0,
  },
  trayToggleBtn: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: '4px',
    color: 'rgba(255,255,255,0.38)',
    fontSize: '9px',
    cursor: 'pointer',
    padding: '3px 7px',
    fontFamily: SANS,
    transition: 'background 120ms ease',
    whiteSpace: 'nowrap' as const,
  },
  backBtn: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.28)',
    fontSize: '10px',
    cursor: 'pointer',
    padding: '3px 5px',
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

  // Document tray panel
  trayPanel: {
    background: 'rgba(10,10,16,0.92)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    WebkitAppRegion: 'no-drag',
  },
  trayList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  trayEmpty: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.25)',
    fontFamily: SANS,
    textAlign: 'center' as const,
    padding: '6px 0',
  },
  trayItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 4px',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  trayIcon: { fontSize: '13px', flexShrink: 0 },
  trayInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0,
  },
  trayName: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.70)',
    fontFamily: SANS,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  trayMetaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  trayMeta: {
    fontSize: '9px',
    color: 'rgba(255,255,255,0.25)',
    fontFamily: SANS,
  },
  statusDot: {
    width: '5px',
    height: '5px',
    borderRadius: '50%',
    display: 'inline-block',
    flexShrink: 0,
  },
  statusTxt: {
    fontSize: '9px',
    fontFamily: SANS,
  },
  trayRemoveBtn: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.20)',
    fontSize: '11px',
    cursor: 'pointer',
    padding: '2px 4px',
    flexShrink: 0,
    transition: 'color 120ms ease',
    fontFamily: SANS,
  },
  trayCapNotice: {
    fontSize: '9px',
    color: 'rgba(255,255,255,0.25)',
    fontFamily: SANS,
    margin: 0,
    textAlign: 'center' as const,
  },
  trayAddBtn: {
    width: '100%',
    padding: '7px 10px',
    borderRadius: '5px',
    fontSize: '10px',
    fontWeight: 500,
    fontFamily: SANS,
    textAlign: 'center' as const,
    transition: 'opacity 120ms ease',
    cursor: 'pointer',
  },
  trayAddEnabled: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.10)',
    color: 'rgba(255,255,255,0.58)',
  },
  trayAddDisabled: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.05)',
    color: 'rgba(255,255,255,0.20)',
    cursor: 'not-allowed',
  },

  // Answer area
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
