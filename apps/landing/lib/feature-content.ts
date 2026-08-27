// The long-form content for each /features/<slug> page. FEATURES in site.ts
// holds what nav and cards need; this holds what the page itself needs.

export interface FeatureDetail {
  slug: string;
  title: string;
  /** The single line under the h1. */
  lede: string;
  /** Shown inside the overlay panel, as the app would show it. */
  demo: { question: string; answer: string; live?: boolean };
  /** Two or three short blocks. No filler sections. */
  body: { heading: string; text: string }[];
  /** The honest limit. Every page has one — a page without one is an advert. */
  limit: string;
}

export const FEATURE_DETAIL: Record<string, FeatureDetail> = {
  'live-copilot': {
    slug: 'live-copilot',
    title: 'You press once. It answers.',
    lede: 'The question lands, you tap Ctrl+Shift+L, and the answer starts writing itself on your screen before they have finished asking.',
    demo: {
      question: 'Tell me about a time you disagreed with your manager.',
      answer:
        'Use the disagreement over the migration timeline from your last role. Say what you argued, that you brought data rather than opinion, and that you committed fully once the call went the other way. Close on what shipped.',
      live: true,
    },
    body: [
      {
        heading: 'It knows which job you are interviewing for',
        text: 'Your CV and the job description go with every question. That is the difference between an answer about rate limiters in general and an answer about the rate limiter you built, framed for the role you want.',
      },
      {
        heading: 'It writes while they are still talking',
        text: 'The answer streams a word at a time rather than appearing all at once, so you can start speaking off the first line instead of waiting for a finished paragraph and leaving dead air.',
      },
      {
        heading: 'Nothing to click',
        text: 'One shortcut, no window to focus, no button to find. Your hands never leave where the interviewer expects them to be.',
      },
    ],
    limit:
      'It answers what your microphone picks up. If the question is muffled or the interviewer talks over themselves, you will get a worse answer — press again once the question settles.',
  },

  'auto-mode': {
    slug: 'auto-mode',
    title: 'Or press nothing at all.',
    lede: 'Ctrl+Shift+D once, at the start. From then on it hears each question end, transcribes it, and answers — for the rest of the call.',
    demo: {
      question: 'And how would you handle it if that service went down?',
      answer:
        'Fail open, not closed. Explain that the rate limiter is an abuse control rather than a security boundary, so if Redis is unreachable you let requests through and alert, instead of taking the whole product down to enforce a limit.',
      live: true,
    },
    body: [
      {
        heading: 'It works out when a question has ended',
        text: 'Voice detection watches for the end of speech rather than a fixed pause, so it fires when the interviewer actually stops, not three seconds into your reply.',
      },
      {
        heading: 'Best for back-and-forth rounds',
        text: 'Rapid behavioural questions, panel interviews, anything where reaching for a shortcut between every question would show. Turn it on and forget the app exists.',
      },
    ],
    limit:
      'It answers everything it hears, including rhetorical questions and small talk. In a slow, discursive conversation the live copilot on a shortcut is the calmer choice.',
  },

  'screenshot-answers': {
    slug: 'screenshot-answers',
    title: 'For the things they put on screen.',
    lede: 'Ctrl+Shift+S captures what you are looking at — a diagram, a take-home, a block of code — and answers that instead of the audio.',
    demo: {
      question: '[ screenshot — a SQL schema and a question about the join ]',
      answer:
        'The join is on a column with no index, so it is a sequential scan on both tables. Say that first. Then offer the composite index on the two filtered columns, and note it makes the write path slightly slower.',
    },
    body: [
      {
        heading: 'When the question is not spoken',
        text: 'Live coding, a shared architecture diagram, a screen full of a take-home brief. The interviewer says "what do you make of this" and the answer is on the screen, not in the audio.',
      },
      {
        heading: 'It reads what is actually there',
        text: 'The capture goes to a vision model with your CV and the job description attached, so you get an answer about that code, not a generic explanation of the concept.',
      },
    ],
    limit:
      'It captures your screen, so whatever you can see it can see. If the thing you want answered is on a second monitor, move it across first.',
  },

  'invisible-overlay': {
    slug: 'invisible-overlay',
    title: 'On your screen. Not in the share.',
    lede: 'The overlay is excluded from screen capture by the operating system. Zoom, Meet, Teams and recorders all get whatever is behind it.',
    demo: {
      question: 'Interviewer: "Go ahead and share your whole screen."',
      answer:
        'Nothing changes. The share shows your desktop and your editor. The overlay stays on your monitor, out of the capture, and the answer keeps writing.',
    },
    body: [
      {
        heading: 'Enforced below the app, not by the app',
        text: 'The window is marked as protected content at the OS level. Capture software is refused the pixels rather than politely asked to skip them, so it does not depend on which meeting app is running.',
      },
      {
        heading: 'It does not appear in recordings either',
        text: 'The same protection applies to recorded calls and to screenshots taken by the meeting software. If it cannot be captured live, it cannot be captured for playback.',
      },
      {
        heading: 'Ctrl+Shift+H when you want it gone',
        text: 'One shortcut hides it entirely — useful if you are about to hand over control of your machine, or you simply want a clean screen for a moment.',
      },
    ],
    limit:
      'It hides the overlay from capture, not from the room. A person sitting behind you, or a second camera pointed at your monitor, sees what you see.',
  },
};
