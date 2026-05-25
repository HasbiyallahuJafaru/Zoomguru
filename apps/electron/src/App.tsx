import { useState, useEffect, lazy, Suspense } from 'react';
const Login = lazy(() => import('./auth/Login').then(m => ({ default: m.Login })));
const PreflightCheck = lazy(() => import('./setup/PreflightCheck').then(m => ({ default: m.PreflightCheck })));
const Overlay = lazy(() => import('./overlay/Overlay').then(m => ({ default: m.Overlay })));
const Onboarding = lazy(() => import('./onboarding/Onboarding').then(m => ({ default: m.Onboarding })));

type AppState = 'loading' | 'login' | 'setup' | 'overlay';

export default function App() {
  const [state, setState] = useState<AppState>('loading');
  const [showOnboarding, setShowOnboarding] = useState(
    () => localStorage.getItem('zg_onboarded') !== '1'
  );

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const sessionId = localStorage.getItem('session_id');

    if (!token) {
      setState('login');
    } else if (!sessionId) {
      setState('setup');
    } else {
      setState('overlay');
    }
  }, []);

  const loadingFallback = (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: 'rgba(10,10,15,0.9)',
    }}>
      <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Loading...</span>
    </div>
  );

  if (showOnboarding) {
    return (
      <Suspense fallback={loadingFallback}>
        <Onboarding onComplete={() => setShowOnboarding(false)} />
      </Suspense>
    );
  }

  if (state === 'loading') {
    return loadingFallback;
  }

  if (state === 'login') {
    return (
      <Suspense fallback={loadingFallback}>
        <Login onLogin={() => setState('setup')} />
      </Suspense>
    );
  }

  if (state === 'setup') {
    return (
      <Suspense fallback={loadingFallback}>
        <PreflightCheck onComplete={() => setState('overlay')} />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={loadingFallback}>
      <Overlay />
    </Suspense>
  );
}
