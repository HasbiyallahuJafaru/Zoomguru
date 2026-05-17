import { useState } from 'react';
import { Register } from './Register';

const API_URL = import.meta.env.VITE_API_URL;

interface Props {
  onLogin: () => void;
}

export function Login({ onLogin }: Props) {
  const [showRegister, setShowRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, deviceId }),
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
        <h1 className="auth-title">ZoomGuru</h1>
        <p className="auth-subtitle">Your invisible interview edge</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-input"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
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
