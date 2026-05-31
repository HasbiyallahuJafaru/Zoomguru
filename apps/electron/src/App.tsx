import { useState, useEffect } from 'react';
import Login from './auth/Login';
import Register from './auth/Register';
import Dashboard from './dashboard/Dashboard';
import CvSetup from './onboarding/CvSetup';
import Overlay from './overlay/Overlay';

type Step = 'loading' | 'login' | 'register' | 'dashboard' | 'cv' | 'overlay';

const App = () => {
  const [step, setStep] = useState<Step>('loading');

  useEffect(() => {
    void (async () => {
      let token = await window.zoomguru.getToken();
      if (!token) {
        const legacy = localStorage.getItem('access_token');
        if (legacy) {
          await window.zoomguru.setToken(legacy);
          localStorage.removeItem('access_token');
          token = legacy;
        }
      }
      setStep(token ? 'dashboard' : 'login');
    })();
  }, []);

  function handleLogout(): void {
    void window.zoomguru.clearToken();
    localStorage.removeItem('session_id');
    setStep('login');
  }

  if (step === 'loading') return null;

  if (step === 'login') {
    return (
      <Login
        onLogin={() => setStep('dashboard')}
        onShowRegister={() => setStep('register')}
      />
    );
  }

  if (step === 'register') {
    return (
      <Register
        onRegistered={() => setStep('dashboard')}
        onShowLogin={() => setStep('login')}
      />
    );
  }

  if (step === 'dashboard') {
    return (
      <Dashboard
        onContinue={() => setStep('cv')}
        onLogout={handleLogout}
      />
    );
  }

  if (step === 'cv') {
    return <CvSetup onDone={() => setStep('overlay')} />;
  }

  return <Overlay onLogout={handleLogout} onTrialExpired={() => setStep('dashboard')} />;
};

export default App;
