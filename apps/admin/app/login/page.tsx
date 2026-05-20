'use client';
import { useState, useRef, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const emailRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(
    params.get('error') === 'unauthorized' ? 'You do not have admin access.' : ''
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await signIn('credentials', {
      email, password, redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError('Invalid credentials or insufficient permissions.');
    } else {
      router.push('/');
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #e2e8f0',
    background: '#ffffff',
    color: '#0f172a',
    fontSize: 14,
    outline: 'none',
    fontFamily: 'Inter, sans-serif',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f8fafc',
      fontFamily: 'Inter, sans-serif',
    }}>

      {/* Card */}
      <div style={{
        width: 400,
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: 16,
        padding: '44px 40px 36px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.06)',
      }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 10,
          }}>
            <span style={{
              fontSize: 24,
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.5px',
            }}>
              ZoomGuru
            </span>
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              padding: '3px 8px',
              background: '#4f6ef7',
              color: '#ffffff',
              borderRadius: 5,
              letterSpacing: '0.6px',
            }}>
              ADMIN
            </span>
          </div>
          <p style={{
            fontSize: 14,
            color: '#64748b',
            margin: 0,
            fontWeight: 400,
          }}>
            Admin Dashboard
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>

          {/* Email */}
          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 600,
              color: '#475569',
              marginBottom: 6,
              letterSpacing: '0.2px',
            }}>
              Email address
            </label>
            <input
              ref={emailRef}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="admin@zoomguru.com"
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = '#4f6ef7')}
              onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
            />
          </div>

          {/* Password + show/hide */}
          <div style={{ marginBottom: 24 }}>
            <label style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 600,
              color: '#475569',
              marginBottom: 6,
              letterSpacing: '0.2px',
            }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                style={{ ...inputStyle, paddingRight: 44 }}
                onFocus={e => (e.target.style.borderColor = '#4f6ef7')}
                onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                tabIndex={-1}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  color: '#94a3b8',
                  fontSize: 13,
                  lineHeight: 1,
                  fontFamily: 'Inter, sans-serif',
                }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              marginBottom: 18,
              padding: '10px 14px',
              background: '#fee2e2',
              border: '1px solid #fecaca',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
            }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>⚠️</span>
              <p style={{ fontSize: 13, color: '#dc2626', margin: 0, lineHeight: 1.4 }}>
                {error}
              </p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '11px',
              borderRadius: 8,
              background: loading ? '#818cf8' : '#4f6ef7',
              color: '#ffffff',
              border: 'none',
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'Inter, sans-serif',
              letterSpacing: '0.1px',
              transition: 'background 0.15s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {loading && (
              <svg
                width="16" height="16" viewBox="0 0 24 24"
                style={{ animation: 'spin 0.8s linear infinite' }}
              >
                <circle
                  cx="12" cy="12" r="10"
                  stroke="rgba(255,255,255,0.3)" strokeWidth="3" fill="none"
                />
                <path
                  d="M12 2a10 10 0 0 1 10 10"
                  stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round"
                />
              </svg>
            )}
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        {/* Below form */}
        <p style={{
          marginTop: 20,
          fontSize: 12,
          color: '#94a3b8',
          textAlign: 'center',
          margin: '20px 0 0',
        }}>
          Forgot password?{' '}
          <span style={{ color: '#64748b' }}>Contact admin.</span>
        </p>
      </div>

      {/* Footer */}
      <p style={{
        marginTop: 24,
        fontSize: 12,
        color: '#cbd5e1',
        letterSpacing: '0.3px',
      }}>
        Authorized personnel only
      </p>

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
