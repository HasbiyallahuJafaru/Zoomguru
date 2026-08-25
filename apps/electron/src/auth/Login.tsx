import { useState, useEffect, useRef, type FormEvent, type CSSProperties } from 'react';
import { API_URL } from '../utils';

type ElectronStyle = CSSProperties & { WebkitAppRegion?: 'drag' | 'no-drag' };

interface LoginProps {
  onLogin: () => void;
  onShowRegister: () => void;
}

interface SessionInfo {
  sid: string;
  ip: string;
  device: string;
  loginAt: string;
  lastSeen: string;
}

interface LoginApiResponse {
  accessToken?: string;
  user?: unknown;
  message?: string;
  error?: string;
  sessions?: SessionInfo[];
}

function whenText(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs} hr ago` : `${Math.round(hrs / 24)} d ago`;
}

const SANS  = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
const SERIF = "'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif";

export default function Login({ onLogin, onShowRegister }: LoginProps) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isProtected, setIsProtected] = useState<boolean | null>(null);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null);
  const forgotRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    void window.zoomguru.getProtectionStatus().then(setIsProtected);
  }, []);

  useEffect(() => {
    if (showForgot) forgotRef.current?.focus();
  }, [showForgot]);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  async function handleForgot(e: FormEvent): Promise<void> {
    e.preventDefault();
    setForgotLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
        signal: controller.signal,
      });
      setForgotSent(true);
    } catch {
      setForgotSent(true);
    } finally {
      setForgotLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent | null, revokeSid?: string): Promise<void> {
    e?.preventDefault();
    setError('');
    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: identifier, password, revokeSid }),
        signal: controller.signal,
      });
      const data: LoginApiResponse = await res.json();
      if (!res.ok) {
        if (data.error === 'session_limit') {
          setSessions(data.sessions ?? []);
          setError('');
          return;
        }
        setError(data.message ?? 'Invalid credentials');
        return;
      }
      setSessions(null);
      await window.zoomguru.setToken(data.accessToken ?? '');
      onLogin();
    } catch {
      setError('Cannot reach backend. Is it running?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
        .zg-field {
          width: 100%;
          background: transparent;
          border: none;
          border-bottom: 1px solid rgba(255,255,255,0.10);
          color: rgba(255,255,255,0.88);
          font-size: 13px;
          font-family: ${SANS};
          padding: 11px 0;
          outline: none;
          text-align: center;
          transition: border-color 150ms ease;
          box-sizing: border-box;
        }
        .zg-field:focus { border-bottom-color: rgba(255,255,255,0.38); }
        .zg-field::placeholder { color: rgba(255,255,255,0.22); }
        .zg-submit:hover:not(:disabled) { opacity: 0.90; }
        .zg-submit:active:not(:disabled) { transform: scale(0.98); }
        .zg-link:hover { color: rgba(255,255,255,0.65) !important; }
        .zg-close:hover { color: rgba(255,255,255,0.50) !important; }
        .zg-forgot:hover { color: rgba(255,255,255,0.55) !important; }
        @keyframes zg-status-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.45); opacity: 1; }
          50%       { box-shadow: 0 0 0 5px rgba(16,185,129,0); opacity: 0.80; }
        }
      `}</style>

      <div style={s.root}>
        {/* Organic diagonal band — top-right to bottom-left */}
        <svg
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
          viewBox="0 0 400 520"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="zgBandFill" x1="1" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#fff" stopOpacity="0.055" />
              <stop offset="42%"  stopColor="#fff" stopOpacity="0.024" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0.005" />
            </linearGradient>
            <linearGradient id="zgEdgeGlow" x1="1" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#fff" stopOpacity="0.18" />
              <stop offset="50%"  stopColor="#fff" stopOpacity="0.07" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Band fill — closed ribbon shape */}
          <path
            d="
              M 435,-15
              C 372,52 304,68 256,158
              C 208,248 202,312 138,396
              C 90,460 32,482 -22,545
              L 18,572
              C 64,504 116,476 163,412
              C 226,328 234,264 283,172
              C 332,80 400,62 462,12
              Z
            "
            fill="url(#zgBandFill)"
          />

          {/* Leading edge — light-catching highlight */}
          <path
            d="
              M 435,-15
              C 372,52 304,68 256,158
              C 208,248 202,312 138,396
              C 90,460 32,482 -22,545
            "
            fill="none"
            stroke="url(#zgEdgeGlow)"
            strokeWidth="1"
          />

          {/* Trailing edge — faint ghost for depth */}
          <path
            d="
              M 462,12
              C 400,62 332,80 283,172
              C 234,264 226,328 163,412
              C 116,476 64,504 18,572
            "
            fill="none"
            stroke="rgba(255,255,255,0.028)"
            strokeWidth="0.7"
          />

          {/* Second ghost line, further offset — adds layered depth */}
          <path
            d="
              M 408,-32
              C 348,36 282,54 234,144
              C 186,234 180,300 116,382
              C 68,446 12,470 -44,530
            "
            fill="none"
            stroke="rgba(255,255,255,0.038)"
            strokeWidth="0.5"
          />
        </svg>
        {isProtected !== null && (
          <div style={{
            ...s.protectionBadge,
            background: isProtected ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)',
            border: `1px solid ${isProtected ? 'rgba(16,185,129,0.35)' : 'rgba(244,63,94,0.35)'}`,
            color: isProtected ? 'rgba(16,185,129,0.90)' : 'rgba(244,63,94,0.90)',
            animation: isProtected ? 'zg-status-pulse 2s ease-in-out infinite' : 'none',
          }}>
            {isProtected ? '● You are good to go' : '● Do not use'}
          </div>
        )}

        <button className="zg-close" style={s.closeBtn}
          onClick={() => { void window.zoomguru.quitApp(); }} aria-label="Close">
          ×
        </button>

        <div style={s.content}>
          <div style={s.brand}>
            <span style={s.brandName}>ZoomGuru</span>
            <span style={s.brandTag}>Your invisible interview edge</span>
          </div>

          {sessions ? (
            <div style={s.form}>
              <p style={s.forgotHint}>
                This account is already signed in on {sessions.length} devices — the
                limit. Sign one out to continue here.
              </p>
              {sessions.map((sess) => (
                <div key={sess.sid} style={s.sessionRow}>
                  <div style={s.sessionMeta}>
                    <span style={s.sessionDevice}>{sess.device}</span>
                    <span style={s.sessionSub}>{sess.ip || 'unknown IP'} · active {whenText(sess.lastSeen)}</span>
                  </div>
                  <button type="button" className="zg-forgot" style={s.sessionBtn}
                    disabled={loading}
                    onClick={() => { void handleSubmit(null, sess.sid); }}>
                    Sign out
                  </button>
                </div>
              ))}
              {error && <p style={s.error}>{error}</p>}
              <button type="button" className="zg-forgot" style={s.forgotLink}
                onClick={() => { setSessions(null); setError(''); }}>
                ← Back to sign in
              </button>
            </div>
          ) : !showForgot ? (
            <form onSubmit={(e) => { void handleSubmit(e); }} style={s.form}>
              <input className="zg-field" type="text" placeholder="Email or username"
                value={identifier} onChange={(e) => setIdentifier(e.target.value)}
                disabled={loading} autoComplete="username" />
              <input className="zg-field" type="password" placeholder="Password"
                value={password} onChange={(e) => setPassword(e.target.value)}
                disabled={loading} autoComplete="current-password" />

              {error && <p style={s.error}>{error}</p>}

              <button className="zg-submit" type="submit" disabled={loading}
                style={{ ...s.submitBtn, ...(loading ? s.submitDisabled : {}) }}>
                {loading ? 'Signing in…' : 'Sign In'}
              </button>

              <button type="button" className="zg-forgot" style={s.forgotLink}
                onClick={() => setShowForgot(true)}>
                Forgot password?
              </button>
            </form>
          ) : (
            <form onSubmit={(e) => { void handleForgot(e); }} style={s.form}>
              {!forgotSent ? (
                <>
                  <p style={s.forgotHint}>Enter your email and we'll send a reset link.</p>
                  <input className="zg-field" type="email" placeholder="Your email"
                    ref={forgotRef}
                    value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)}
                    disabled={forgotLoading} autoComplete="email" required />
                  <button className="zg-submit" type="submit" disabled={forgotLoading}
                    style={{ ...s.submitBtn, ...(forgotLoading ? s.submitDisabled : {}) }}>
                    {forgotLoading ? 'Sending…' : 'Send reset link'}
                  </button>
                </>
              ) : (
                <p style={s.forgotHint}>
                  If that email is registered, a reset link is on its way. Check your inbox — and your spam folder if it doesn't arrive within a minute.
                </p>
              )}
              <button type="button" className="zg-forgot" style={s.forgotLink}
                onClick={() => { setShowForgot(false); setForgotSent(false); setForgotEmail(''); }}>
                ← Back to sign in
              </button>
            </form>
          )}

          <p style={s.switchText}>
            No account?{' '}
            <button className="zg-link" style={s.switchLink} onClick={onShowRegister}>
              Sign up
            </button>
          </p>
        </div>
      </div>
    </>
  );
}

const s: Record<string, ElectronStyle> = {
  protectionBadge: {
    position: 'absolute',
    top: '14px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '4px 9px',
    borderRadius: '20px',
    fontSize: '9px',
    fontWeight: 600,
    letterSpacing: '0.3px',
    fontFamily: SANS,
    WebkitAppRegion: 'no-drag',
  },
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
  closeBtn: {
    position: 'absolute',
    top: '12px',
    right: '14px',
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f43f5e',
    border: 'none',
    borderRadius: '4px',
    color: '#ffffff',
    fontSize: '14px',
    lineHeight: '1',
    cursor: 'pointer',
    padding: 0,
    transition: 'background 120ms ease',
    fontFamily: SANS,
    WebkitAppRegion: 'no-drag',
  },
  content: {
    width: '100%',
    maxWidth: '290px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '32px',
    WebkitAppRegion: 'no-drag',
  },
  brand: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '7px',
  },
  brandName: {
    fontSize: '28px',
    fontWeight: 400,
    fontStyle: 'italic',
    fontFamily: SERIF,
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: '0.2px',
    textAlign: 'center',
  },
  brandTag: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.28)',
    fontFamily: SANS,
    letterSpacing: '0.2px',
    textAlign: 'center',
  },
  form: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
  },
  sessionRow: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    padding: '9px 0',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  sessionMeta: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '2px',
    minWidth: 0,
  },
  sessionDevice: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.80)',
    fontFamily: SANS,
  },
  sessionSub: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.35)',
    fontFamily: SANS,
  },
  sessionBtn: {
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    fontSize: '11px',
    color: 'rgba(244,63,94,0.75)',
    fontFamily: SANS,
    flexShrink: 0,
  },
  error: {
    margin: 0,
    fontSize: '11px',
    color: '#f43f5e',
    fontFamily: SANS,
    textAlign: 'center',
    marginTop: '-8px',
  },
  submitBtn: {
    width: '100%',
    padding: '11px',
    marginTop: '4px',
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
  },
  submitDisabled: {
    background: 'rgba(255,255,255,0.20)',
    cursor: 'not-allowed',
  },
  switchText: {
    margin: 0,
    fontSize: '11px',
    color: 'rgba(255,255,255,0.25)',
    textAlign: 'center',
    fontFamily: SANS,
  },
  switchLink: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.45)',
    fontSize: '11px',
    cursor: 'pointer',
    padding: 0,
    transition: 'color 120ms ease',
    fontFamily: SANS,
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
  },
  forgotLink: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.28)',
    fontSize: '11px',
    cursor: 'pointer',
    padding: 0,
    transition: 'color 120ms ease',
    fontFamily: SANS,
    marginTop: '-8px',
  },
  forgotHint: {
    margin: 0,
    fontSize: '12px',
    color: 'rgba(255,255,255,0.40)',
    fontFamily: SANS,
    textAlign: 'center' as const,
    lineHeight: '1.6',
  },
};
