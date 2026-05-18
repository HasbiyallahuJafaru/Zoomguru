# PATCH-20 — First Launch Onboarding Flow

## Problem
User installs app, logs in, sees overlay with no guidance.
No CV prompt, no hotkey explanation, no dry run.
First 60 seconds determines whether they keep the app.

## Files Affected
- `apps/electron/src/onboarding/Onboarding.tsx` (new)
- `apps/electron/src/App.tsx`

## Risk Level
🟡 MEDIUM — New component + one-line change in App.tsx.

---

## Claude Code Prompt

```
Read .claude/ELECTRON.md first.

I need to add a first-launch onboarding flow.
It shows once, then never again (stored in electron-store).

STEP 1: Create apps/electron/src/onboarding/Onboarding.tsx

The component has 4 steps. Keep styling consistent with
the existing overlay (dark, semi-transparent, same font).

import { useState } from 'react';

interface OnboardingProps {
  onComplete: () => void;
}

const STEPS = [
  {
    title: 'Welcome to ZoomGuru',
    body: 'Your invisible AI interview copilot. Only you can see this overlay — it\'s completely hidden from screen share on Zoom, Meet, and Teams.',
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
    body: null,   // rendered separately as hotkey grid
    icon: '⌨️',
    action: 'Got it',
  },
  {
    title: 'You\'re Ready',
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
  const [cvDone, setCVDone] = useState(false);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  function handleAction() {
    if (current.isCVStep) {
      // Open CV upload view
      // For now, allow skip with note
      setCVDone(true);
    }
    if (isLast) {
      // Mark onboarding complete in local storage
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
      {/* Step indicator */}
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

      {/* Icon */}
      <div style={{ fontSize: 48 }}>{current.icon}</div>

      {/* Title */}
      <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: 0 }}>
        {current.title}
      </h2>

      {/* Body */}
      {current.body && (
        <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14,
          lineHeight: 1.6, maxWidth: 320, margin: 0 }}>
          {current.body}
        </p>
      )}

      {/* Hotkeys grid (step 2 only) */}
      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
          {HOTKEYS.map(hk => (
            <div key={hk.keys} style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '8px 12px',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: 8, alignItems: 'center',
            }}>
              <span style={{ color: '#3b82f6', fontSize: 13, fontFamily: 'monospace',
                fontWeight: 700 }}>{hk.keys}</span>
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>{hk.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Action button */}
      <button onClick={handleAction} style={{
        background: '#3b82f6',
        color: '#fff', border: 'none',
        borderRadius: 10, padding: '12px 28px',
        fontSize: 14, fontWeight: 600,
        cursor: 'pointer', width: '100%',
        marginTop: 8,
      }}>
        {current.action}
      </button>

      {/* Skip (not on last step) */}
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

STEP 2: In apps/electron/src/App.tsx,
add onboarding gate as the FIRST thing rendered:

import { useState } from 'react';
import { Onboarding } from './onboarding/Onboarding';

Inside the App component, add:
  const [onboarded] = useState(() => {
    return localStorage.getItem('zg_onboarded') === '1';
  });
  const [showOnboarding, setShowOnboarding] = useState(!onboarded);

In the return, wrap existing content:
  if (showOnboarding) {
    return <Onboarding onComplete={() => setShowOnboarding(false)} />;
  }
  // ... existing return content ...

Do not change the existing overlay rendering.
Just add the conditional before it.
Show me both file diffs.
```

---

## Verification

```bash
npm run dev

# 1. Clear localStorage: localStorage.removeItem('zg_onboarded')
# 2. Reload → should see Welcome step
# 3. Click through all 4 steps
# 4. On completion → normal overlay appears
# 5. Restart app → onboarding should NOT show again
# 6. Set localStorage.setItem('zg_onboarded','1') → skip onboarding
```

## Rollback
Delete apps/electron/src/onboarding/Onboarding.tsx.
Remove the onboarded state and showOnboarding conditional from App.tsx.
