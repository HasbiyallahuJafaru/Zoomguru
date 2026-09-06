'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Screen-by-screen tour of the actual app, one screen at a time.
 *
 * The images are real renders of the shipped components, captured by
 * apps/electron/src/shots.tsx — not mockups. Re-run that harness when a screen
 * changes, or these quietly start advertising an app that no longer exists.
 *
 * Built on native scroll-snap rather than a carousel library: swipe, trackpad
 * and keyboard scrolling all work on their own, and the buttons only have to
 * nudge the scroll container. Nothing here reimplements scrolling.
 *
 * Note there is no Reveal inside a slide. Reveal shows content when it
 * intersects the viewport, and a slide parked off to the right never does —
 * it would stay invisible until scrolled to, then fade in late.
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
  },
];

export function Walkthrough() {
  const track = useRef<HTMLOListElement>(null);
  const [index, setIndex] = useState(0);

  // The scroll position is the source of truth, not a state variable we hope
  // stays in step with it — a swipe moves the container without touching React.
  const syncIndex = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    el.addEventListener('scroll', syncIndex, { passive: true });
    return () => el.removeEventListener('scroll', syncIndex);
  }, [syncIndex]);

  const goTo = useCallback((i: number) => {
    const el = track.current;
    if (!el) return;
    const target = Math.max(0, Math.min(STEPS.length - 1, i));
    el.scrollTo({ left: target * el.clientWidth, behavior: 'smooth' });
  }, []);

  const atStart = index === 0;
  const atEnd = index === STEPS.length - 1;

  return (
    <div className="mt-14">
      <ol
        ref={track}
        className="walk-track"
        tabIndex={0}
        aria-label="App walkthrough, one screen per slide"
      >
        {STEPS.map((step, i) => (
          <li
            key={step.screen}
            className="walk-slide"
            aria-label={`${i + 1} of ${STEPS.length}: ${step.title}`}
            /* Off-screen slides are hidden from the reading order, so a screen
               reader is not handed five screens at once. */
            aria-hidden={i !== index}
          >
            {/* Every slide is the same height, so the controls below do not
                jump as you page through. The tallest slide sets the number. */}
            <div className="grid items-center gap-8 md:min-h-[460px] md:grid-cols-12 md:gap-12">
              <div className="flex justify-center md:col-span-4 md:justify-start">
                {/* Fixed width. The shot is a 420x600 window, so letting it
                    fill the column made it the size of the whole viewport. */}
                <div className="app-shot w-[230px] sm:w-[272px]">
                  <Image
                    src={`/walkthrough/${step.screen}.png`}
                    alt={`ZoomGuru — ${step.title}`}
                    width={420}
                    height={600}
                    quality={90}
                    sizes="272px"
                    className="block h-auto w-full"
                    /* Only the first slide is on screen at load. */
                    priority={i === 0}
                  />
                </div>
              </div>

              <div className="md:col-span-7 md:col-start-6">
                <span className="font-mono text-xs text-overlay">{step.n}</span>
                <h3 className="mt-3 text-2xl md:text-[1.75rem]">{step.title}</h3>
                <p className="mt-3 max-w-[48ch] text-[0.9375rem] leading-relaxed text-muted">
                  {step.body}
                </p>

                <ul className="mt-5 flex flex-col gap-2.5 border-t border-rule pt-5">
                  {step.how.map((line) => (
                    <li key={line} className="flex gap-3 text-sm leading-snug">
                      <span aria-hidden="true" className="mt-[0.6em] h-px w-3.5 shrink-0 bg-overlay" />
                      <span className="text-ink/80">{line}</span>
                    </li>
                  ))}
                </ul>

                {step.keys && (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {step.keys.map((k) => (
                      <kbd key={k} className="keycap">{k}</kbd>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>

      {/* Controls, centred under the slide. Numbers rather than dots, because
          the steps are an order and "03" says where you are in a way a dot
          does not. The arrows flank them so the whole cluster reads as one. */}
      <div className="mt-10 flex items-center justify-center gap-2 border-t border-rule pt-6">
        <button
          type="button"
          onClick={() => goTo(index - 1)}
          disabled={atStart}
          aria-label="Previous screen"
          className="walk-arrow"
        >
          &larr;
        </button>

        <ol className="flex gap-1">
          {STEPS.map((step, i) => (
            <li key={step.screen}>
              <button
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Go to ${step.title}`}
                aria-current={i === index ? 'true' : undefined}
                className={`walk-num ${i === index ? 'is-active' : ''}`}
              >
                {step.n}
              </button>
            </li>
          ))}
        </ol>

        <button
          type="button"
          onClick={() => goTo(index + 1)}
          disabled={atEnd}
          aria-label="Next screen"
          className="walk-arrow"
        >
          &rarr;
        </button>
      </div>
    </div>
  );
}
