import { useState } from 'react';

interface OnboardingProps {
  onComplete: () => void;
}

const STEPS = [
  {
    title: 'Welcome to ZoomGuru',
    body: "Your invisible AI interview copilot. Only you can see this overlay — it's completely hidden from screen share on Zoom, Meet, and Teams.",
    icon: '👻',
    action: 'Next',
  },
  {
    title: 'Upload Your CV First',
    body: 'ZoomGuru personalizes every answer to your actual experience. Upload your CV now — it only takes a moment.',
    icon: '📄',
    action: 'Upload CV',
    isCVStep: true,
  },
  {
    title: 'Learn Your Hotkeys',
    body: null,
    icon: '⌨️',
    action: 'Got it',
  },
  {
    title: "You're Ready",
    body: 'Start your interview and press ⌘⇧A to listen or ⌘⇧S to capture your screen. Good luck — you\'ve got this.',
    icon: '🎯',
    action: 'Start Using ZoomGuru',
  },
];

const HOTKEYS = [
  { keys: '⌘⇧A', label: 'Listen & Answer' },
  { keys: '⌘⇧S', label: 'Screenshot & Solve' },
  { keys: '⌘⇧H', label: 'Hide / Show' },
  { keys: '⌘⇧R', label: 'Regenerate Answer' },
  { keys: '⌘⇧C', label: 'Clear / New Question' },
];

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  function handleAction() {
    if (isLast) {
      localStorage.setItem('zg_onboarded', '1');
      onComplete();
    } else {
      setStep(s => s + 1);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(8, 8, 12, 0.96)',
      backdropFilter: 'blur(16px)',
      borderRadius: 16,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 32, gap: 24, textAlign: 'center',
    }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {STEPS.map((_, i) => (
          <div key={i} style={{
            width: i === step ? 20 : 6, height: 6,
            borderRadius: 3,
            background: i <= step ? '#3b82f6' : 'rgba(255,255,255,0.15)',
            transition: 'all 0.3s',
          }} />
        ))}
      </div>

      <div style={{ fontSize: 48 }}>{current.icon}</div>

      <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: 0 }}>
        {current.title}
      </h2>

      {current.body && (
        <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, lineHeight: 1.6, maxWidth: 320, margin: 0 }}>
          {current.body}
        </p>
      )}

      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
          {HOTKEYS.map(hk => (
            <div key={hk.keys} style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '8px 12px',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: 8, alignItems: 'center',
            }}>
              <span style={{ color: '#3b82f6', fontSize: 13, fontFamily: 'monospace', fontWeight: 700 }}>{hk.keys}</span>
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>{hk.label}</span>
            </div>
          ))}
        </div>
      )}

      <button onClick={handleAction} style={{
        background: '#3b82f6', color: '#fff', border: 'none',
        borderRadius: 10, padding: '12px 28px',
        fontSize: 14, fontWeight: 600, cursor: 'pointer',
        width: '100%', marginTop: 8,
      }}>
        {current.action}
      </button>

      {!isLast && step !== 1 && (
        <button onClick={() => {
          localStorage.setItem('zg_onboarded', '1');
          onComplete();
        }} style={{
          background: 'none', border: 'none',
          color: 'rgba(255,255,255,0.3)', fontSize: 12,
          cursor: 'pointer', marginTop: -16,
        }}>
          Skip setup
        </button>
      )}
    </div>
  );
}
