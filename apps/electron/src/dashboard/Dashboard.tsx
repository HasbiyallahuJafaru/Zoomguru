import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { API_URL, formatCountdown } from '../utils';

type ElectronStyle = CSSProperties & { WebkitAppRegion?: 'drag' | 'no-drag' };

interface DashboardProps {
  onContinue: () => void;
  onOpenMeeting: () => void;
  onOpenInterviewer: () => void;
  onLogout: () => void;
  onStartTour?: () => void | Promise<void>;
}

type SubStatus = 'inactive' | 'active' | 'past_due' | 'cancelled';
type PlanType = 'weekly' | 'monthly' | 'yearly';

interface SubData {
  status: SubStatus;
  plan: PlanType | null;
  daysRemaining: number | null;
  currentPeriodEnd: string | null;
  trialStartedAt: string | null;
  trialEndAt: string | null;
  trialActive: boolean;
  isAdmin: boolean;
}

const SANS  = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
const SERIF = "'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif";

function getFirstNameFromJwt(token: string): string {
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as { name?: string; email?: string };
    if (payload.name) return payload.name.split(' ')[0];
    return '';
  } catch {
    return '';
  }
}

const PLAN_LABELS: Record<PlanType, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

// Ordering used to decide which plans count as an "upgrade" from the current one.
const PLAN_RANK: Record<string, number> = { weekly: 1, monthly: 2, yearly: 3, lifetime: 4 };

export default function Dashboard({ onContinue, onOpenMeeting, onOpenInterviewer, onLogout, onStartTour }: DashboardProps) {
  const [sub, setSub] = useState<SubData | null>(null);
  const [loadingSub, setLoadingSub] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
  const [startingTrial, setStartingTrial] = useState(false);
  const [trialError, setTrialError] = useState<string | null>(null);
  const [deviceRegError, setDeviceRegError] = useState<string | null>(null);
  const [trialMsLeft, setTrialMsLeft] = useState<number | null>(null);
  const [firstName, setFirstName] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkingOutRef = useRef(false);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (!sub?.trialEndAt || !sub.trialActive) {
      setTrialMsLeft(null);
      return;
    }

    const trialEnd = new Date(sub.trialEndAt).getTime();

    function tick() {
      const remaining = trialEnd - Date.now();
      if (remaining <= 0) {
        setTrialMsLeft(0);
        if (timerRef.current) clearInterval(timerRef.current);
        void refreshStatus();
      } else {
        setTrialMsLeft(remaining);
      }
    }

    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [sub?.trialEndAt, sub?.trialActive]);

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
        setFirstName(getFirstNameFromJwt(token));

        try {
          const { keyId, publicKey } = await window.zoomguru.getDevicePublicKey();
          await fetch(`${API_URL}/device/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ keyId, publicKey }),
          });
        } catch (err) {
          console.error('Device registration failed:', err);
          setDeviceRegError('Device registration failed. Please restart the app.');
          return;
        }

        const statusRes = await fetch(`${API_URL}/subscription/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (statusRes.status === 401) { onLogout(); return; }
        if (statusRes.ok) {
          const data = await statusRes.json() as SubData;
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

  // Poll /subscription/status until it reports active. confirmCheckout activates
  // synchronously before the success redirect (and getStatus reads the DB
  // directly, no cache), so the first poll normally wins instantly.
  async function pollUntilActive(attempts: number, intervalMs: number): Promise<boolean> {
    const token = await window.zoomguru.getToken();
    for (let i = 0; i < attempts; i++) {
      const res = await fetch(`${API_URL}/subscription/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) { onLogout(); return false; }
      if (res.ok) {
        const data = await res.json() as SubData;
        setSub(data);
        if (data.status === 'active') return true;
      }
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, intervalMs));
    }
    return false;
  }

  // Authenticated last-resort verify. If the hosted-checkout confirm didn't land
  // (e.g. its request was cut off when the payment window closed), verify the
  // reference directly with our JWT + device key. This also binds the device.
  // Safe against double-activation: the backend rejects already-used references.
  async function verifyReference(reference: string): Promise<boolean> {
    try {
      const [token, { keyId }] = await Promise.all([
        window.zoomguru.getToken(),
        window.zoomguru.getDevicePublicKey(),
      ]);
      const res = await fetch(`${API_URL}/subscription/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Key-ID': keyId,
        },
        body: JSON.stringify({ reference }),
      });
      if (res.ok) { await refreshStatus(); return true; }
    } catch {
      // fall back to polling for the webhook
    }
    return false;
  }

  async function handleSubscribe(planOverride?: 'weekly' | 'monthly' | 'yearly'): Promise<void> {
    const plan = planOverride ?? selectedPlan;

    setVerifyError(false);
    setCheckingOut(true);
    checkingOutRef.current = true;

    try {
      const token = await window.zoomguru.getToken();
      const res = await fetch(`${API_URL}/payments/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan }),
      });
      if (res.status === 401) { onLogout(); return; }
      if (!res.ok) { setVerifyError(true); return; }

      const { checkout_url } = await res.json() as { checkout_url: string };
      const result = await window.zoomguru.openPayment(checkout_url);

      if (result.status === 'success') {
        setVerifying(true);
        try {
          // Fast path: confirm already activated → first poll wins (~instant).
          let active = await pollUntilActive(4, 700);
          // Reliable path: confirm was interrupted → verify the reference directly.
          if (!active && result.reference) {
            active = await verifyReference(result.reference);
          }
          // Backstop: give the Paystack webhook a little longer to land.
          if (!active) active = await pollUntilActive(6, 1500);
          if (!active) setVerifyError(true);
        } finally {
          setVerifying(false);
        }
      }
      // 'cancelled' / 'error' — leave the dashboard as-is so the user can retry.
    } catch {
      setVerifyError(true);
    } finally {
      setCheckingOut(false);
      checkingOutRef.current = false;
    }
  }

  // Break a raw day count into "X months, Y days left" so longer plans (monthly
  // renewals, yearly) read naturally instead of e.g. "340 days left".
  function formatRemaining(days: number): string {
    if (days <= 0) return 'Expired';
    const months = Math.floor(days / 30);
    const rest = days % 30;
    const monthPart = months > 0 ? `${months} month${months === 1 ? '' : 's'}` : '';
    const dayPart = rest > 0 ? `${rest} day${rest === 1 ? '' : 's'}` : '';
    const joined = [monthPart, dayPart].filter(Boolean).join(', ');
    return `${joined} left`;
  }

  function daysLabel(): string {
    if (loadingSub) return '—';
    if (!sub) return '—';
    if (sub.status === 'active') {
      if (sub.daysRemaining === null) return '—';
      return formatRemaining(sub.daysRemaining);
    }
    if (sub.trialActive) return 'Trial active';
    return '—';
  }

  function planLabel(): string {
    if (loadingSub) return '—';
    if (!sub) return '—';
    if (sub.status === 'active' && sub.plan) return PLAN_LABELS[sub.plan];
    if (sub.trialActive) return 'Free trial';
    return 'No active plan';
  }

  const isActive = sub?.status === 'active';
  const isSubscribeDisabled = loadingSub || isActive || checkingOut || verifying;

  function subscribeLabel(): string {
    if (loadingSub) return 'Loading…';
    if (isActive) return 'Active subscription';
    if (verifying) return 'Verifying…';
    if (checkingOut) return 'Opening checkout…';
    if (sub?.trialActive) return 'Upgrade now';
    return 'Subscribe';
  }

  const showTrialButton = !loadingSub && !isActive && !sub?.trialStartedAt;
  const showContinue = isActive || (sub?.trialActive ?? false);
  // Every plan ranked above the current one is offered as an upgrade — e.g. a
  // weekly subscriber sees both Monthly and Yearly, a monthly sees Yearly.
  const upgradeTargets = (['monthly', 'yearly'] as const).filter(
    (p) => PLAN_RANK[p] > (PLAN_RANK[sub?.plan ?? ''] ?? 0),
  );
  const showUpgradeCta = isActive && upgradeTargets.length > 0;

  return (
    <>
      <style>{`
        .zg-primary:hover:not(:disabled) { opacity: 0.90; }
        .zg-primary:active:not(:disabled) { transform: scale(0.98); }
        .zg-ghost:hover { color: rgba(255,255,255,0.45) !important; }
        .zg-close:hover { color: rgba(255,255,255,0.50) !important; }
        .zg-plan:hover { opacity: 0.85; }
        .zg-trial:hover:not(:disabled) { opacity: 0.85; }
        .zg-tool-main:hover:not(:disabled) { background: rgba(255,255,255,0.07) !important; }
        .zg-tool-main:active:not(:disabled) { transform: scale(0.99); }
        .zg-admin:hover { color: rgba(255,255,255,0.45) !important; }
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
          </div>

          {/* Welcome */}
          {!loadingSub && (
            <div style={s.welcome}>
              <span style={s.welcomeText}>
                {firstName ? `Welcome back, ${firstName}.` : 'Welcome back.'}
              </span>
            </div>
          )}

          {deviceRegError && (
            <p style={s.errorMsg}>{deviceRegError}</p>
          )}

          {/* Subscription status — only show when active or trial */}
          {(isActive || sub?.trialActive) && (
            <div style={s.subInfo}>
              <div style={s.subInfoRow}>
                <span style={s.subInfoLabel}>Plan</span>
                <span style={s.subInfoValue}>{planLabel()}</span>
              </div>
              <div style={s.subDivider} />
              <div style={s.subInfoRow}>
                <span style={s.subInfoLabel}>Access</span>
                <span style={s.subInfoValue}>{daysLabel()}</span>
              </div>
            </div>
          )}

          {/* Trial countdown */}
          {sub?.trialActive && trialMsLeft !== null && (
            <div style={s.trialCountdownRow}>
              <span style={s.trialCountdownLabel}>Trial ends in</span>
              <span style={s.trialCountdownValue}>{formatCountdown(trialMsLeft)}</span>
            </div>
          )}

          {/* Interview Assistant — primary action */}
          {showContinue && (
            <div id="tour-tools" style={s.toolSection}>
              <button
                className="zg-tool-main"
                style={s.mainToolBtn}
                onClick={onContinue}
              >
                <span style={s.mainToolLabel}>Interview Assistant</span>
                <span style={s.mainToolDesc}>
                  Sits invisibly on your screen during interviews. Listens to questions,
                  captures screenshots, and streams AI answers in real time — visible
                  only to you.
                </span>
                <span style={s.mainToolArrow}>→</span>
              </button>
            </div>
          )}

          {/* Upgrade CTA */}
          {showUpgradeCta && (
            <div style={s.upgradeCta}>
              <span style={s.upgradeText}>Upgrade your plan</span>
              {upgradeTargets.map((p) => (
                <button
                  key={p}
                  className="zg-primary"
                  style={s.upgradeBtn}
                  onClick={() => { void handleSubscribe(p); }}
                >
                  Upgrade to {PLAN_LABELS[p]}
                </button>
              ))}
            </div>
          )}

          {/* Free trial */}
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

          {trialError && <p style={s.errorMsg}>{trialError}</p>}

          {/* Plan selector */}
          {!isActive && (
            <div style={s.planSelector}>
              {(['weekly', 'monthly', 'yearly'] as const).map((p) => (
                <button
                  key={p}
                  className="zg-plan"
                  style={selectedPlan === p ? s.planBtnActive : s.planBtn}
                  onClick={() => setSelectedPlan(p)}
                >
                  {PLAN_LABELS[p]}
                </button>
              ))}
            </div>
          )}

          {/* Subscribe */}
          {!isActive && (
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
          )}

          {verifyError && (
            <p style={s.errorMsg}>
              Payment received but confirmation failed. Please contact support.
            </p>
          )}

          {/* Footer actions */}
          <div style={s.actions}>
            {onStartTour && (
              <button className="zg-ghost" style={s.footerBtn} onClick={onStartTour}>
                Take the Tour
              </button>
            )}
            {sub?.isAdmin && (
              <button
                className="zg-admin"
                style={{ ...s.footerBtn, color: 'rgba(248,113,113,0.40)' }}
                onClick={() => {
                  const adminUrl = (import.meta.env.VITE_ADMIN_URL as string | undefined) ?? `${API_URL.replace(':3000', ':5174')}`;
                  void window.zoomguru.openExternal(`${adminUrl}/broadcast`);
                }}
              >
                Broadcast Mail
              </button>
            )}
            <button className="zg-ghost" style={s.footerBtn} onClick={onLogout}>
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
    flexDirection: 'column',
    alignItems: 'center',
    background: 'rgba(7, 7, 11, 0.97)',
    borderRadius: '16px',
    position: 'relative',
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: '16px 0',
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
    maxWidth: '300px',
    margin: 'auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: '12px',
    WebkitAppRegion: 'no-drag',
    paddingBottom: '8px',
  },
  brand: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: '2px',
  },
  brandName: {
    fontSize: '22px',
    fontWeight: 400,
    fontStyle: 'italic',
    fontFamily: SERIF,
    color: 'rgba(255,255,255,0.80)',
    letterSpacing: '0.2px',
    textAlign: 'center',
  },
  welcome: {
    textAlign: 'center',
    marginBottom: '4px',
  },
  welcomeText: {
    fontSize: '13px',
    fontWeight: 400,
    color: 'rgba(255,255,255,0.55)',
    fontFamily: SANS,
    letterSpacing: '-0.1px',
  },
  subInfo: {
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  subInfoRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
  },
  subDivider: {
    height: '1px',
    background: 'rgba(255,255,255,0.05)',
  },
  subInfoLabel: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.25)',
    fontFamily: SANS,
    letterSpacing: '0.1px',
  },
  subInfoValue: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.60)',
    fontFamily: SANS,
  },
  trialCountdownRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  trialCountdownLabel: {
    fontSize: '10px',
    color: 'rgba(251,191,36,0.45)',
    fontFamily: SANS,
  },
  trialCountdownValue: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'rgba(251,191,36,0.80)',
    fontFamily: SANS,
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '0.5px',
  },
  toolSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  mainToolBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '6px',
    padding: '16px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'background 140ms ease, transform 100ms ease',
    fontFamily: SANS,
    textAlign: 'left' as const,
    position: 'relative',
  },
  mainToolLabel: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'rgba(255,255,255,0.88)',
    fontFamily: SANS,
    letterSpacing: '-0.1px',
  },
  mainToolDesc: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.35)',
    fontFamily: SANS,
    lineHeight: '1.55',
    letterSpacing: '0.05px',
  },
  mainToolArrow: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.30)',
    alignSelf: 'flex-end',
    marginTop: '2px',
  },
  upgradeCta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '12px 14px',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '8px',
  },
  upgradeText: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.35)',
    fontFamily: SANS,
    textAlign: 'center' as const,
  },
  upgradeBtn: {
    width: '100%',
    padding: '9px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: 500,
    fontFamily: SANS,
    letterSpacing: '0.1px',
    textAlign: 'center' as const,
    background: 'rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.70)',
    border: '1px solid rgba(255,255,255,0.10)',
    cursor: 'pointer',
    transition: 'opacity 120ms ease',
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
    border: '1px solid rgba(255,255,255,0.08)',
  },
  trialBtnEnabled: {
    background: 'rgba(255,255,255,0.06)',
    color: 'rgba(255,255,255,0.60)',
  },
  trialBtnDisabled: {
    background: 'rgba(255,255,255,0.03)',
    color: 'rgba(255,255,255,0.20)',
    cursor: 'not-allowed',
  },
  planSelector: {
    display: 'flex',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '6px',
    overflow: 'hidden',
  },
  planBtn: {
    flex: 1,
    padding: '8px',
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.30)',
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
    background: 'rgba(255,255,255,0.10)',
    color: 'rgba(255,255,255,0.78)',
    cursor: 'pointer',
  },
  subscribeBtnDisabled: {
    background: 'rgba(255,255,255,0.05)',
    color: 'rgba(255,255,255,0.22)',
    cursor: 'not-allowed',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
    marginTop: '4px',
  },
  footerBtn: {
    width: '100%',
    padding: '7px',
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.20)',
    fontSize: '10px',
    cursor: 'pointer',
    fontFamily: SANS,
    transition: 'color 120ms ease',
    letterSpacing: '0.1px',
    textAlign: 'center' as const,
  },
  errorMsg: {
    margin: 0,
    fontSize: '10px',
    color: 'rgba(248,113,113,0.80)',
    textAlign: 'center' as const,
    fontFamily: SANS,
    letterSpacing: '0.1px',
  },
};
