'use client';

import { useEffect, useState } from 'react';
import Threads from './Threads';

// Ultramarine, as 0-1 RGB. Threads draws coloured lines on transparent, so this
// is the thread colour itself rather than a background.
const ULTRAMARINE: [number, number, number] = [0.106, 0.18, 0.839];

/**
 * The drifting thread field behind the whole site. It sits below every page's
 * content and above the paper, so it reads as texture in the paper rather than
 * as a graphic competing with the type.
 *
 * The home page hero paints an opaque background over this and runs its own
 * SideRays instead — one atmospheric effect per screen, never two at once.
 *
 * Threads already parks itself when the tab is hidden or the canvas scrolls out
 * of view. What it has no concept of is reduced motion, so amplitude drops to 0
 * there, which holds the threads straight and still instead of removing them.
 */
export function SiteBackdrop() {
  const [still, setStill] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setStill(query.matches);

    const onChange = (e: MediaQueryListEvent) => setStill(e.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 opacity-[0.22]"
    >
      <Threads color={ULTRAMARINE} amplitude={still ? 0 : 1.1} distance={0.35} />
    </div>
  );
}
