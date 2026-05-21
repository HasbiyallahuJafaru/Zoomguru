import { useState, useEffect } from 'react';
import { Register } from './Register';

const API_URL: string =
  import.meta.env.VITE_API_URL ||
  'http://localhost:3000';
if (!import.meta.env.VITE_API_URL) {
  console.warn(
    '[ZoomGuru] VITE_API_URL not set in .env — ' +
    'falling back to http://localhost:3000'
  );
}

interface Props {
  onLogin: (user?: any) => void;
}

export function Login({ onLogin }: Props) {
  const [showRegister, setShowRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    window.zoomguru.onGoogleAuth(async ({ token }) => {
      const res = await fetch(
        `${API_URL}/auth/google/electron/exchange`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('access_token', data.accessToken);
        localStorage.setItem('refresh_token', data.refreshToken);
        localStorage.setItem('user', JSON.stringify(data.user));
        await window.zoomguru.store.set('access_token', data.accessToken);
        await window.zoomguru.store.set('refresh_token', data.refreshToken);
        await window.zoomguru.store.set('user', data.user);
        onLogin(data.user);
      }
    });
    return () => { window.zoomguru.offGoogleAuth?.(); };
  }, []);

  if (showRegister) {
    return (
      <Register
        onRegistered={onLogin}
        onBack={() => setShowRegister(false)}
      />
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const deviceId = await window.zoomguru.getDeviceId();

      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Device-ID': deviceId },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Login failed');
      }

      // Store tokens
      localStorage.setItem('access_token', data.accessToken);
      localStorage.setItem('refresh_token', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Also persist in encrypted electron-store
      await window.zoomguru.store.set('access_token', data.accessToken);
      await window.zoomguru.store.set('refresh_token', data.refreshToken);
      await window.zoomguru.store.set('user', data.user);

      onLogin();
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        {/* Close / quit button — window has no frame so this is the only way out */}
        <button
          onClick={() => window.zoomguru.hideWindow()}
          title="Close"
          style={{
            position: 'absolute', top: 12, right: 12,
            background: 'none', border: 'none',
            color: 'rgba(255,255,255,0.3)', fontSize: 16,
            cursor: 'pointer', padding: '2px 6px',
          }}
        >✕</button>
        <h1 className="auth-title">ZoomGuru</h1>
        <p className="auth-subtitle">Your invisible interview edge</p>

        <button
          onClick={() => window.zoomguru.openGoogleAuth()}
          style={{
            width: '100%',
            padding: '11px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 10,
            color: '#fff',
            fontSize: 13,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            marginBottom: 16,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>or</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email or Username</label>
            <input
              type="text"
              className="form-input"
              placeholder="you@example.com or yourname"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="form-link">
          Don't have an account?
          <button onClick={() => setShowRegister(true)}>Create one</button>
        </div>
      </div>
    </div>
  );
}
