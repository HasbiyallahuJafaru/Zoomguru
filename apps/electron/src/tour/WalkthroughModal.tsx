import { useState } from 'react';
import type { CSSProperties } from 'react';

const SANS = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";

const STEPS: { title: string; description: string }[] = [
  {
    title: 'Welcome to ZoomGuru',
    description:
      'Your invisible interview edge. This quick walkthrough covers every feature in under 60 seconds.',
  },
  {
    title: 'Plan Status',
    description:
      'Your subscription status, days remaining, and billing cycle are shown at a glance on the dashboard.',
  },
  {
    title: 'Launch the Overlay',
    description:
      'Click Continue to open the interview copilot. It sits invisibly over your screen — only you can see it.',
  },
  {
    title: 'Interview Copilot',
    description:
      'The transparent overlay listens to questions via your mic and streams AI answers in real time. It is invisible to Zoom screen share.',
  },
  {
    title: 'Noise Suppressor',
    description:
      'The NS button in the overlay header applies a spectral Wiener filter to your mic in real time, removing background noise before transcription.',
  },
  {
    title: 'Auto Mode',
    description:
      'Press Ctrl+Shift+D to enable Auto Mode. Voice activity detection listens continuously and answers questions hands-free — no hotkey needed per question.',
  },
  {
    title: 'Document Copilot',
    description:
      'Upload your CV and paste the job description before the session. Every AI answer is tailored to your background and the specific role.',
  },
  {
    title: "You're Ready",
    description:
      'That covers everything. You can relaunch this walkthrough at any time via "Take the Tour" on the dashboard.',
  },
];

interface WalkthroughModalProps {
  onClose: () => void;
}

export default function WalkthroughModal({ onClose }: WalkthroughModalProps) {
  const [step, setStep] = useState(0);

  const total = STEPS.length;
  const current = STEPS[step];
  const isLast = step === total - 1;

  function handleNext() {
    if (isLast) {
      onClose();
    } else {
      setStep((s) => s + 1);
    }
  }

  function handlePrev() {
    setStep((s) => Math.max(0, s - 1));
  }

  return (
    <div style={s.backdrop as CSSProperties}>
      <div style={s.card}>
        <div style={s.header}>
          <span style={s.stepCount}>{step + 1} / {total}</span>
          <button style={s.skipBtn} onClick={onClose} aria-label="Skip walkthrough">
            Skip
          </button>
        </div>

        <div style={s.progressBar}>
          <div style={{ ...s.progressFill, width: `${((step + 1) / total) * 100}%` }} />
        </div>

        <div style={s.body}>
          <p style={s.title}>{current.title}</p>
          <p style={s.desc}>{current.description}</p>
        </div>

        <div style={s.footer}>
          {step > 0 && (
            <button style={s.backBtn} onClick={handlePrev}>
              Back
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button style={s.nextBtn} onClick={handleNext}>
            {isLast ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

type ElectronStyle = CSSProperties & { WebkitAppRegion?: 'drag' | 'no-drag' };

const s: Record<string, ElectronStyle> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.72)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    fontFamily: SANS,
    WebkitAppRegion: 'no-drag',
  },
  card: {
    width: '290px',
    background: 'rgba(18,18,24,0.98)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '12px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 8px 32px rgba(0,0,0,0.60)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px 10px',
  },
  stepCount: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.28)',
    letterSpacing: '0.3px',
    fontFamily: SANS,
  },
  skipBtn: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.28)',
    fontSize: '10px',
    cursor: 'pointer',
    fontFamily: SANS,
    padding: '2px 0',
    letterSpacing: '0.1px',
  },
  progressBar: {
    height: '2px',
    background: 'rgba(255,255,255,0.07)',
    margin: '0 16px',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'rgba(255,255,255,0.55)',
    borderRadius: '2px',
    transition: 'width 220ms ease',
  },
  body: {
    padding: '20px 16px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  title: {
    margin: 0,
    fontSize: '14px',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.90)',
    fontFamily: SANS,
    letterSpacing: '-0.1px',
  },
  desc: {
    margin: 0,
    fontSize: '11px',
    color: 'rgba(255,255,255,0.45)',
    fontFamily: SANS,
    lineHeight: '1.6',
    letterSpacing: '0.1px',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 16px 14px',
    gap: '8px',
  },
  backBtn: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '5px',
    color: 'rgba(255,255,255,0.40)',
    fontSize: '11px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: SANS,
    padding: '7px 14px',
    letterSpacing: '0.1px',
  },
  nextBtn: {
    background: 'rgba(255,255,255,0.92)',
    border: 'none',
    borderRadius: '5px',
    color: '#07070b',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: SANS,
    padding: '7px 18px',
    letterSpacing: '0.1px',
  },
};
