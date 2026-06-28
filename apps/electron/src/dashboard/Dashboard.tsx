import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { formatCountdown } from '../utils';

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
  channels?: string[];
  onClose(): void;
  callback(response: PaystackResponse): void;
}

interface PaystackPopInterface {
  setup(config: PaystackSetupConfig): PaystackHandler;
}

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

function getFirstNameFromJwt(token: string): string {
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as { name?: string; email?: string };
    if (payload.name) return payload.name.split(' ')[0];
    return '';
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

const PLAN_LABELS: Record<PlanType, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

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

  async function handleSubscribe(planOverride?: 'weekly' | 'monthly' | 'yearly'): Promise<void> {
    const plan = planOverride ?? selectedPlan;
    const token = await window.zoomguru.getToken();
    const email = getEmailFromJwt(token);
    const pubKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY as string;

    if (!email) return;

    setVerifyError(false);
    setCheckingOut(true);
    checkingOutRef.current = true;

    try {
      await loadPaystackScript();
    } catch {
      setCheckingOut(false);
      return;
    }

    const pop = (window as unknown as { PaystackPop: PaystackPopInterface }).PaystackPop;

    const payConfig: PaystackSetupConfig = {
      key: pubKey,
      email,
      ref: `zg_${Date.now()}`,
      channels: ['bank_transfer', 'ussd', 'opay'],
      onClose: () => {
        setCheckingOut(false);
        checkingOutRef.current = false;
      },
      callback: (response) => {
        setCheckingOut(false);
        checkingOutRef.current = false;
        setVerifying(true);
        void (async () => {
          try {
            const [freshToken, { keyId }] = await Promise.all([
              window.zoomguru.getToken(),
              window.zoomguru.getDevicePublicKey(),
            ]);
            const res = await fetch(`${API_URL}/subscription/verify`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${freshToken}`,
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

    const PLAN_AMOUNTS: Record<PlanType, number> = {
      weekly:  1_500_000,
      monthly: 4_500_000,
      yearly: 45_000_000,
    };
    payConfig.amount = PLAN_AMOUNTS[plan];

    pop.setup(payConfig).openIframe();
  }

  function daysLabel(): string {
    if (loadingSub) return '—';
    if (!sub) return '—';
    if (sub.status === 'active') {
      if (sub.plan === 'yearly') return 'Yearly plan';
      if (sub.daysRemaining === 0) return 'Expired';
      return `${sub.daysRemaining ?? '—'} days left`;
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
  const showUpgradeCta = isActive && sub?.plan !== 'yearly' && (sub?.plan as string | null) !== 'lifetime';

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
              <span style={s.upgradeText}>Get more with the Yearly plan</span>
              <button
                className="zg-primary"
                style={s.upgradeBtn}
                onClick={() => { void handleSubscribe('yearly'); }}
              >
                Upgrade to Yearly
              </button>
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
