import { useState, useEffect } from 'react';
import Login from './auth/Login';
import Register from './auth/Register';
import Dashboard from './dashboard/Dashboard';
import CvSetup from './onboarding/CvSetup';
import Overlay from './overlay/Overlay';
import Referral from './referral/Referral';

type Step = 'loading' | 'login' | 'register' | 'dashboard' | 'cv' | 'overlay' | 'referral';

const App = () => {
  const [step, setStep] = useState<Step>('loading');

  useEffect(() => {
    void (async () => {
      const token = await window.zoomguru.getToken();
      setStep(token ? 'dashboard' : 'login');
    })();
  }, []);

  function handleLogout(): void {
    void window.zoomguru.clearToken();
    setStep('login');
  }

  if (step === 'loading') {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(7,7,11,0.97)', borderRadius: '16px' }} />
    );
  }

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
    return <CvSetup onDone={() => setStep('overlay')} onBack={() => setStep('dashboard')} />;
  }

  if (step === 'referral') {
    return <Referral onBack={() => setStep('overlay')} />;
  }

  return (
    <Overlay
      onLogout={handleLogout}
      onTrialExpired={() => setStep('dashboard')}
      onOpenReferral={() => setStep('referral')}
    />
  );
};

export default App;
