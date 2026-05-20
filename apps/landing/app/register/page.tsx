'use client';
import { signIn } from 'next-auth/react';
import { useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const refCode = searchParams.get('ref') || '';

  const [form, setForm] = useState({ name: '', username: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'taken' | 'available'>('idle');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const usernameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function passwordStrength(pw: string): { score: number; label: string; color: string } {
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    const map = [
      { label: '', color: 'transparent' },
      { label: 'Weak', color: '#ef4444' },
      { label: 'Fair', color: '#f59e0b' },
      { label: 'Good', color: '#10b981' },
      { label: 'Strong', color: '#4f6ef7' },
    ];
    return { score, ...map[score] };
  }

  async function checkUsername(username: string) {
    if (username.length < 3) { setUsernameStatus('idle'); return; }
    setUsernameStatus('checking');
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/check-username?username=${encodeURIComponent(username)}`
      );
      const data = await res.json();
      setUsernameStatus(data.available ? 'available' : 'taken');
    } catch {
      setUsernameStatus('idle');
    }
  }

  function onUsernameChange(value: string) {
    set('username', value);
    setUsernameStatus('idle');
    if (usernameTimer.current) clearTimeout(usernameTimer.current);
    usernameTimer.current = setTimeout(() => checkUsername(value), 500);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirm) {
      setError('Passwords do not match');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (usernameStatus === 'taken') {
      setError('Username is already taken');
      return;
    }

    setLoading(true);

    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        username: form.username,
        email: form.email,
        password: form.password,
        refCode,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || 'Registration failed');
      setLoading(false);
      return;
    }

    // Auto sign-in after successful registration
    const signInRes = await signIn('credentials', {
      identifier: form.email,
      password: form.password,
      redirect: false,
    });

    setLoading(false);

    if (signInRes?.error) {
      setError('Account created — please sign in');
      router.push('/login');
    } else {
      router.push('/dashboard');
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    await signIn('google', { callbackUrl: '/dashboard' });
  }

  const strength = passwordStrength(form.password);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
    }}>
      <div style={{ width: '100%', maxWidth: '440px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <span style={{ fontSize: '28px', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>
              Zoom<span style={{ color: '#4f6ef7' }}>Guru</span>
            </span>
          </Link>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '14px', marginTop: '8px' }}>
            Create your account
          </p>
        </div>

        {/* Card */}
        <div className="glass" style={{ borderRadius: '16px', padding: '32px' }}>

          {/* Google */}
          <button
            onClick={handleGoogle}
            disabled={googleLoading}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '12px 20px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '10px',
              color: '#e8e8e8',
              fontSize: '15px',
              fontWeight: 500,
              cursor: googleLoading ? 'not-allowed' : 'pointer',
              opacity: googleLoading ? 0.7 : 1,
              transition: 'background 0.2s',
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
          >
            <GoogleIcon />
            {googleLoading ? 'Redirecting…' : 'Continue with Google'}
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '24px 0' }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>or</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Full name */}
            <div>
              <label style={labelStyle}>Full Name</label>
              <input
                type="text"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="Ada Lovelace"
                required
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = 'rgba(79,110,247,0.6)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
              />
            </div>

            {/* Username */}
            <div>
              <label style={labelStyle}>Username</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={form.username}
                  onChange={e => onUsernameChange(e.target.value)}
                  placeholder="yourname"
                  required
                  style={{
                    ...inputStyle,
                    borderColor: usernameStatus === 'taken'
                      ? 'rgba(239,68,68,0.5)'
                      : usernameStatus === 'available'
                        ? 'rgba(16,185,129,0.5)'
                        : 'rgba(255,255,255,0.1)',
                    paddingRight: '40px',
                  }}
                  onFocus={e => {
                    if (usernameStatus === 'idle') e.currentTarget.style.borderColor = 'rgba(79,110,247,0.6)';
                  }}
                  onBlur={e => {
                    if (usernameStatus === 'idle') e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                  }}
                />
                {/* Availability indicator */}
                <span style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '13px',
                }}>
                  {usernameStatus === 'checking' && <span style={{ color: 'rgba(255,255,255,0.3)' }}>…</span>}
                  {usernameStatus === 'available' && <span style={{ color: '#10b981' }}>✓</span>}
                  {usernameStatus === 'taken' && <span style={{ color: '#ef4444' }}>✗</span>}
                </span>
              </div>
              {usernameStatus === 'taken' && (
                <p style={{ color: '#f87171', fontSize: '12px', marginTop: '4px' }}>Username already taken</p>
              )}
              {usernameStatus === 'available' && (
                <p style={{ color: '#10b981', fontSize: '12px', marginTop: '4px' }}>Username available</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="you@example.com"
                required
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = 'rgba(79,110,247,0.6)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
              />
            </div>

            {/* Password */}
            <div>
              <label style={labelStyle}>Password</label>
              <input
                type="password"
                value={form.password}
                onChange={e => set('password', e.target.value)}
                placeholder="Min. 8 characters"
                required
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = 'rgba(79,110,247,0.6)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
              />
              {form.password && (
                <div style={{ marginTop: '8px' }}>
                  <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} style={{
                        flex: 1,
                        height: '3px',
                        borderRadius: '2px',
                        background: i <= strength.score ? strength.color : 'rgba(255,255,255,0.1)',
                        transition: 'background 0.2s',
                      }} />
                    ))}
                  </div>
                  <p style={{ fontSize: '12px', color: strength.color }}>{strength.label}</p>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label style={labelStyle}>Confirm Password</label>
              <input
                type="password"
                value={form.confirm}
                onChange={e => set('confirm', e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  ...inputStyle,
                  borderColor: form.confirm && form.confirm !== form.password
                    ? 'rgba(239,68,68,0.5)'
                    : 'rgba(255,255,255,0.1)',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = 'rgba(79,110,247,0.6)')}
                onBlur={e => {
                  e.currentTarget.style.borderColor = form.confirm && form.confirm !== form.password
                    ? 'rgba(239,68,68,0.5)'
                    : 'rgba(255,255,255,0.1)';
                }}
              />
            </div>

            {error && (
              <div style={{
                padding: '12px 14px',
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: '8px',
                color: '#f87171',
                fontSize: '14px',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-shimmer"
              style={{
                width: '100%',
                padding: '13px 20px',
                borderRadius: '10px',
                border: 'none',
                fontSize: '15px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                marginTop: '4px',
                fontFamily: 'inherit',
              }}
            >
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
        </div>

        {/* Footer link */}
        <p style={{ textAlign: 'center', marginTop: '24px', color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: '#4f6ef7', textDecoration: 'none', fontWeight: 500 }}>
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}

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

const labelStyle: React.CSSProperties = {
  display: 'block',
  color: 'rgba(255,255,255,0.55)',
  fontSize: '13px',
  fontWeight: 500,
  marginBottom: '6px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '10px',
  color: '#e8e8e8',
  fontSize: '15px',
  outline: 'none',
  transition: 'border-color 0.2s',
  fontFamily: 'inherit',
};

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
