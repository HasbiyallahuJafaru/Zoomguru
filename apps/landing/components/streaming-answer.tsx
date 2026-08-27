'use client';

import { useEffect, useState } from 'react';

const STEP_MS = 55;

/**
 * Writes the answer out a word at a time, the way the overlay does during a
 * call. Anyone who has asked for reduced motion gets the finished text on the
 * first frame instead — the point is what it says, not the typing.
 */
export function StreamingAnswer({ text, className = '' }: { text: string; className?: string }) {
  const words = text.split(' ');
  const [count, setCount] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setCount(words.length);
      setDone(true);
      return;
    }

    const id = window.setInterval(() => {
      setCount((n) => {
        if (n >= words.length) {
          window.clearInterval(id);
          setDone(true);
          return n;
        }
        return n + 1;
      });
    }, STEP_MS);

    return () => window.clearInterval(id);
  }, [words.length]);

  return (
    <p className={`font-mono text-[0.8125rem] leading-[1.75] text-ink ${done ? '' : 'caret'} ${className}`}>
      <span aria-hidden="true">{words.slice(0, count).join(' ')}</span>
      {/* The whole answer, for screen readers and crawlers, without the typing. */}
      <span className="sr-only">{text}</span>
    </p>
  );
}
