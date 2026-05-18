# PATCH-13 — UX: Copy Button + Network Status + Mic Permission + Opacity

## Problem
4 small UX issues that all live in the Electron renderer:
1. No copy button on answers — stressful during live interview
2. No network status indicator — users think app is broken when offline
3. No mic permission error — silent failure when mic denied
4. No opacity control — one size fits nobody

## Files Affected
- `apps/electron/src/overlay/Overlay.tsx`
- `apps/electron/src/overlay/AnswerStream.tsx`
- `apps/electron/src/store/ui.ts` (if using Zustand — else useState)

## Risk Level
🟡 MEDIUM — UI changes to overlay. Test overlay rendering after.

---

## Claude Code Prompt

```
Read .claude/ELECTRON.md first.

I need to add 4 small UX improvements to the Electron overlay.
Apply each one independently. Do not refactor any existing logic.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHANGE 1: Copy Answer Button
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
In apps/electron/src/overlay/Overlay.tsx (or AnswerStream.tsx
wherever the answer text is rendered):

After the answer text display, add a copy button:

  const [copied, setCopied] = useState(false);

  function copyAnswer() {
    if (!answer) return;
    // Strip markdown symbols for clean copy
    const clean = answer
      .replace(/[#*`_~]/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    navigator.clipboard.writeText(clean);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

Add this button in the UI, below the answer text:
  <button onClick={copyAnswer} style={{
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 6,
    color: copied ? '#22c55e' : 'rgba(255,255,255,0.6)',
    fontSize: 11,
    padding: '4px 10px',
    cursor: 'pointer',
    marginTop: 8,
  }}>
    {copied ? '✓ Copied' : 'Copy'}
  </button>

Only show this button when answer is not empty.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHANGE 2: Network Status Indicator
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
In apps/electron/src/overlay/Overlay.tsx:

Add network status state:
  const [isOnline, setIsOnline] = useState(navigator.onLine);

Add event listeners in the existing useEffect:
  window.addEventListener('online', () => setIsOnline(true));
  window.addEventListener('offline', () => setIsOnline(false));
  
  // Cleanup in return:
  return () => {
    window.removeEventListener('online', () => setIsOnline(true));
    window.removeEventListener('offline', () => setIsOnline(false));
  };

In the overlay header (the thin top bar), add this
ONLY when offline:
  {!isOnline && (
    <span style={{ color: '#ef4444', fontSize: 10 }}>
      ⚠ No connection
    </span>
  )}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHANGE 3: Mic Permission Error
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
In apps/electron/src/overlay/Overlay.tsx,
find the handleListen() function.

Wrap the window.zoomguru.startListening() call to catch
permission errors:

  async function handleListen() {
    setIsListening(true);
    try {
      // Check mic permission first
      const stream = await navigator.mediaDevices
        .getUserMedia({ audio: true })
        .catch(() => null);
      
      if (!stream) {
        setAnswer(
          '⚠ Microphone access denied.\n\n' +
          'To fix: System Settings → Privacy → Microphone → Enable ZoomGuru'
        );
        setIsListening(false);
        return;
      }
      
      // Stop the test stream immediately
      stream.getTracks().forEach(t => t.stop());
      
      const transcript = await window.zoomguru.startListening();
      setIsListening(false);
      if (transcript) streamAnswer(transcript);
    } catch {
      setIsListening(false);
      setAnswer('⚠ Could not access microphone. Please check permissions.');
    }
  }

Replace the existing handleListen() entirely with this version.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHANGE 4: Opacity Control
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
In apps/electron/src/overlay/Overlay.tsx:

Add opacity state with persistence:
  const [opacity, setOpacity] = useState<number>(() => {
    const saved = localStorage.getItem('zg_opacity');
    return saved ? parseFloat(saved) : 0.88;
  });

  function handleOpacityChange(val: number) {
    setOpacity(val);
    localStorage.setItem('zg_opacity', val.toString());
  }

In the overlay root div, change the background alpha to use opacity:
  background: `rgba(10, 10, 15, ${opacity})`,

Add an opacity slider in the footer (next to hotkey hints):
  <input
    type="range"
    min={0.5}
    max={0.97}
    step={0.05}
    value={opacity}
    onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
    style={{ width: 60, cursor: 'pointer', accentColor: '#3b82f6' }}
    title="Overlay opacity"
  />

Do NOT change any streaming logic, hotkey handlers,
or the overlay positioning/sizing.
Apply each change one at a time and show me the diff.
```

---

## Verification

```bash
npm run dev

# Test Copy: Get an answer → click Copy → paste somewhere
# Test Network: Disconnect wifi → overlay shows ⚠ No connection
# Test Mic: Deny mic in system settings → try listen mode
#   → should show permission instructions
# Test Opacity: Drag slider → overlay transparency should change
#   → restart app → opacity should be remembered
```

## Rollback
Each change is isolated. Remove the specific addition for
whichever change needs reverting without touching the others.
