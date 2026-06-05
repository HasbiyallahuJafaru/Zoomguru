import { useState, useEffect } from 'react';
import Login from './auth/Login';
import Register from './auth/Register';
import Dashboard from './dashboard/Dashboard';
import CvSetup from './onboarding/CvSetup';
import Overlay from './overlay/Overlay';
import Referral from './referral/Referral';
import { useTour } from './tour/useTour';

type Step = 'loading' | 'login' | 'register' | 'dashboard' | 'cv' | 'overlay' | 'referral';

const App = () => {
  const [step, setStep] = useState<Step>('loading');
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [tourAutoLaunch, setTourAutoLaunch] = useState(false);

  const { startTour } = useTour({
    isSessionActive,
    autoLaunch: tourAutoLaunch,
  });

  useEffect(() => {
    void (async () => {
      const token = await window.zoomguru.getToken();
      if (token) {
        setTourAutoLaunch(true);
        setStep('dashboard');
      } else {
        setStep('login');
      }
    })();
  }, []);

  function handleLogout(): void {
    void window.zoomguru.clearToken();
    setIsSessionActive(false);
    setTourAutoLaunch(false);
    setStep('login');
  }

  function handleReachDashboard(): void {
    setTourAutoLaunch(true);
    setStep('dashboard');
  }

  if (step === 'loading') {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(7,7,11,0.97)', borderRadius: '16px' }} />
    );
  }

  if (step === 'login') {
    return (
      <Login
        onLogin={handleReachDashboard}
        onShowRegister={() => setStep('register')}
      />
    );
  }

  if (step === 'register') {
    return (
      <Register
        onRegistered={handleReachDashboard}
        onShowLogin={() => setStep('login')}
      />
    );
  }

  if (step === 'dashboard') {
    return (
      <Dashboard
        onContinue={() => setStep('cv')}
        onLogout={handleLogout}
        onStartTour={startTour}
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
      onSessionActiveChange={setIsSessionActive}
    />
  );
};

export default App;
