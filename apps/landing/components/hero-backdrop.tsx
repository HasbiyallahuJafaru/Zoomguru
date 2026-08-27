'use client';

import SideRays from './SideRays';
import { useAtmosphere } from '@/lib/use-atmosphere';

/**
 * Light falling across the hero from the top right. It reads as a screen
 * glowing onto paper, which is the same idea the overlay panel carries — so the
 * rays are ultramarine, not the stock yellow.
 *
 * Desktop pointers get the real shader. Everything else gets a static gradient
 * standing in for it: the corner glow survives, at the cost of one composited
 * layer rather than a per-frame WebGL repaint. See useAtmosphere for the
 * measurements behind that.
 */
export function HeroBackdrop() {
  const enabled = useAtmosphere();

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {enabled ? (
        <SideRays
          origin="top-right"
          rayColor1="#1b2ed6"
          rayColor2="#8ea0ff"
          speed={1.1}
          intensity={1.15}
          spread={1.6}
          tilt={-6}
          saturation={1.6}
          blend={0.62}
          falloff={2.8}
          opacity={0.5}
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 90% at 100% 0%, rgba(27,46,214,0.16) 0%, rgba(142,160,255,0.08) 34%, transparent 66%)',
          }}
        />
      )}
    </div>
  );
}
