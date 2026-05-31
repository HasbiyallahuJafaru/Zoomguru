import { useState, useEffect, useRef, type CSSProperties } from 'react';

type ElectronStyle = CSSProperties & { WebkitAppRegion?: 'drag' | 'no-drag' };

interface DashboardProps {
  onContinue: () => void;
  onLogout: () => void;
}

type SubStatus = 'inactive' | 'active' | 'past_due' | 'cancelled';

interface SubData {
  status: SubStatus;
  plan: 'monthly' | 'yearly' | null;
  daysRemaining: number | null;
  currentPeriodEnd: string | null;
  trialStartedAt: string | null;
  trialActive: boolean;
}

interface PaystackResponse {
  reference: string;
}

interface PaystackHandler {
  openIframe(): void;
}

interface PaystackSetupConfig {
  key: string;
  email: string;
  plan?: string;
  amount?: number;
  ref: string;
  onClose(): void;
  callback(response: PaystackResponse): void;
}

interface PaystackPopInterface {
  setup(config: PaystackSetupConfig): PaystackHandler;
}

const TRIAL_DURATION_MS = 30 * 60_000;
const API_URL = import.meta.env.VITE_API_URL || 'https://zoomguru.onrender.com';
const SANS  = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
const SERIF = "'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif";

function getEmailFromJwt(token: string): string {
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as { email: string };
    return payload.email;
  } catch {
    return '';
  }
}

function loadPaystackScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById('paystack-inline')) { resolve(); return; }
    const script = document.createElement('script');
    script.id = 'paystack-inline';
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Paystack'));
    document.head.appendChild(script);
  });
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '0:00';
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export default function Dashboard({ onContinue, onLogout }: DashboardProps) {
  const [sub, setSub] = useState<SubData | null>(null);
  const [loadingSub, setLoadingSub] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');
  const [startingTrial, setStartingTrial] = useState(false);
  const [trialError, setTrialError] = useState<string | null>(null);
  const [trialMsLeft, setTrialMsLeft] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start/update the countdown ticker whenever trialStartedAt changes
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (!sub?.trialStartedAt || !sub.trialActive) {
      setTrialMsLeft(null);
      return;
    }

    const trialEnd = new Date(sub.trialStartedAt).getTime() + TRIAL_DURATION_MS;

    function tick() {
      const remaining = trialEnd - Date.now();
      if (remaining <= 0) {
        setTrialMsLeft(0);
        if (timerRef.current) clearInterval(timerRef.current);
        // Refresh status so UI switches to expired state
        void refreshStatus();
      } else {
        setTrialMsLeft(remaining);
      }
    }

    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [sub?.trialStartedAt, sub?.trialActive]);

  async function refreshStatus(): Promise<void> {
    const token = await window.zoomguru.getToken();
    const res = await fetch(`${API_URL}/subscription/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json() as SubData;
      setSub(data);
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        const token = await window.zoomguru.getToken();

        // Register this device's public key with the backend (idempotent).
        void window.zoomguru.getDevicePublicKey().then(({ keyId, publicKey }) =>
          fetch(`${API_URL}/device/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ keyId, publicKey }),
          }),
        );

        const res = await fetch(`${API_URL}/subscription/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) { onLogout(); return; }
        if (res.ok) {
          const data = await res.json() as SubData;
          setSub(data);
        }
      } finally {
        setLoadingSub(false);
      }
    })();
  }, []);

  async function handleStartTrial(): Promise<void> {
    setTrialError(null);
    setStartingTrial(true);
    try {
      const token = await window.zoomguru.getToken();
      const { keyId } = await window.zoomguru.getDevicePublicKey();
      const res = await fetch(`${API_URL}/subscription/trial`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Key-ID': keyId,
        },
      });
      if (res.status === 401) { onLogout(); return; }
      if (!res.ok) {
        const err = await res.json() as { message?: string };
        const msg = err.message ?? '';
        if (msg === 'trial_device_used') {
          setTrialError('This device has already been used for a free trial.');
        } else if (msg === 'trial_already_used') {
          setTrialError('You have already used your free trial.');
        } else {
          setTrialError('Could not start trial. Please try again.');
        }
        return;
      }
      await refreshStatus();
    } finally {
      setStartingTrial(false);
    }
  }

  async function handleSubscribe(): Promise<void> {
    const token = await window.zoomguru.getToken();
    const email = getEmailFromJwt(token);
    const pubKey = 'pk_live_5187e2c64d0f6e607ae278857461ee7a0e5c8d55';
    const isYearly = selectedPlan === 'yearly';

    if (!email) return;

    setVerifyError(false);
    setCheckingOut(true);

    try {
      await loadPaystackScript();
    } catch {
      setCheckingOut(false);
      return;
    }

    // PaystackPop has no npm package — injected via script tag at runtime
    const pop = (window as unknown as { PaystackPop: PaystackPopInterface }).PaystackPop;

    const payConfig: PaystackSetupConfig = {
      key: pubKey,
      email,
      ref: `zg_${Date.now()}`,
      onClose: () => {
        setCheckingOut(false);
      },
      callback: (response) => {
        setCheckingOut(false);
        setVerifying(true);
        void (async () => {
          try {
            const { keyId } = await window.zoomguru.getDevicePublicKey();
            const res = await fetch(`${API_URL}/subscription/verify`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
                'X-Key-ID': keyId,
              },
              body: JSON.stringify({ reference: response.reference }),
            });
            if (res.status === 401) { onLogout(); return; }
            if (!res.ok) { setVerifyError(true); return; }
            await refreshStatus();
          } finally {
            setVerifying(false);
          }
        })();
      },
    };

    payConfig.amount = isYearly ? 50_000_000 : 5_000_000;

    pop.setup(payConfig).openIframe();
  }

  function statusBadgeStyle(): CSSProperties {
    if (sub?.status === 'active') {
      return { ...s.statusBadge, color: 'rgba(52,211,153,0.9)', background: 'rgba(52,211,153,0.12)' };
    }
    if (sub?.trialActive) {
      return { ...s.statusBadge, color: 'rgba(251,191,36,0.9)', background: 'rgba(251,191,36,0.12)' };
    }
    if (sub?.status === 'past_due') {
      return { ...s.statusBadge, color: 'rgba(248,113,113,0.9)', background: 'rgba(248,113,113,0.12)' };
    }
    return s.statusBadge;
  }

  function statusLabel(): string {
    if (loadingSub) return 'Loading…';
    if (!sub) return '—';
    if (sub.status === 'active') return 'Active';
    if (sub.trialActive) return 'Trial';
    if (sub.status === 'past_due') return 'Payment overdue';
    if (sub.status === 'cancelled') return 'Cancelled';
    return 'No active plan';
  }

  function daysLabel(): string {
    if (loadingSub) return 'Loading…';
    if (!sub) return '—';
    if (sub.status === 'active') {
      if (sub.plan === 'yearly') return 'Yearly';
      if (sub.daysRemaining === 0) return 'Expired';
      return `${sub.daysRemaining ?? '—'} days`;
    }
    if (sub.trialActive && trialMsLeft !== null) {
      return formatCountdown(trialMsLeft);
    }
    if (sub.trialStartedAt && !sub.trialActive) return 'Trial expired';
    return '—';
  }

  function billingLabel(): string {
    if (loadingSub) return 'Loading…';
    if (!sub) return '—';
    if (sub.status === 'active') return sub.plan === 'monthly' ? 'Monthly' : 'Yearly';
    if (sub.trialActive) return 'Free trial';
    if (sub.trialStartedAt && !sub.trialActive) return 'Trial used';
    return '—';
  }

  const isActive = sub?.status === 'active';
  const isSubscribeDisabled = loadingSub || isActive || sub?.trialActive || checkingOut || verifying;

  function subscribeLabel(): string {
    if (loadingSub) return 'Loading…';
    if (isActive) return 'Active subscription';
    if (sub?.trialActive) return 'Trial in progress';
    if (verifying) return 'Verifying…';
    if (checkingOut) return 'Opening checkout…';
    return 'Subscribe';
  }

  const showTrialButton = !loadingSub && !isActive && !sub?.trialStartedAt;
  const showContinue = isActive || (sub?.trialActive ?? false);

  return (
    <>
      <style>{`
        .zg-primary:hover:not(:disabled) { opacity: 0.90; }
        .zg-primary:active:not(:disabled) { transform: scale(0.98); }
        .zg-ghost:hover { color: rgba(255,255,255,0.45) !important; }
        .zg-close:hover { color: rgba(255,255,255,0.50) !important; }
        .zg-plan:hover { opacity: 0.85; }
        .zg-trial:hover:not(:disabled) { opacity: 0.85; }
      `}</style>

      <div style={s.root}>
        <button
          className="zg-close"
          style={s.closeBtn}
          onClick={() => { void window.zoomguru.quitApp(); }}
          aria-label="Close"
        >
          ×
        </button>

        <div style={s.content}>
          {/* Wordmark */}
          <div style={s.brand}>
            <span style={s.brandName}>ZoomGuru</span>
            <span style={s.brandTag}>Your invisible interview edge</span>
          </div>

          {/* Subscription card */}
          <div style={s.card}>
            <div style={s.cardRow}>
              <span style={s.cardLabel}>Status</span>
              <span style={statusBadgeStyle()}>{statusLabel()}</span>
            </div>

            <div style={s.divider} />

            <div style={s.cardRow}>
              <span style={s.cardLabel}>
                {sub?.trialActive ? 'Time remaining' : 'Days remaining'}
              </span>
              <span style={sub?.trialActive ? s.countdown : s.cardValue}>
                {daysLabel()}
              </span>
            </div>

            <div style={s.divider} />

            <div style={s.cardRow}>
              <span style={s.cardLabel}>Billing</span>
              <span style={s.cardValue}>{billingLabel()}</span>
            </div>
          </div>

          {/* Free trial button — only shown when eligible */}
          {showTrialButton && (
            <button
              className="zg-trial"
              style={{
                ...s.trialBtn,
                ...(startingTrial ? s.trialBtnDisabled : s.trialBtnEnabled),
              }}
              disabled={startingTrial}
              onClick={() => { void handleStartTrial(); }}
            >
              {startingTrial ? 'Starting…' : 'Start 30-min free trial'}
            </button>
          )}

          {trialError && (
            <p style={s.errorMsg}>{trialError}</p>
          )}

          {/* Plan selector — hidden when active sub or trial running */}
          {!isActive && !sub?.trialActive && (
            <div style={s.planSelector}>
              <button
                className="zg-plan"
                style={selectedPlan === 'monthly' ? s.planBtnActive : s.planBtn}
                onClick={() => setSelectedPlan('monthly')}
              >
                Monthly
              </button>
              <button
                className="zg-plan"
                style={selectedPlan === 'yearly' ? s.planBtnActive : s.planBtn}
                onClick={() => setSelectedPlan('yearly')}
              >
                Yearly
              </button>
            </div>
          )}

          {/* Subscribe button */}
          <button
            className="zg-primary"
            style={{
              ...s.subscribeBtn,
              ...(isSubscribeDisabled ? s.subscribeBtnDisabled : s.subscribeBtnEnabled),
            }}
            disabled={isSubscribeDisabled}
            onClick={() => { void handleSubscribe(); }}
          >
            {subscribeLabel()}
          </button>

          {verifyError && (
            <p style={s.errorMsg}>
              Payment received but confirmation failed. Please contact support.
            </p>
          )}

          {/* Continue to app — shown when subscription is active or trial is running */}
          <div style={s.actions}>
            {showContinue && (
              <button
                className="zg-primary"
                style={s.continueBtn}
                onClick={onContinue}
              >
                Continue →
              </button>
            )}
            <button
              className="zg-ghost"
              style={s.logoutBtn}
              onClick={onLogout}
            >
              Log out
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

const s: Record<string, ElectronStyle> = {
  root: {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(7, 7, 11, 0.97)',
    borderRadius: '16px',
    position: 'relative',
    overflow: 'hidden',
    fontFamily: SANS,
    WebkitAppRegion: 'drag',
  },
  closeBtn: {
    position: 'absolute',
    top: '12px',
    right: '14px',
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.22)',
    fontSize: '18px',
    lineHeight: '1',
    cursor: 'pointer',
    padding: '2px 4px',
    transition: 'color 120ms ease',
    fontFamily: SANS,
    WebkitAppRegion: 'no-drag',
  },
  content: {
    width: '100%',
    maxWidth: '290px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: '16px',
    WebkitAppRegion: 'no-drag',
  },
  brand: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '7px',
    marginBottom: '4px',
  },
  brandName: {
    fontSize: '28px',
    fontWeight: 400,
    fontStyle: 'italic',
    fontFamily: SERIF,
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: '0.2px',
    textAlign: 'center',
  },
  brandTag: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.28)',
    fontFamily: SANS,
    letterSpacing: '0.2px',
    textAlign: 'center',
  },
  card: {
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  cardRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '11px 14px',
  },
  divider: {
    height: '1px',
    background: 'rgba(255,255,255,0.06)',
  },
  cardLabel: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.30)',
    fontFamily: SANS,
    letterSpacing: '0.1px',
  },
  cardValue: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.55)',
    fontFamily: SANS,
  },
  countdown: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'rgba(251,191,36,0.9)',
    fontFamily: SANS,
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '0.5px',
  },
  statusBadge: {
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '0.2px',
    color: 'rgba(255,255,255,0.28)',
    background: 'rgba(255,255,255,0.06)',
    padding: '3px 8px',
    borderRadius: '4px',
    fontFamily: SANS,
  },
  trialBtn: {
    width: '100%',
    padding: '10px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: 500,
    fontFamily: SANS,
    letterSpacing: '0.1px',
    textAlign: 'center',
    transition: 'opacity 120ms ease',
    cursor: 'pointer',
    border: '1px solid rgba(251,191,36,0.25)',
  },
  trialBtnEnabled: {
    background: 'rgba(251,191,36,0.10)',
    color: 'rgba(251,191,36,0.85)',
  },
  trialBtnDisabled: {
    background: 'rgba(255,255,255,0.05)',
    color: 'rgba(255,255,255,0.25)',
    cursor: 'not-allowed',
  },
  planSelector: {
    display: 'flex',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '6px',
    overflow: 'hidden',
  },
  planBtn: {
    flex: 1,
    padding: '8px',
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.35)',
    fontSize: '11px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: SANS,
    letterSpacing: '0.1px',
    transition: 'opacity 120ms ease',
    textAlign: 'center',
  },
  planBtnActive: {
    flex: 1,
    padding: '8px',
    background: 'rgba(255,255,255,0.92)',
    border: 'none',
    color: '#07070b',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: SANS,
    letterSpacing: '0.1px',
    transition: 'opacity 120ms ease',
    textAlign: 'center',
  },
  subscribeBtn: {
    width: '100%',
    padding: '11px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 500,
    fontFamily: SANS,
    letterSpacing: '0.1px',
    textAlign: 'center',
    transition: 'opacity 120ms ease, transform 100ms ease',
    border: '1px solid rgba(255,255,255,0.10)',
  },
  subscribeBtnEnabled: {
    background: 'rgba(255,255,255,0.12)',
    color: 'rgba(255,255,255,0.80)',
    cursor: 'pointer',
  },
  subscribeBtnDisabled: {
    background: 'rgba(255,255,255,0.07)',
    color: 'rgba(255,255,255,0.28)',
    cursor: 'not-allowed',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
  },
  continueBtn: {
    width: '100%',
    padding: '11px',
    background: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    color: '#07070b',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: SANS,
    transition: 'opacity 120ms ease, transform 100ms ease',
    letterSpacing: '-0.1px',
    textAlign: 'center',
  },
  logoutBtn: {
    width: '100%',
    padding: '8px',
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.22)',
    fontSize: '11px',
    cursor: 'pointer',
    fontFamily: SANS,
    transition: 'color 120ms ease',
    letterSpacing: '0.1px',
    textAlign: 'center' as const,
  },
  errorMsg: {
    margin: 0,
    fontSize: '10px',
    color: 'rgba(248,113,113,0.85)',
    textAlign: 'center' as const,
    fontFamily: SANS,
    letterSpacing: '0.1px',
  },
};
