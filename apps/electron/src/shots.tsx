// Screenshot harness for the landing page walkthrough.
//
//   npm run dev
//   then open /shots.html?screen=dashboard
//
// Renders the REAL screens, so the images on the site are the app rather than
// a mockup that drifts away from it. Electron's preload bridge and the network
// are the only things replaced: everything visual is the component itself.
//
// Dev-only. It is not referenced by index.html and electron-builder never
// packages it, so it cannot reach a user. Re-run it whenever a screen changes
// and the marketing shots stop lying.
import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import Login from './auth/Login';
import Register from './auth/Register';
import Dashboard from './dashboard/Dashboard';
import CvSetup from './onboarding/CvSetup';
import Overlay from './overlay/Overlay';

const InterviewerSetup = lazy(() => import('./interviewer/InterviewerSetup'));
const MeetingSetup = lazy(() => import('./meeting/MeetingSetup'));

// A structurally valid JWT so the screens that read a name out of it show one.
function fakeJwt(): string {
  const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, '');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
    sub: '00000000-0000-4000-8000-000000000000',
    email: 'ada@example.com',
    name: 'Ada',
    sid: '0'.repeat(32),
    exp: Math.floor(Date.now() / 1000) + 3600,
  })}.signature`;
}

const CV_TEXT =
  'Ada Okafor — Backend Engineer. Six years building payment systems in Python and Node.js. ' +
  'Scaled a payments service to 2,000 requests per second on PostgreSQL and Redis.';
const JD_TEXT =
  'Backend Engineer. Python and distributed systems. Strong data-structures fundamentals required.';

const noop = async () => undefined;

// Every method the preload bridge exposes. Anything not listed resolves
// undefined, which is what an unimplemented IPC call would do anyway.
const bridge: Record<string, unknown> = {
  platform: 'win32',
  getToken: async () => fakeJwt(),
  setToken: noop,
  clearToken: noop,
  loadCV: async () => ({ text: CV_TEXT, filename: 'Ada-Okafor-CV.pdf' }),
  parseCV: async () => ({ text: CV_TEXT, filename: 'Ada-Okafor-CV.pdf' }),
  clearCV: noop,
  loadJD: async () => JD_TEXT,
  saveJD: noop,
  clearJD: noop,
  loadMeetingDoc: async () => ({ text: '', filename: '' }),
  parseMeetingDoc: async () => ({ text: '', filename: '' }),
  clearMeetingDoc: noop,
  getDarkMode: async () => true,
  setDarkMode: noop,
  getNoiseSuppressor: async () => true,
  setNoiseSuppressor: noop,
  getProtectionStatus: async () => true,
  getDevicePublicKey: async () => ({ keyId: 'demo-key', publicKey: 'demo' }),
  signRequest: async () => 'demo-signature',
  requestMicPermission: async () => true,
  // A 1x1 JPEG. The overlay only forwards this to the API, which is stubbed —
  // it needs to be valid base64, not a real screenshot.
  captureScreen: async () =>
    '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
  getSystemAudioSourceId: async () => '',
  // The real default window (createWindow in electron/main.ts) is 420x600.
  // Shoot at that size or the screens photograph as a small panel marooned in
  // a sea of background.
  getWindowBounds: async () => ({ x: 0, y: 0, width: 420, height: 600 }),
  setWindowBounds: noop,
  setMouseIgnore: noop,
  hideWindow: noop,
  setSessionActive: noop,
  openExternal: noop,
  openPayment: noop,
  printReport: noop,
  quitApp: noop,
  tourHasCompleted: async () => true,
  tourSetCompleted: noop,
  // Hotkeys arrive from the main process over IPC, which does not exist here.
  // Keep the callbacks so the capture script can fire one by hand and
  // photograph the overlay mid-answer instead of empty.
  onTrigger: (event: string, cb: (...a: unknown[]) => void) => { triggers.set(event, cb); },
  offTrigger: (event: string) => { triggers.delete(event); },
};

const triggers = new Map<string, (...a: unknown[]) => void>();
(window as unknown as { __trigger: (e: string) => void }).__trigger = (e) => triggers.get(e)?.();
(window as unknown as { zoomguru: unknown }).zoomguru = new Proxy(bridge, {
  get: (t, p: string) => (p in t ? t[p] : noop),
});

// Canned API responses. Matched on substring so a base-URL change cannot
// silently turn these into real network calls.
const CANNED: Array<[string, unknown]> = [
  ['/subscription/status', {
    status: 'active', plan: 'monthly', daysRemaining: 23,
    currentPeriodEnd: new Date(Date.now() + 23 * 864e5).toISOString(),
    trialStartedAt: null, trialEndAt: null, trialActive: false, isAdmin: false,
  }],
  ['/subscription/usage', {
    plan: 'monthly',
    copilot_requests: 34, interviewer_sessions: 2, scorer_reports: 1, doc_copilot_requests: 5,
  }],
  ['/auth/sessions', { max: 2, sessions: [{ sid: '0'.repeat(32), device: 'Windows', lastSeen: new Date().toISOString(), current: true }] }],
  ['/device/register', { success: true }],
];

// The answer the overlay is photographed showing. Written the way the live
// prompt now writes: spoken, concrete, about three sentences.
const DEMO_ANSWER =
  'I used a hash map to trade memory for speed here. It stores each value I have already seen against its index, ' +
  'so the match is a single lookup instead of a second loop. That takes it from O(n squared) to O(n), which is the ' +
  'difference that matters once the input is large.';

// Streams the answer back as real SSE, chunked, so the overlay renders through
// its actual streaming path rather than a shortcut.
function sseResponse(text: string): Response {
  const words = text.split(' ');
  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      for (const w of words) {
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ chunk: w + ' ', done: false })}\n\n`));
      }
      controller.enqueue(enc.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

window.fetch = (async (input: RequestInfo | URL) => {
  const url = String(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  if (url.includes('/ai/stream') || url.includes('/ai/screenshot')) return sseResponse(DEMO_ANSWER);
  if (url.includes('/ai/transcribe')) {
    return new Response(JSON.stringify({ transcript: 'Walk me through how you would solve two sum.' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  }
  const hit = CANNED.find(([frag]) => url.includes(frag));
  return new Response(JSON.stringify(hit ? hit[1] : {}), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}) as typeof fetch;

const screen = new URLSearchParams(location.search).get('screen') ?? 'dashboard';

const SCREENS: Record<string, React.ReactElement> = {
  login: <Login onLogin={() => undefined} onShowRegister={() => undefined} />,
  register: <Register onRegistered={() => undefined} onShowLogin={() => undefined} />,
  dashboard: (
    <Dashboard
      onContinue={() => undefined}
      onOpenMeeting={() => undefined}
      onOpenInterviewer={() => undefined}
      onLogout={() => undefined}
      onStartTour={() => undefined}
    />
  ),
  cv: <CvSetup onDone={() => undefined} onBack={() => undefined} />,
  overlay: <Overlay onLogout={() => undefined} onBack={() => undefined} />,
  interviewer: <InterviewerSetup onStart={() => undefined} onBack={() => undefined} />,
  meeting: <MeetingSetup onDone={() => undefined} onBack={() => undefined} />,
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<div style={{ padding: 40, fontFamily: 'sans-serif' }}>loading…</div>}>
      {SCREENS[screen] ?? <div style={{ padding: 40 }}>unknown screen: {screen}</div>}
    </Suspense>
  </StrictMode>,
);
