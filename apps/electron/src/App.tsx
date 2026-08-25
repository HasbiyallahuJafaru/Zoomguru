import { useState, useEffect, lazy, Suspense } from 'react';
import Login from './auth/Login';
import Register from './auth/Register';
import Dashboard from './dashboard/Dashboard';
import CvSetup from './onboarding/CvSetup';
import Overlay from './overlay/Overlay';
import InterviewerReport, { type ScorerReport, fetchReport } from './interviewer/InterviewerReport';
import { useTour } from './tour/useTour';
import { API_URL } from './utils';
import type { QAEntry } from './interviewer/InterviewerSession';

const Referral = lazy(() => import('./referral/Referral'));
const MeetingSetup = lazy(() => import('./meeting/MeetingSetup'));
const MeetingOverlay = lazy(() => import('./meeting/MeetingOverlay'));
const InterviewerSetup = lazy(() => import('./interviewer/InterviewerSetup'));
const InterviewerSession = lazy(() => import('./interviewer/InterviewerSession'));

type Step = 'loading' | 'login' | 'register' | 'dashboard' | 'cv' | 'overlay' | 'referral' | 'meeting-setup' | 'meeting' | 'interviewer-setup' | 'interviewer-session' | 'interviewer-scoring' | 'interviewer-report';

type Difficulty = 'easy' | 'medium' | 'hard' | 'dynamic';

const App = () => {
  const [step, setStep] = useState<Step>('loading');
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [tourAutoLaunch, setTourAutoLaunch] = useState(false);
  const [meetingDocText, setMeetingDocText] = useState('');
  const [meetingDocFilename, setMeetingDocFilename] = useState('');
  const [interviewConfig, setInterviewConfig] = useState<{ cvText?: string; jdText?: string; difficulty: Difficulty } | null>(null);
  const [interviewReport, setInterviewReport] = useState<ScorerReport | null>(null);
  const [scoringError, setScoringError] = useState('');

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
    // Frees this account's session slot server-side. Best effort: if it fails,
    // the slot ages out on its own.
    void (async () => {
      try {
        const token = await window.zoomguru.getToken();
        if (token) {
          await fetch(`${API_URL}/auth/logout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: '{}',
          });
        }
      } catch {
        // offline — slot expires after its idle window
      }
      await window.zoomguru.clearToken();
    })();
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
        onOpenMeeting={() => setStep('meeting-setup')}
        onOpenInterviewer={() => setStep('interviewer-setup')}
        onLogout={handleLogout}
        onStartTour={startTour}
      />
    );
  }

  const fallback = (
    <div style={{ width: '100vw', height: '100vh', background: 'rgba(7,7,11,0.97)', borderRadius: '16px' }} />
  );

  if (step === 'interviewer-setup') {
    return (
      <Suspense fallback={fallback}>
        <InterviewerSetup
          onStart={(config) => {
            setInterviewConfig({ ...config, difficulty: config.difficulty as Difficulty });
            setStep('interviewer-session');
          }}
          onBack={() => setStep('dashboard')}
        />
      </Suspense>
    );
  }

  if (step === 'interviewer-session' && interviewConfig) {
    return (
      <Suspense fallback={fallback}>
        <InterviewerSession
          cvText={interviewConfig.cvText}
          jdText={interviewConfig.jdText}
          difficulty={interviewConfig.difficulty}
          onFinish={(entries: QAEntry[]) => {
            setStep('interviewer-scoring');
            setScoringError('');
            void fetchReport(entries).then((report) => {
              setInterviewReport(report);
              setStep('interviewer-report');
            }).catch(() => {
              setScoringError('Could not generate report. Please try again.');
              setStep('interviewer-scoring');
            });
          }}
          onExit={() => setStep('dashboard')}
        />
      </Suspense>
    );
  }

  if (step === 'interviewer-scoring') {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(7,7,11,0.97)', borderRadius: '16px', gap: '12px' }}>
        {scoringError ? (
          <>
            <span style={{ color: 'rgba(248,113,113,0.85)', fontSize: '12px', fontFamily: 'system-ui' }}>{scoringError}</span>
            <button onClick={() => setStep('dashboard')} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '6px', color: 'rgba(255,255,255,0.55)', fontSize: '11px', fontFamily: 'system-ui', padding: '7px 16px', cursor: 'pointer' }}>Back to Dashboard</button>
          </>
        ) : (
          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', fontFamily: 'system-ui' }}>Generating your report…</span>
        )}
      </div>
    );
  }

  if (step === 'interviewer-report' && interviewReport) {
    return (
      <InterviewerReport
        report={interviewReport}
        onTryAgain={() => setStep('interviewer-setup')}
        onDone={() => setStep('dashboard')}
      />
    );
  }

  if (step === 'cv') {
    return <CvSetup onDone={() => setStep('overlay')} onBack={() => setStep('dashboard')} />;
  }

  if (step === 'referral') {
    return (
      <Suspense fallback={fallback}>
        <Referral onBack={() => setStep('overlay')} />
      </Suspense>
    );
  }

  if (step === 'meeting-setup') {
    return (
      <Suspense fallback={fallback}>
        <MeetingSetup
          onDone={(text, filename) => {
            setMeetingDocText(text);
            setMeetingDocFilename(filename);
            setStep('meeting');
          }}
          onBack={() => setStep('dashboard')}
        />
      </Suspense>
    );
  }

  if (step === 'meeting') {
    return (
      <Suspense fallback={fallback}>
        <MeetingOverlay
          docText={meetingDocText}
          docFilename={meetingDocFilename}
          onEnd={() => setStep('dashboard')}
          onLogout={handleLogout}
        />
      </Suspense>
    );
  }

  return (
    <Overlay
      onLogout={handleLogout}
      onBack={() => setStep('dashboard')}
      onTrialExpired={() => setStep('dashboard')}
      onOpenReferral={() => setStep('referral')}
      onSessionActiveChange={setIsSessionActive}
    />
  );
};

export default App;
