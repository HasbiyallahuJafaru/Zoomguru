import { useState, useEffect, type CSSProperties } from 'react';

interface MeetingSetupProps {
  onDone: (docText: string, docFilename: string) => void;
  onBack: () => void;
}

const SANS  = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
const SERIF = "'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif";

export default function MeetingSetup({ onDone, onBack }: MeetingSetupProps) {
  const [uploading, setUploading] = useState(false);
  const [filename, setFilename] = useState('');
  const [docText, setDocText] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    void window.zoomguru.loadMeetingDoc().then((stored) => {
      if (stored) {
        setFilename(stored.filename);
        setDocText(stored.text);
      }
    });
  }, []);

  async function handleUpload(): Promise<void> {
    setError('');
    setUploading(true);
    try {
      const result = await window.zoomguru.parseMeetingDoc();
      if (!result) return;
      if ('error' in result) { setError(result.error); return; }
      setFilename(result.filename);
      setDocText(result.text);
    } finally {
      setUploading(false);
    }
  }

  async function handleClear(): Promise<void> {
    await window.zoomguru.clearMeetingDoc();
    setFilename('');
    setDocText('');
  }

  return (
    <>
      <style>{`
        .zg-primary:hover:not(:disabled) { opacity: 0.90; }
        .zg-primary:active:not(:disabled) { transform: scale(0.98); }
        .zg-ghost:hover { color: rgba(255,255,255,0.45) !important; }
        .zg-close:hover { color: rgba(255,255,255,0.50) !important; }
      `}</style>

      <div style={s.root}>
        <button className="zg-close" style={s.closeBtn}
          onClick={() => { void window.zoomguru.quitApp(); }} aria-label="Close">
          ×
        </button>
        <button className="zg-ghost" style={s.backBtn} onClick={onBack} aria-label="Back">
          ← Back
        </button>

        <div style={s.content}>
          <div style={s.brand}>
            <span style={s.step}>Meeting Assistant</span>
            <span style={s.title}>Your Document</span>
            <span style={s.subtitle}>
              Upload your presentation or document. The AI will answer questions only from it.
            </span>
          </div>

          <div style={s.section}>
            <span style={s.sectionLabel}>Document / Presentation</span>
            {filename ? (
              <div style={s.fileRow}>
                <span style={s.fileCheck}>✓</span>
                <span style={s.fileName}>{filename}</span>
                <button
                  className="zg-ghost"
                  style={s.changeBtn}
                  onClick={() => { void handleUpload(); }}
                  disabled={uploading}
                >
                  Change
                </button>
                <button
                  className="zg-ghost"
                  style={s.changeBtn}
                  onClick={() => { void handleClear(); }}
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                className="zg-primary"
                style={{ ...s.outlineBtn, ...(uploading ? s.disabledBtn : {}) }}
                onClick={() => { void handleUpload(); }}
                disabled={uploading}
              >
                {uploading ? 'Parsing…' : 'Choose File  (PDF, PPTX, TXT, MD)'}
              </button>
            )}
          </div>

          {error && <p style={s.error}>{error}</p>}

          <div style={s.infoNote}>
            Questions outside this document will be declined by the AI.
          </div>

          <div style={s.actions}>
            <button
              className="zg-primary"
              style={{ ...s.primaryBtn, ...(!docText ? s.disabledBtn : {}) }}
              disabled={!docText}
              onClick={() => onDone(docText, filename)}
            >
              Start Meeting →
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

type ElectronStyle = CSSProperties & { WebkitAppRegion?: 'drag' | 'no-drag' };

const s: Record<string, ElectronStyle> = {
  root: {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(7, 7, 11, 0.97)',
    borderRadius: '16px',
    position: 'relative',
    overflow: 'hidden',
    fontFamily: SANS,
    WebkitAppRegion: 'drag',
  },
  backBtn: {
    position: 'absolute',
    top: '12px',
    left: '14px',
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.22)',
    fontSize: '11px',
    lineHeight: '1',
    cursor: 'pointer',
    padding: '2px 4px',
    transition: 'color 120ms ease',
    fontFamily: SANS,
    WebkitAppRegion: 'no-drag',
  },
  closeBtn: {
    position: 'absolute',
    top: '12px',
    right: '14px',
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.22)',
    fontSize: '18px',
    lineHeight: '1',
    cursor: 'pointer',
    padding: '2px 4px',
    transition: 'color 120ms ease',
    fontFamily: SANS,
    WebkitAppRegion: 'no-drag',
  },
  content: {
    width: '100%',
    maxWidth: '290px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: '20px',
    WebkitAppRegion: 'no-drag',
  },
  brand: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px',
  },
  step: {
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '0.8px',
    color: 'rgba(255,255,255,0.20)',
    textTransform: 'uppercase',
    fontFamily: SANS,
    textAlign: 'center',
  },
  title: {
    fontSize: '26px',
    fontWeight: 400,
    fontStyle: 'italic',
    fontFamily: SERIF,
    color: 'rgba(255,255,255,0.90)',
    letterSpacing: '0.2px',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.28)',
    lineHeight: 1.55,
    fontFamily: SANS,
    textAlign: 'center',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  sectionLabel: {
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '0.7px',
    color: 'rgba(255,255,255,0.22)',
    textTransform: 'uppercase',
    fontFamily: SANS,
  },
  fileRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 10px',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '6px',
  },
  fileCheck: {
    fontSize: '12px',
    color: '#10b981',
    fontFamily: SANS,
    flexShrink: 0,
  },
  fileName: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.55)',
    fontFamily: SANS,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
  },
  changeBtn: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.25)',
    fontSize: '10px',
    cursor: 'pointer',
    padding: '0',
    fontFamily: SANS,
    transition: 'color 120ms ease',
    flexShrink: 0,
  },
  outlineBtn: {
    width: '100%',
    padding: '9px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '6px',
    color: 'rgba(255,255,255,0.60)',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: SANS,
    transition: 'opacity 120ms ease, transform 100ms ease',
    textAlign: 'center',
  },
  infoNote: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.18)',
    fontFamily: SANS,
    textAlign: 'center',
    lineHeight: 1.5,
  },
  error: {
    margin: 0,
    fontSize: '11px',
    color: '#f43f5e',
    fontFamily: SANS,
    textAlign: 'center',
  },
  primaryBtn: {
    width: '100%',
    padding: '11px',
    background: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    color: '#07070b',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: SANS,
    transition: 'opacity 120ms ease, transform 100ms ease',
    letterSpacing: '-0.1px',
    textAlign: 'center',
  },
  disabledBtn: {
    opacity: 0.35,
    cursor: 'not-allowed',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
  },
};
