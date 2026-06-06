import { useEffect, useRef, useCallback } from 'react';
import { type Driver } from 'driver.js';
import { buildTour } from './tour';

interface UseTourOptions {
  isSessionActive: boolean;
  autoLaunch?: boolean;
}

export function useTour({ isSessionActive, autoLaunch = false }: UseTourOptions): {
  startTour: () => void;
} {
  const driverRef = useRef<Driver | null>(null);
  const pausedRef = useRef(false);

  function getDriver(): Driver {
    if (!driverRef.current) {
      driverRef.current = buildTour(() => {
        void window.zoomguru.tourSetCompleted();
      });
    }
    return driverRef.current;
  }

  const startTour = useCallback(() => {
    const d = getDriver();
    if (d.isActive()) return;
    pausedRef.current = false;
    d.drive();
  }, []);

  useEffect(() => {
    if (!autoLaunch) return;
    void (async () => {
      const completed = await window.zoomguru.tourHasCompleted();
      if (!completed) {
        startTour();
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
