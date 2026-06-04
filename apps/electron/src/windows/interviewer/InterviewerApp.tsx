import { useState, useEffect } from 'react';
import KokoroDisclaimer from './KokoroDisclaimer';
import InterviewerSetup from './InterviewerSetup';
import InterviewerSession from './InterviewerSession';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'dynamic';

export interface SessionConfig {
  cvText: string;
  jdText: string;
  difficulty: Difficulty;
}

type Step = 'loading' | 'kokoro-disclaimer' | 'setup' | 'session';

const InterviewerApp = () => {
  const [step, setStep] = useState<Step>('loading');
  const [config, setConfig] = useState<SessionConfig | null>(null);

  useEffect(() => {
    void (async () => {
      const ready = await window.zoomguru.kokoroCheckReady();
      setStep(ready ? 'setup' : 'kokoro-disclaimer');
    })();
  }, []);

  if (step === 'loading') {
    return (
      <div style={styles.center}>
        <div style={styles.spinner} />
      </div>
    );
  }

  if (step === 'kokoro-disclaimer') {
    return (
      <KokoroDisclaimer
        onReady={() => setStep('setup')}
        onCancel={() => window.zoomguru.closeInterviewer()}
      />
    );
  }

  if (step === 'setup') {
    return (
      <InterviewerSetup
        onStart={(cfg) => {
          setConfig(cfg);
          setStep('session');
        }}
        onClose={() => window.zoomguru.closeInterviewer()}
      />
    );
  }

  if (step === 'session' && config) {
    return (
      <InterviewerSession
        config={config}
        onEnd={() => setStep('setup')}
      />
    );
  }

  return null;
};

const styles: Record<string, React.CSSProperties> = {
  center: {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0a0a0a',
  },
  spinner: {
    width: 32,
    height: 32,
    border: '3px solid #333',
    borderTop: '3px solid #fff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
};

export default InterviewerApp;
