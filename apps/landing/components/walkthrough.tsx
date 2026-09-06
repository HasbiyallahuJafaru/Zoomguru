import Image from 'next/image';
import { Reveal } from './reveal';

/**
 * Screen-by-screen tour of the actual app.
 *
 * The images are real renders of the shipped components, captured by
 * apps/electron/src/shots.tsx — not mockups. Re-run that harness when a screen
 * changes, or these quietly start advertising an app that no longer exists.
 *
 * The app window is 420x600, so every shot is portrait. That is what drives
 * the layout: a narrow image column against a wide text column, which is the
 * asymmetry rather than a decorative one.
 */
interface Step {
  n: string;
  screen: string;
  title: string;
  /** The guide. Two or three sentences, no more. */
  body: string;
  /** The literal actions, in order. Short enough to scan. */
  how: string[];
  /** Only where a hotkey genuinely exists. */
  keys?: string[];
  /** The overlay is the product; it gets more room. */
  wide?: boolean;
}

const STEPS: Step[] = [
  {
    n: '01',
    screen: 'register',
    title: 'Make an account',
    body:
      'Email, name, password. Nothing else is asked for, and there is no card at this stage.',
    how: [
      'Enter your email, name and a password',
      'Tick the terms box, then Create Account',
      'You land on the dashboard already signed in',
    ],
  },
  {
    n: '02',
    screen: 'login',
    title: 'Sign in after that',
    body:
      'The app remembers you for three hours at a time, so this screen appears less often than you would expect. Forgot password emails you a reset link.',
    how: [
      'Email and password, or use Forgot password',
      'Monthly and Yearly stay signed in on two computers',
      'A third sign-in asks which device to sign out',
    ],
  },
  {
    n: '03',
    screen: 'dashboard',
    title: 'Check your plan, pick a mode',
    body:
      'The home screen. Your plan and the days left on it sit at the top, and everything the app does starts from here.',
    how: [
      'Plan and remaining days, at a glance',
      'Interview Assistant opens the live copilot',
      'Take the Tour replays the in-app walkthrough',
    ],
  },
  {
    n: '04',
    screen: 'cv',
    title: 'Give it your CV and the job',
    body:
      'The step that decides how good the answers are. Every answer is written against your actual background and the role you applied for, so a generic answer usually means this screen was skipped.',
    how: [
      'Upload a CV as PDF, DOCX, PPTX, TXT or MD',
      'Paste the job description underneath',
      'Save an old .doc as .docx first — it is not read',
    ],
  },
  {
    n: '05',
    screen: 'overlay',
    title: 'The copilot, during the interview',
    body:
      'A transparent panel over your screen. It hears the question, writes the answer, and stays out of the screen share — the interviewer sees an ordinary desktop. Answers are short on purpose, because you are reading them aloud while someone waits.',
    how: [
      'Listen catches one question and answers it',
      'Screenshot answers whatever is on the shared screen',
      'Auto keeps listening and answers each question hands-free',
      'NS filters background noise before it is transcribed',
    ],
    keys: ['Ctrl+Shift+L', 'Ctrl+Shift+S', 'Ctrl+Shift+D', 'Ctrl+Shift+H'],
    wide: true,
  },
  {
    n: '06',
    screen: 'interviewer',
    title: 'Practise before the real one',
    body:
      'A mock interview that asks questions and scores how you answered. Useful the night before, when the live copilot is not what you need yet.',
    how: [
      'Pick a difficulty, from foundational to dynamic',
      'It asks out loud and listens to your answer',
      'You get a scored report at the end',
    ],
  },
  {
    n: '07',
    screen: 'meeting',
    title: 'Meetings and documents too',
    body:
      'The same copilot pointed at a document instead of an interview. Upload the deck or the brief, and it answers against that.',
    how: [
      'Upload the document you will be asked about',
      'It answers from that document during the call',
      'Same overlay, same hotkeys',
    ],
  },
];

export function Walkthrough() {
  return (
    <ol className="mt-16 flex flex-col gap-24 md:gap-32">
      {STEPS.map((step, i) => (
        <li
          key={step.screen}
          className="grid items-center gap-10 md:grid-cols-12 md:gap-14"
        >
          {/* The shot. Narrow column, because the app window really is narrow. */}
          <div className={step.wide ? 'md:col-span-5' : 'md:col-span-4'}>
            <Reveal>
              <div className="app-shot">
                <Image
                  src={`/walkthrough/${step.screen}.png`}
                  alt={`ZoomGuru — ${step.title}`}
                  width={420}
                  height={600}
                  quality={90}
                  sizes="(max-width: 768px) 90vw, 420px"
                  className="block h-auto w-full"
                  /* The first two are near the top of the page on mobile. */
                  priority={i < 2}
                />
              </div>
            </Reveal>
          </div>

          {/* The guide. Offset from the image so the rows do not read as a
              table — the asymmetry is the point. */}
          <div
            className={
              step.wide
                ? 'md:col-span-6 md:col-start-7'
                : 'md:col-span-7 md:col-start-6'
            }
          >
            <Reveal delay={90}>
              <span className="font-mono text-xs text-overlay">{step.n}</span>
              <h3 className="mt-4 text-sub">{step.title}</h3>
              <p className="mt-4 max-w-[46ch] text-[1.0625rem] leading-relaxed text-muted">
                {step.body}
              </p>

              <ul className="mt-7 flex flex-col gap-3 border-t border-rule pt-7">
                {step.how.map((line) => (
                  <li key={line} className="flex gap-3 text-[0.9375rem] leading-snug">
                    <span aria-hidden="true" className="mt-[0.55em] h-px w-4 shrink-0 bg-overlay" />
                    <span className="text-ink/80">{line}</span>
                  </li>
                ))}
              </ul>

              {step.keys && (
                <div className="mt-7 flex flex-wrap gap-2">
                  {step.keys.map((k) => (
                    <kbd key={k} className="keycap">{k}</kbd>
                  ))}
                </div>
              )}
            </Reveal>
          </div>
        </li>
      ))}
    </ol>
  );
}
