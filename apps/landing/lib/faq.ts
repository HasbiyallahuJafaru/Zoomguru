// One source for the FAQ page and the FAQPage structured data, so the markup
// Google reads and the page a person reads can never drift apart.

export interface QA {
  q: string;
  /** Plain sentences. Rendered as separate paragraphs. */
  a: string[];
}

export interface FaqSection {
  title: string;
  items: QA[];
}

export const FAQ: FaqSection[] = [
  {
    title: 'What it is',
    items: [
      {
        q: 'What is ZoomGuru?',
        a: [
          'A Windows app that sits on top of your screen during a job interview. It hears the question through your microphone, works out an answer, and writes that answer onto your display while the interviewer is still talking.',
          'It is one tool with one job: help you answer the question in front of you.',
        ],
      },
      {
        q: 'Can the interviewer see it?',
        a: [
          'No. The overlay is excluded from screen capture at the operating-system level, so it does not appear in a Zoom, Meet or Teams share, and it does not appear in a recording. The interviewer sees whatever is behind it.',
          'It is on your monitor, not in the meeting. If you are on a single screen and share your whole desktop, the share stays clean.',
        ],
      },
      {
        q: 'Which meeting apps does it work with?',
        a: [
          'All of them. ZoomGuru listens to your microphone and draws on your screen, so it does not integrate with the meeting software and does not care which one you use. Zoom, Google Meet, Microsoft Teams, a phone call on speaker — all the same to it.',
        ],
      },
      {
        q: 'Do I need to be a developer to use it?',
        a: [
          'No. ZoomGuru answers from your CV and the job description you give it, so it follows whatever field you are interviewing in. Sales, finance, design, support, engineering — it does not assume a role.',
        ],
      },
    ],
  },
  {
    title: 'Using it',
    items: [
      {
        q: 'What do I do the first time I open it?',
        a: [
          'Sign in, upload your CV, and paste the job description. That takes about two minutes and you only do it once per role.',
          'After that the overlay is running. Start your interview as normal.',
        ],
      },
      {
        q: 'What are the shortcuts?',
        a: [
          'Ctrl+Shift+L answers the question it just heard. Ctrl+Shift+D turns on auto mode, where it answers every question without you pressing anything. Ctrl+Shift+S answers whatever is on the shared screen. Ctrl+Shift+H hides the overlay. Ctrl+Shift+C clears the current answer.',
          'If another program has already claimed one of those, the same key with Alt instead of Shift works as a fallback.',
        ],
      },
      {
        q: 'How does it know anything about the job?',
        a: [
          'Your CV and the job description are attached to every question it answers. That is why it can say "in your role at that company you did X" instead of giving a generic answer off the internet.',
        ],
      },
      {
        q: 'Windows flagged the app. Is something wrong?',
        a: [
          'No. SmartScreen warns about any installer it has not seen often enough yet, which includes ours. Choose More info, then Run anyway.',
        ],
      },
      {
        q: 'Is there a Mac version?',
        a: [
          'Not yet. Windows 10 and later only. The macOS build is in progress and the download page will offer it the day it ships.',
        ],
      },
    ],
  },
  {
    title: 'Privacy',
    items: [
      {
        q: 'Do you store my interview?',
        a: [
          'No. We do not keep your audio, your screenshots, your questions or the answers. Nothing from a session is written to our database.',
          'What we do record is that a request happened and when — a row holding your user ID, the type of request, and a timestamp. That is what tells us the service is working and how much of it you have used. It contains none of the content.',
        ],
      },
      {
        q: 'Where does my audio actually go?',
        a: [
          'Your microphone audio is transcribed, and the transcript plus your CV and job description are sent to the AI model that writes the answer. Screenshots go the same way when you use Ctrl+Shift+S.',
          'That happens over an encrypted connection, for the length of the request, so the answer can be generated. It is not stored on our servers afterwards and it is not used to train anything.',
        ],
      },
      {
        q: 'Is my CV used for training?',
        a: [
          'No. Your CV and job description are kept on your own machine and attached to each request so the answer fits the role. We do not train on them and we do not share them.',
        ],
      },
    ],
  },
  {
    title: 'Plans and billing',
    items: [
      {
        q: 'How many computers can I use it on?',
        a: [
          'Weekly covers one computer at a time. Monthly and yearly cover two, so a laptop and a desktop can both stay signed in.',
          'You can install it on as many machines as you like. The limit is on how many are signed in at once, and you can sign another one out from inside the app whenever you need the slot.',
        ],
      },
      {
        q: 'Is there a free trial?',
        a: [
          'Yes — 30 minutes, no card required. It is enough to run a real question through it and see the answer appear.',
          'One trial per computer, so it cannot be claimed over and over on the same machine.',
        ],
      },
      {
        q: 'How does the price compare to Parakeet AI or LockedIn AI?',
        a: [
          'ZoomGuru is the cheaper option. Our monthly plan is under half what either of them charges for an unlimited monthly plan, and unlike credit-based pricing there is no per-hour meter running while you interview.',
          'The pricing page shows the current numbers side by side, with the date we last checked theirs.',
        ],
      },
      {
        q: 'Can I cancel whenever I want?',
        a: [
          'Yes. Cancelling stops the next charge. You keep access until the period you already paid for runs out.',
        ],
      },
      {
        q: 'What is the refund policy?',
        a: [
          'If the app does not work as described and we cannot fix it within 48 hours of you telling us, you get a full refund inside the first 7 days. Duplicate charges and unauthorised charges are always refunded.',
          'The refund page sets out the details, including what we do not refund.',
        ],
      },
    ],
  },
];

export const ALL_QA: QA[] = FAQ.flatMap((s) => s.items);
