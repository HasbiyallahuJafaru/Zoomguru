'use client';

import { useEffect, useState } from 'react';
import SideRays from './SideRays';

/**
 * Light falling across the hero from the top right. It reads as a screen
 * glowing onto paper, which is the same idea the overlay panel carries — so the
 * rays are ultramarine, not the stock yellow.
 *
 * SideRays already parks itself when scrolled out of view. What it does not do
 * is respect reduced motion, so we hold it still for anyone who asked for that.
 */
export function HeroBackdrop() {
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
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <SideRays
        origin="top-right"
        rayColor1="#1b2ed6"
        rayColor2="#8ea0ff"
        // Held at 0 rather than unmounted so the rays stay put instead of
        // vanishing for reduced-motion readers.
        speed={still ? 0 : 1.1}
        intensity={1.15}
        spread={1.6}
        tilt={-6}
        saturation={1.6}
        blend={0.62}
        falloff={2.8}
        opacity={0.5}
      />
    </div>
  );
}
