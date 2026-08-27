'use client';

import { useEffect, useState } from 'react';

// Both backdrops are WebGL shaders running every frame across the whole
// viewport. Measured on a 390x844 viewport at 6x CPU throttle, they took the
// page from 60fps to 2fps — a 480ms median frame while scrolling. They are
// atmosphere, so they are simply not worth a frame budget on the devices least
// able to pay it.
//
// The gate is a pointer test rather than a width test: a narrow desktop window
// still has a real GPU and a mouse, while a large tablet does not. Reduced
// motion switches them off outright.
const QUERY = '(min-width: 1024px) and (pointer: fine) and (prefers-reduced-motion: no-preference)';

/**
 * Whether this device should render the decorative WebGL backdrops.
 * Always false on the server and on the first client paint, so the markup
 * matches during hydration and the canvas is only ever added afterwards.
 */
export function useAtmosphere(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    setEnabled(mq.matches);

    const onChange = (e: MediaQueryListEvent) => setEnabled(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return enabled;
}
