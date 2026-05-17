import { useState, useEffect } from 'react';
import { Login } from './auth/Login';
import { PreflightCheck } from './setup/PreflightCheck';
import { Overlay } from './overlay/Overlay';

type AppState = 'loading' | 'login' | 'setup' | 'overlay';

export default function App() {
  const [state, setState] = useState<AppState>('loading');

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

  if (state === 'loading') {
    return (
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
  }

  if (state === 'login') {
    return (
      <Login
        onLogin={() => setState('setup')}
      />
    );
  }

  if (state === 'setup') {
    return (
      <PreflightCheck
        onComplete={() => setState('overlay')}
      />
    );
  }

  return <Overlay />;
}
