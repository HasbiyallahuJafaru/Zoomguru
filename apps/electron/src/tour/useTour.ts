import { useEffect, useRef, useCallback } from 'react';
import type { Driver } from 'driver.js';

interface UseTourOptions {
  isSessionActive: boolean;
  autoLaunch?: boolean;
}

export function useTour({ isSessionActive, autoLaunch = false }: UseTourOptions): {
  startTour: () => Promise<void>;
} {
  const driverRef = useRef<Driver | null>(null);
  const pausedRef = useRef(false);

  async function getDriver(): Promise<Driver> {
    if (!driverRef.current) {
      const { buildTour } = await import('./tour');
      driverRef.current = buildTour(() => {
        void window.zoomguru.tourSetCompleted();
      });
    }
    return driverRef.current;
  }

  const startTour = useCallback(async () => {
    const d = await getDriver();
    if (d.isActive()) return;
    pausedRef.current = false;
    d.drive();
  }, []);

  useEffect(() => {
    if (!autoLaunch) return;
    void (async () => {
      const completed = await window.zoomguru.tourHasCompleted();
      if (!completed) {
        await startTour();
      }
    })();
  }, [autoLaunch, startTour]);

  useEffect(() => {
    const d = driverRef.current;
    if (!d?.isActive()) return;

    if (isSessionActive && !pausedRef.current) {
      pausedRef.current = true;
      d.destroy();
    } else if (!isSessionActive && pausedRef.current) {
      pausedRef.current = false;
      d.drive();
    }
  }, [isSessionActive]);

  useEffect(() => {
    return () => {
      driverRef.current?.destroy();
      driverRef.current = null;
    };
  }, []);

  return { startTour };
}
