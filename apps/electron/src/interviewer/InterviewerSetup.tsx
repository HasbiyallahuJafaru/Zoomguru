import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';

type Difficulty = 'easy' | 'medium' | 'hard' | 'dynamic';

interface Props {
  onStart: (config: { cvText?: string; jdText?: string; difficulty: Difficulty }) => void;
  onBack: () => void;
}

const API_URL = import.meta.env.VITE_API_URL || 'https://zoomguru.onrender.com';
const SANS = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";

const DIFFICULTIES: { value: Difficulty; label: string; desc: string }[] = [
  { value: 'easy',    label: 'Easy',    desc: 'Foundational concepts & simple scenarios' },
  { value: 'medium',  label: 'Medium',  desc: 'Behavioural STAR & moderate technical depth' },
  { value: 'hard',    label: 'Hard',    desc: 'Senior-level trade-offs & edge cases' },
  { value: 'dynamic', label: 'Dynamic', desc: 'Adapts per answer quality' },
];

export default function InterviewerSetup({ onStart, onBack }: Props) {
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [cvText, setCvText] = useState<string | undefined>(undefined);
  const [cvFilename, setCvFilename] = useState<string>('');
  const [jdText, setJdText] = useState('');
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [uploadingCv, setUploadingCv] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [cv, jd] = await Promise.all([
          window.zoomguru.loadCV(),
          window.zoomguru.loadJD(),
        ]);
        if (cv) { setCvText(cv.text); setCvFilename(cv.filename); }
        if (jd) setJdText(jd);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleUploadCv(): Promise<void> {
    setUploadingCv(true);
    try {
      const result = await window.zoomguru.parseCV();
      if (!result) return;
      if ('error' in result) { setError(result.error); return; }
      setCvText(result.text);
      setCvFilename(result.filename);
    } finally {
      setUploadingCv(false);
    }
  }

  async function handleStart(): Promise<void> {
    setError('');
    setStarting(true);
    try {
      const token = await window.zoomguru.getToken();
      let userId = '';
      try { userId = (JSON.parse(atob(token.split('.')[1])) as { sub?: string }).sub ?? ''; } catch { /* ignore */ }
      const sig = await window.zoomguru.signRequest(userId);
      const res = await fetch(`${API_URL}/ai/interviewer-start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Key-ID': sig.keyId,
          'X-Timestamp': String(sig.timestamp),
          'X-Signature': sig.signature,
        },
      });
      if (res.status === 401) { onBack(); return; }
      if (res.status === 403) {
        const body = await res.json() as { error?: string };
        if (body.error === 'subscription_required') { setError('Active subscription required.'); return; }
        if (body.error === 'device_locked') { setError('Device locked. Use your registered device.'); return; }
        setError('Access denied.'); return;
      }
      if (res.status === 429) {
        const body = await res.json() as { error?: string; resetAt?: string };
        if (body.error === 'quota_exceeded') {
          setError(`Interview quota reached. Resets at ${body.resetAt ? new Date(body.resetAt).toLocaleString() : 'next period'}.`);
        } else {
          setError('Too many requests. Please wait.');
        }
        return;
      }
      if (!res.ok) { setError('Could not start interview. Please try again.'); return; }
      onStart({ cvText, jdText: jdText.trim() || undefined, difficulty });
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setStarting(false);
    }
  }

  if (loading) {
    return (
      <div style={s.root}>
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', fontFamily: SANS }}>Loading…</div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .zg-diff:hover { opacity: 0.85; }
        .zg-primary:hover:not(:disabled) { opacity: 0.90; }
        .zg-primary:active:not(:disabled) { transform: scale(0.98); }
        .zg-ghost:hover { color: rgba(255,255,255,0.45) !important; }
        .zg-cv:hover:not(:disabled) { opacity: 0.80; }
      `}</style>
      <div style={s.root}>
        <div style={s.content}>
          <div style={s.header}>
            <button className="zg-ghost" style={s.backBtn} onClick={onBack}>← Back</button>
            <span style={s.title}>AI Interviewer</span>
          </div>

          {/* Difficulty */}
          <div style={s.section}>
            <span style={s.sectionLabel}>Difficulty</span>
            <div style={s.diffGrid}>
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.value}
                  className="zg-diff"
                  style={difficulty === d.value ? s.diffBtnActive : s.diffBtn}
                  onClick={() => setDifficulty(d.value)}
                >
                  <span style={s.diffLabel}>{d.label}</span>
                  <span style={s.diffDesc}>{d.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* CV */}
          <div style={s.section}>
            <div style={s.sectionRow}>
              <span style={s.sectionLabel}>CV / Resume</span>
              <button
                className="zg-cv"
                style={s.cvUploadBtn}
                onClick={() => { void handleUploadCv(); }}
                disabled={uploadingCv}
              >
                {uploadingCv ? 'Loading…' : cvFilename ? 'Change' : 'Upload'}
              </button>
            </div>
            <div style={s.cvStatus}>
              {cvFilename
                ? <span style={s.cvFilename}>{cvFilename}</span>
                : <span style={s.cvEmpty}>No CV loaded — answers will be generic</span>
              }
            </div>
          </div>

          {/* Job Description */}
          <div style={s.section}>
            <span style={s.sectionLabel}>Job Description</span>
            <textarea
              style={s.jdTextarea}
              placeholder="Paste job description here (optional)…"
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              maxLength={4000}
            />
          </div>

          {error && <p style={s.errorMsg}>{error}</p>}

          <button
            className="zg-primary"
            style={{ ...s.startBtn, ...(starting ? s.startBtnDisabled : s.startBtnEnabled) }}
            disabled={starting}
            onClick={() => { void handleStart(); }}
          >
            {starting ? 'Starting…' : 'Start Interview →'}
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
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(7, 7, 11, 0.97)',
    borderRadius: '16px',
    fontFamily: SANS,
  },
  content: {
    width: '100%',
    maxWidth: '320px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    padding: '0 4px',
    maxHeight: 'calc(100vh - 32px)',
    overflowY: 'auto',
    WebkitAppRegion: 'no-drag' as unknown as undefined,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  backBtn: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.30)',
    fontSize: '11px',
    cursor: 'pointer',
    fontFamily: SANS,
    padding: '0',
    transition: 'color 120ms ease',
    flexShrink: 0,
  },
  title: {
    fontSize: '15px',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: '-0.1px',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  sectionRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.30)',
    letterSpacing: '0.4px',
    textTransform: 'uppercase' as const,
    fontFamily: SANS,
  },
  diffGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '6px',
  },
  diffBtn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    padding: '10px 10px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '8px',
    cursor: 'pointer',
    fontFamily: SANS,
    textAlign: 'left' as const,
    transition: 'opacity 120ms ease',
  },
  diffBtnActive: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    padding: '10px 10px',
    background: 'rgba(99,102,241,0.12)',
    border: '1px solid rgba(99,102,241,0.35)',
    borderRadius: '8px',
    cursor: 'pointer',
    fontFamily: SANS,
    textAlign: 'left' as const,
    transition: 'opacity 120ms ease',
  },
  diffLabel: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.80)',
  },
  diffDesc: {
    fontSize: '9px',
    color: 'rgba(255,255,255,0.30)',
    lineHeight: '1.35',
  },
  cvStatus: {
    padding: '8px 10px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '6px',
    minHeight: '32px',
    display: 'flex',
    alignItems: 'center',
  },
  cvFilename: {
    fontSize: '11px',
    color: 'rgba(52,211,153,0.80)',
    fontFamily: SANS,
  },
  cvEmpty: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.25)',
    fontFamily: SANS,
  },
  cvUploadBtn: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '4px',
    color: 'rgba(255,255,255,0.55)',
    fontSize: '10px',
    fontFamily: SANS,
    padding: '3px 8px',
    cursor: 'pointer',
    transition: 'opacity 120ms ease',
  },
  jdTextarea: {
    width: '100%',
    minHeight: '80px',
    maxHeight: '130px',
    padding: '9px 10px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '6px',
    color: 'rgba(255,255,255,0.65)',
    fontSize: '11px',
    fontFamily: SANS,
    resize: 'vertical' as const,
    outline: 'none',
    boxSizing: 'border-box' as const,
    lineHeight: '1.5',
  },
  startBtn: {
    width: '100%',
    padding: '12px',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 600,
    fontFamily: SANS,
    letterSpacing: '-0.1px',
    textAlign: 'center' as const,
    transition: 'opacity 120ms ease, transform 100ms ease',
    border: 'none',
    cursor: 'pointer',
  },
  startBtnEnabled: {
    background: 'rgba(255,255,255,0.92)',
    color: '#07070b',
  },
  startBtnDisabled: {
    background: 'rgba(255,255,255,0.12)',
    color: 'rgba(255,255,255,0.30)',
    cursor: 'not-allowed',
  },
  errorMsg: {
    margin: 0,
    fontSize: '10px',
    color: 'rgba(248,113,113,0.85)',
    textAlign: 'center' as const,
    fontFamily: SANS,
  },
};
