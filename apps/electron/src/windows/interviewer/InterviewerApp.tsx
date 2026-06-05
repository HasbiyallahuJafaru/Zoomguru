import { useState, useEffect } from 'react';
import KokoroDisclaimer from './KokoroDisclaimer';
import InterviewerSetup from './InterviewerSetup';
import InterviewerSession from './InterviewerSession';
import type { TranscriptEntry } from './InterviewerSession';
import Report from './Report';
import { makeDeviceHeaders } from '../../utils';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'dynamic';

export interface SessionConfig {
  cvText: string;
  jdText: string;
  difficulty: Difficulty;
}

export interface PerAnswerScore {
  questionNumber: number;
  question: string;
  score: number;
  assessment: string;
}

export interface ScorerReport {
  overallScore: number;
  answers: PerAnswerScore[];
  strengths: string[];
  improvements: string[];
  nextFocus: string;
}

type Step = 'loading' | 'kokoro-disclaimer' | 'setup' | 'session' | 'scoring' | 'report';

const API_URL = import.meta.env.VITE_API_URL as string;

const InterviewerApp = () => {
  const [step, setStep] = useState<Step>('loading');
  const [config, setConfig] = useState<SessionConfig | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [report, setReport] = useState<ScorerReport | null>(null);
  const [scoringError, setScoringError] = useState<string>('');

  useEffect(() => {
    void (async () => {
      const ready = await window.zoomguru.kokoroCheckReady();
      setStep(ready ? 'setup' : 'kokoro-disclaimer');
    })();
  }, []);

  useEffect(() => {
    if (step !== 'scoring' || transcript.length === 0) return;

    void (async () => {
      try {
        const token = await window.zoomguru.getToken();
        const deviceHeaders = await makeDeviceHeaders();

        const res = await fetch(`${API_URL}/ai/score-session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            ...deviceHeaders,
          },
          body: JSON.stringify({ entries: transcript }),
        });

        if (res.status === 429) {
          const data = (await res.json()) as { error?: string; upgradeCta?: string };
          if (data.error === 'quota_exceeded') {
            setScoringError(data.upgradeCta ?? 'You have reached your report limit. Upgrade to continue.');
          } else {
            setScoringError('Too many requests. Please wait a moment and try again.');
          }
          setStep('report');
          return;
        }

        if (!res.ok) {
          setScoringError('Could not generate report. Please try again later.');
          setStep('report');
          return;
        }

        const data = (await res.json()) as ScorerReport;
        setReport(data);
        setScoringError('');
        setStep('report');
      } catch {
        setScoringError('Could not generate report. Please try again later.');
        setStep('report');
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function handleSessionEnd(entries: TranscriptEntry[]): void {
    if (entries.length === 0) {
      setStep('setup');
      return;
    }
    setTranscript(entries);
    setReport(null);
    setScoringError('');
    setStep('scoring');
  }

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
        onEnd={handleSessionEnd}
      />
    );
  }

  if (step === 'scoring') {
    return (
      <div style={styles.center}>
        <div style={styles.spinner} />
        <span style={styles.scoringText}>Generating your feedback report…</span>
      </div>
    );
  }

  if (step === 'report') {
    if (scoringError) {
      return (
        <div style={styles.center}>
          <span style={{ color: '#ef4444', fontSize: 15, textAlign: 'center', maxWidth: 400 }}>
            {scoringError}
          </span>
          <button style={styles.btnPrimary} onClick={() => setStep('setup')}>
            Back to setup
          </button>
        </div>
      );
    }
    if (report) {
      return (
        <Report
          report={report}
          questionCount={transcript.length}
          onClose={() => setStep('setup')}
        />
      );
    }
  }

  return null;
};

const styles: Record<string, React.CSSProperties> = {
  center: {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0a0a0a',
    gap: 16,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  spinner: {
    width: 32,
    height: 32,
    border: '3px solid #333',
    borderTop: '3px solid #fff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  scoringText: {
    fontSize: 14,
    color: '#666',
  },
  btnPrimary: {
    padding: '12px 32px',
    borderRadius: 10,
    border: 'none',
    background: '#fff',
    color: '#0a0a0a',
    fontWeight: 700,
    fontSize: 15,
    cursor: 'pointer',
    marginTop: 8,
  },
};

export default InterviewerApp;
