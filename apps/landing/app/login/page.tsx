'use client';
import { signIn } from 'next-auth/react';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
      <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.962L3.964 6.294C4.672 4.169 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await signIn('credentials', { identifier, password, redirect: false });
    setLoading(false);
    if (res?.error) setError('Invalid email/username or password');
    else router.push(callbackUrl);
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    await signIn('google', { callbackUrl });
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 16px 32px', position: 'relative', zIndex: 10 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontWeight: 900, fontSize: 14 }}>Z</span>
            </div>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#111', letterSpacing: '-0.5px' }}>ZoomGuru</span>
          </Link>
          <p style={{ color: '#888', fontSize: 14, marginTop: 8 }}>Sign in to your account</p>
        </div>

        {/* Card — same style as hero demo card */}
        <div style={{ background: '#fff', border: '1.5px solid #e5e5e5', borderRadius: 20, overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.07)' }}>

          {/* Header bar — matches hero card question bar */}
          <div style={{ background: '#f5f5f3', borderBottom: '1px solid #e5e5e5', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontSize: 11, fontWeight: 900 }}>Z</span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>Welcome back</span>
          </div>

          <div style={{ padding: '28px 28px' }}>

            {/* Google */}
            <button onClick={handleGoogle} disabled={googleLoading} style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 10, padding: '11px 20px', background: '#fff',
              border: '1.5px solid #e5e5e5', borderRadius: 10,
              color: '#333', fontSize: 14, fontWeight: 500,
              cursor: googleLoading ? 'not-allowed' : 'pointer',
              opacity: googleLoading ? 0.7 : 1,
              transition: 'border-color 0.15s, background 0.15s', fontFamily: 'inherit',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#999'; e.currentTarget.style.background = '#fafaf8'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e5e5'; e.currentTarget.style.background = '#fff'; }}
            >
              <GoogleIcon />
              {googleLoading ? 'Redirecting…' : 'Continue with Google'}
            </button>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
              <div style={{ flex: 1, height: 1, background: '#ebebeb' }} />
              <span style={{ color: '#bbb', fontSize: 12, fontWeight: 500 }}>or</span>
              <div style={{ flex: 1, height: 1, background: '#ebebeb' }} />
            </div>

            {/* Form */}
            <form onSubmit={handleCredentials} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Email or Username</label>
                <input type="text" value={identifier} onChange={e => setIdentifier(e.target.value)}
                  placeholder="you@example.com or yourname" required style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#111')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#e5e5e5')}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>Password</label>
                  <Link href="/forgot-password" style={{ color: '#888', fontSize: 12, textDecoration: 'none' }}>Forgot?</Link>
                </div>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#111')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#e5e5e5')}
                />
              </div>

              {error && (
                <div style={{ padding: '10px 14px', background: '#fff5f5', border: '1.5px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: 13 }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} style={{
                width: '100%', padding: '12px 20px', borderRadius: 10,
                border: 'none', background: '#111', color: '#fff',
                fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1, fontFamily: 'inherit',
                transition: 'background 0.12s',
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#333'; }}
              onMouseLeave={e => (e.currentTarget.style.background = '#111')}
              >
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, color: '#888', fontSize: 14 }}>
          Don&apos;t have an account?{' '}
          <Link href="/register" style={{ color: '#111', textDecoration: 'none', fontWeight: 600, borderBottom: '1px solid #ccc' }}>Register</Link>
        </p>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', color: '#555', fontSize: 12, fontWeight: 600,
  marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px',
  background: '#fafaf8', border: '1.5px solid #e5e5e5',
  borderRadius: 10, color: '#111', fontSize: 14,
  outline: 'none', transition: 'border-color 0.15s', fontFamily: 'inherit',
};

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
