import { useState, useEffect } from 'react';
import { fetchStats } from './api';
import Dashboard from './Dashboard';

const SESSION_KEY = 'zg_admin_key';

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
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0a0f',
    }}>
      <div style={{
        background: '#13131a',
        border: '1px solid #1e1e2e',
        borderRadius: 12,
        padding: '40px 48px',
        width: 380,
      }}>
        <div style={{ marginBottom: 32 }}>
          <p style={{ color: '#6b6b8a', fontSize: 13, marginTop: 4 }}>ZoomGuru Analytics</p>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e8e8f0' }}>Admin Access</h1>
        </div>
        <form onSubmit={(e) => { void handleSubmit(e); }}>
          <input
            type="password"
            placeholder="Enter admin key"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: '#0a0a0f',
              border: '1px solid #1e1e2e',
              borderRadius: 8,
              color: '#e8e8f0',
              fontSize: 14,
              outline: 'none',
              marginBottom: 12,
            }}
          />
          {error && (
            <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '10px 0',
              background: '#3b82f6',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Verifying...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
