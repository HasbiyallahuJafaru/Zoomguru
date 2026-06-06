import { useState, useRef, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://zoomguru.onrender.com';

export function useTrialCountdown(
  setSessionCap: (cap: number) => void,
  onTrialExpired?: () => void,
) {
  const [trialMsLeft, setTrialMsLeft] = useState<number | null>(null);
  const trialTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let mounted = true;

    void (async () => {
      const token = await window.zoomguru.getToken();
      try {
        const res = await fetch(`${API_URL}/subscription/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json() as {
          plan: 'monthly' | 'yearly' | null;
          trialEndAt: string | null;
          trialActive: boolean;
        };
        if (data.plan === 'yearly') {
          setSessionCap(Infinity);
        }
        if (data.trialActive && data.trialEndAt) {
          const trialEnd = new Date(data.trialEndAt).getTime();
          function tick() {
            const remaining = trialEnd - Date.now();
            if (remaining <= 0) {
              setTrialMsLeft(0);
              if (trialTimerRef.current) clearInterval(trialTimerRef.current);
              onTrialExpired?.();
            } else {
              setTrialMsLeft(remaining);
            }
          }
          tick();
          if (!mounted) return;
          const id = setInterval(tick, 1000);
          trialTimerRef.current = id;
        }
      } catch { /* keep default cap */ }
    })();

    return () => {
      mounted = false;
      clearInterval(trialTimerRef.current ?? undefined);
    };
  }, []);

  return { trialMsLeft };
}
