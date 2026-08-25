import { useState, useEffect } from 'react';
import { fetchStats } from './api';
import Dashboard from './Dashboard';

const SESSION_KEY = 'zg_admin_key';

const F = {
  heading: "'Cormorant Garamond', Georgia, serif",
  body: "'Inter', system-ui, sans-serif",
};

export default function App() {
  const [adminKey, setAdminKey] = useState('');
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) setAuthed(true);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!adminKey.trim()) return;
    setLoading(true);
    setError('');
    try {
      await fetchStats(adminKey.trim());
      sessionStorage.setItem(SESSION_KEY, adminKey.trim());
      setAuthed(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg === '401' ? 'Invalid admin key.' : 'Could not reach backend.');
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    sessionStorage.removeItem(SESSION_KEY);
    setAuthed(false);
    setAdminKey('');
  }

  if (authed) {
    const key = sessionStorage.getItem(SESSION_KEY) ?? '';
    return <Dashboard adminKey={key} onLogout={handleLogout} />;
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(70rem 48rem at 12% -8%, rgba(226,137,74,0.12), transparent 60%), linear-gradient(145deg, #F9F6F2 0%, #F3EFE9 55%, #EDE8E1 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      {/* Decorative blobs */}
      <div style={{
        position: 'fixed', top: '-10%', right: '-8%',
        width: 420, height: 420, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,0,0,0.03) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'fixed', bottom: '-8%', left: '-6%',
        width: 360, height: 360, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,0,0,0.03) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Card */}
      <div style={{
        background: 'rgba(255,255,255,0.82)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        borderRadius: 28,
        padding: '52px 44px',
        width: '100%',
        maxWidth: 420,
        border: '1px solid rgba(255,255,255,0.95)',
        boxShadow: [
          '0 2px 4px rgba(0,0,0,0.03)',
          '0 8px 24px rgba(0,0,0,0.06)',
          '0 24px 64px rgba(0,0,0,0.06)',
        ].join(', '),
        animation: 'fadeSlideUp 0.65s cubic-bezier(0.16,1,0.3,1) both',
      }}>
        {/* Brand */}
        <div style={{ marginBottom: 44 }}>
          <h1 style={{
            fontFamily: F.heading,
            fontStyle: 'italic',
            fontWeight: 700,
            fontSize: 42,
            color: '#26221F',
            letterSpacing: '-0.025em',
            lineHeight: 1,
          }}>
            ZoomGuru
          </h1>
          <p style={{
            fontFamily: F.body,
            fontSize: 11,
            fontWeight: 500,
            color: '#A69E97',
            marginTop: 7,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}>
            Analytics · Admin Access
          </p>
          {/* Thin decorative rule */}
          <div style={{
            marginTop: 24,
            height: 1,
            background: 'linear-gradient(90deg, rgba(0,0,0,0.1) 0%, transparent 100%)',
          }} />
        </div>

        <form onSubmit={(e) => { void handleSubmit(e); }}>
          {/* Label */}
          <label style={{
            display: 'block',
            fontFamily: F.body,
            fontSize: 11,
            fontWeight: 600,
            color: '#6E6660',
            marginBottom: 9,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>
            Admin Key
          </label>

          {/* Input */}
          <input
            className="admin-input"
            type="password"
            placeholder="Enter your admin key"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            autoComplete="current-password"
            style={{
              display: 'block',
              width: '100%',
              padding: '15px 18px',
              background: 'rgba(0,0,0,0.03)',
              border: '1.5px solid rgba(0,0,0,0.09)',
              borderRadius: 14,
              fontFamily: F.body,
              fontSize: 14,
              color: '#26221F',
              marginBottom: 14,
            }}
          />

          {/* Error */}
          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.06)',
              border: '1px solid rgba(239,68,68,0.18)',
              borderRadius: 10,
              padding: '11px 15px',
              marginBottom: 16,
              fontFamily: F.body,
              fontSize: 13,
              color: '#BE5540',
              animation: 'fadeIn 0.2s ease',
            }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            className="btn-black"
            type="submit"
            disabled={loading}
            style={{
              display: 'block',
              width: '100%',
              padding: '15px',
              background: loading ? '#A69E97' : '#26221F',
              border: 'none',
              borderRadius: 14,
              fontFamily: F.body,
              fontSize: 14,
              fontWeight: 600,
              color: '#FFFFFF',
              letterSpacing: '0.02em',
              opacity: loading ? 0.75 : 1,
              marginTop: 4,
            }}
          >
            {loading ? 'Verifying…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
