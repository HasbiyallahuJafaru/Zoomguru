import { driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';

const STEPS: DriveStep[] = [
  {
    popover: {
      title: 'Welcome to ZoomGuru',
      description:
        'Your invisible interview edge. This quick tour covers every feature in under 60 seconds.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '#tour-plan-status',
    popover: {
      title: 'Plan Status',
      description:
        'Your subscription status, days remaining, and billing cycle at a glance.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: '#tour-continue-btn',
    popover: {
      title: 'Launch the Overlay',
      description:
        'Click Continue to open the interview copilot. It sits invisibly over your screen — only you can see it.',
      side: 'top',
      align: 'center',
    },
  },
  {
    popover: {
      title: 'Interview Copilot Window',
      description:
        'The transparent overlay listens to questions via your mic and streams AI answers in real time. It is invisible to Zoom screen share.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    popover: {
      title: 'Noise Suppressor (NS)',
      description:
        'The NS button in the overlay header applies a spectral Wiener filter to your mic in real time, removing background noise before transcription.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    popover: {
      title: 'Auto Mode',
      description:
        'Press Ctrl+Shift+D to enable Auto Mode. Voice activity detection listens continuously and answers questions hands-free — no hotkey needed per question.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    popover: {
      title: 'Document Copilot',
      description:
        'Upload your CV and paste the job description before the session. Every AI answer is tailored to your background and the specific role.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    popover: {
      title: "You're Ready",
      description:
        'That covers everything. Click the × to close this tour at any time. You can relaunch it via "Take the Tour" on the dashboard.',
      side: 'bottom',
      align: 'center',
    },
  },
];

export function buildTour(onComplete: () => void): ReturnType<typeof driver> {
  const d = driver({
    showProgress: true,
    showButtons: ['next', 'previous', 'close'],
    nextBtnText: 'Next',
    prevBtnText: 'Back',
    doneBtnText: 'Done',
    animate: true,
    overlayColor: 'rgba(0, 0, 0, 0.55)',
    smoothScroll: true,
    allowClose: true,
    steps: STEPS,
    onDestroyStarted: () => {
      onComplete();
      d.destroy();
    },
  });
  return d;
}
