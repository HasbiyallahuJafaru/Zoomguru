import { useState } from 'react';

const API_URL: string =
  import.meta.env.VITE_API_URL ||
  'https://zoomguru-backend.onrender.com';

interface Props {
  onRegistered: () => void;
  onBack: () => void;
}

export function Register({ onRegistered, onBack }: Props) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const deviceId = await window.zoomguru.getDeviceId();

      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, username, email, password, deviceId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      // Store tokens
      localStorage.setItem('access_token', data.accessToken);
      localStorage.setItem('refresh_token', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));

      await window.zoomguru.store.set('access_token', data.accessToken);
      await window.zoomguru.store.set('refresh_token', data.refreshToken);
      await window.zoomguru.store.set('user', data.user);

      onRegistered();
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">Create Account</h1>
        <p className="auth-subtitle">Get your invisible interview edge</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input
              type="text"
              className="form-input"
              placeholder="Jane Smith"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              type="text"
              className="form-input"
              placeholder="letters, numbers, underscore"
              value={username}
              onChange={e => {
                setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                setUsernameAvailable(null);
              }}
              onBlur={async () => {
                if (username.length >= 3) {
                  const res = await fetch(
                    `${API_URL}/auth/check-username?username=${username}`
                  );
                  const data = await res.json();
                  setUsernameAvailable(data.available);
                }
              }}
              required
              minLength={3}
              autoComplete="username"
            />
            {usernameAvailable === true && (
              <span style={{ color: '#10b981', fontSize: 11 }}>✓ Available</span>
            )}
            {usernameAvailable === false && (
              <span style={{ color: '#ef4444', fontSize: 11 }}>✗ Already taken</span>
            )}
          </div>

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
              placeholder="Min. 8 characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <div className="form-link">
          Already have an account?
          <button onClick={onBack}>Sign in</button>
        </div>
      </div>
    </div>
  );
}
