'use client';

import Threads from './Threads';
import { useAtmosphere } from '@/lib/use-atmosphere';

// Ultramarine, as 0-1 RGB. Threads draws coloured lines on transparent, so this
// is the thread colour itself rather than a background.
const ULTRAMARINE: [number, number, number] = [0.106, 0.18, 0.839];

/**
 * The drifting thread field behind the whole site. It sits below every page's
 * content and above the paper, so it reads as texture in the paper rather than
 * as a graphic competing with the type.
 *
 * Desktop pointers only — see useAtmosphere for why. On everything else the
 * page is plain white, which is what it looks like under the threads anyway.
 *
 * The home hero paints over this and runs its own rays instead: one
 * atmospheric effect per screen, never two at once.
 */
export function SiteBackdrop() {
  const enabled = useAtmosphere();
  if (!enabled) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 opacity-[0.22]">
      <Threads color={ULTRAMARINE} amplitude={1.1} distance={0.35} />
    </div>
  );
}
