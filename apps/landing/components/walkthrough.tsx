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
  },
];

const AUTOPLAY_MS = 3000;

export function Walkthrough() {
  const track = useRef<HTMLOListElement>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);

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

  const goTo = useCallback((i: number, smooth = true) => {
    const el = track.current;
    if (!el) return;
    const target = Math.max(0, Math.min(STEPS.length - 1, i));
    el.scrollTo({ left: target * el.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  // Wraps, so the tour keeps going. The wrap itself jumps rather than smooth
  // scrolls: animating back across four slides at once reads as a glitch.
  const step = useCallback((delta: number) => {
    const next = (index + delta + STEPS.length) % STEPS.length;
    goTo(next, Math.abs(next - index) === 1);
  }, [index, goTo]);

  // Advances on its own every three seconds until someone takes over. `index`
  // is a dependency on purpose: every move restarts the countdown, so a slide
  // never gets a fraction of its turn.
  useEffect(() => {
    if (!playing) return;
    // Anyone who asked for less motion gets a carousel that holds still.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const id = setTimeout(() => step(1), AUTOPLAY_MS);
    return () => clearTimeout(id);
  }, [playing, index, step]);

  // The track is a flex row, so every slide stretches to the tallest of them.
  // Stacked on a phone that leaves a long empty drop under the shorter slides,
  // with the controls stranded at the bottom of it. So on mobile the track
  // takes the height of the slide you are actually looking at, and the
  // controls sit under the copy. Desktop keeps one height for all five, so the
  // controls do not hop about while the carousel plays.
  const [trackHeight, setTrackHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    const el = track.current;
    if (!el) return;

    const measure = () => {
      if (!window.matchMedia('(max-width: 767px)').matches) {
        setTrackHeight(undefined);
        return;
      }
      const slide = el.children[index] as HTMLElement | undefined;
      const content = slide?.firstElementChild as HTMLElement | undefined;
      setTrackHeight(content?.getBoundingClientRect().height);
    };

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [index]);

  return (
    <div className="mt-14">
      <ol
        ref={track}
        className="walk-track"
        style={trackHeight ? { height: `${Math.ceil(trackHeight)}px` } : undefined}
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
            {/* Side by side at every width. On a phone that gives the copy a
                narrow column, which is why the type steps down there. Every
                slide is the same height on desktop, so the controls below do
                not jump as you page through. */}
            <div className="grid grid-cols-12 items-center gap-4 sm:gap-8 md:min-h-[460px] md:gap-12">
              <div className="col-span-5 flex justify-center md:col-span-4 md:justify-start">
                {/* Fills its column on a phone; fixed beyond that. The shot is
                    a 420x600 window, so letting it fill a wide column rendered
                    it at the size of the whole viewport. */}
                <div className="app-shot w-full md:w-[272px]">
                  <Image
                    src={`/walkthrough/${step.screen}.png`}
                    alt={`ZoomGuru — ${step.title}`}
                    width={420}
                    height={600}
                    quality={90}
                    sizes="(max-width: 767px) 45vw, 272px"
                    className="block h-auto w-full"
                    /* Only the first slide is on screen at load. */
                    priority={i === 0}
                  />
                </div>
              </div>

              <div className="col-span-7 md:col-span-7 md:col-start-6">
                <span className="font-mono text-[0.625rem] text-overlay sm:text-xs">{step.n}</span>
                <h3 className="mt-2 text-lg sm:mt-3 sm:text-2xl md:text-[1.75rem]">{step.title}</h3>
                <p className="mt-2 max-w-[48ch] text-[0.8125rem] leading-relaxed text-muted sm:mt-3 sm:text-[0.9375rem]">
                  {step.body}
                </p>

                <ul className="mt-3 flex flex-col gap-2 border-t border-rule pt-3 sm:mt-5 sm:gap-2.5 sm:pt-5">
                  {step.how.map((line) => (
                    <li key={line} className="flex gap-2 text-[0.8125rem] leading-snug sm:gap-3 sm:text-sm">
                      <span aria-hidden="true" className="mt-[0.6em] h-px w-2.5 shrink-0 bg-overlay sm:w-3.5" />
                      <span className="text-ink/80">{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </li>
        ))}
      </ol>

      {/* Controls, centred under the slide. Numbers rather than dots, because
          the steps are an order and "03" says where you are in a way a dot
          does not. The arrows flank them so the whole cluster reads as one. */}
      <div className="mt-10 flex items-center justify-center gap-2 border-t border-rule pt-6">
        {/* Back and the numbers take control away: you clicked because you
            wanted to read that one, not to be moved on three seconds later.
            Next is the resume control — it re-arms the countdown. */}
        <button
          type="button"
          onClick={() => { setPlaying(false); step(-1); }}
          aria-label="Previous screen"
          className="walk-arrow"
        >
          &larr;
        </button>

        <ol className="flex gap-1">
          {STEPS.map((s, i) => (
            <li key={s.screen}>
              <button
                type="button"
                onClick={() => { setPlaying(false); goTo(i); }}
                aria-label={`Go to ${s.title}`}
                aria-current={i === index ? 'true' : undefined}
                className={`walk-num ${i === index ? 'is-active' : ''}`}
              >
                {s.n}
              </button>
            </li>
          ))}
        </ol>

        <button
          type="button"
          onClick={() => { setPlaying(true); step(1); }}
          aria-label={playing ? 'Next screen' : 'Next screen, and resume automatic advance'}
          className="walk-arrow"
        >
          &rarr;
        </button>

        {/* Sits at the edge of the row, apart from the stepping controls,
            because it changes the carousel's behaviour rather than its
            position. aria-pressed carries the state; the glyph alone would
            leave a screen reader guessing which way it is about to go. */}
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          aria-pressed={!playing}
          aria-label={playing ? 'Pause automatic advance' : 'Play automatically'}
          title={playing ? 'Pause' : 'Play'}
          className="walk-arrow ml-1"
        >
          {playing ? (
            <svg width="9" height="10" viewBox="0 0 9 10" fill="currentColor" aria-hidden="true">
              <rect x="0" y="0" width="3" height="10" rx="1" />
              <rect x="6" y="0" width="3" height="10" rx="1" />
            </svg>
          ) : (
            <svg width="9" height="10" viewBox="0 0 9 10" fill="currentColor" aria-hidden="true">
              <path d="M0 0.7a.7.7 0 0 1 1.07-.6l7 4.3a.7.7 0 0 1 0 1.2l-7 4.3A.7.7 0 0 1 0 9.3Z" />
            </svg>
          )}
        </button>
      </div>

      {/* Accurate as of auth.service.ts resetPassword(), which calls
          revokeAllSessions() once the new password is saved. Every device
          holding an old token is refused on its next request. */}
      <aside className="mx-auto mt-10 max-w-[62ch] border-t border-rule pt-6">
        <p className="label">Getting your account back</p>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted">
          If other people are signed in on your account and you want it to yourself again,
          reset your password &mdash; <span className="text-ink/80">Forgot password</span> on the
          sign-in screen. The moment the reset is confirmed, every other device is signed out
          and has to sign in again, which they cannot do with the old password.
        </p>
      </aside>
    </div>
  );
}
