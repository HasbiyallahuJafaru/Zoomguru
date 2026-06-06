import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { formatCountdown } from '../utils';
import UsageMeter from './UsageMeter';

type ElectronStyle = CSSProperties & { WebkitAppRegion?: 'drag' | 'no-drag' };

interface DashboardProps {
  onContinue: () => void;
  onOpenMeeting: () => void;
  onOpenInterviewer: () => void;
  onLogout: () => void;
  onStartTour?: () => void;
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

interface FeatureUsage {
  used: number;
  limit: number;
  resetAt: string;
}

interface UsageData {
  planType: PlanType | null;
  copilot_requests: FeatureUsage;
  scorer_reports: FeatureUsage;
  doc_copilot_requests: FeatureUsage;
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

const PLAN_LABELS: Record<PlanType, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

export default function Dashboard({ onContinue, onOpenMeeting, onOpenInterviewer, onLogout, onStartTour }: DashboardProps) {
  const [sub, setSub] = useState<SubData | null>(null);
  const [loadingSub, setLoadingSub] = useState(true);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
  const [startingTrial, setStartingTrial] = useState(false);
  const [trialError, setTrialError] = useState<string | null>(null);
  const [deviceRegError, setDeviceRegError] = useState<string | null>(null);
  const [trialMsLeft, setTrialMsLeft] = useState<number | null>(null);
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

        const [statusRes, usageRes] = await Promise.all([
          fetch(`${API_URL}/subscription/status`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_URL}/subscription/usage`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (statusRes.status === 401) { onLogout(); return; }
        if (statusRes.ok) {
          const data = await statusRes.json() as SubData;
          setSub(data);
        }
        if (usageRes.ok) {
          const data = await usageRes.json() as UsageData;
          setUsage(data);
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
    return '—';
  }

  function billingLabel(): string {
    if (loadingSub) return 'Loading…';
    if (!sub) return '—';
    if (sub.status === 'active') return sub.plan ? PLAN_LABELS[sub.plan] : '—';
    if (sub.trialActive) return 'Free trial';
    if (sub.trialStartedAt && !sub.trialActive) return 'Trial used';
    return '—';
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
  const showUpgradeCta = isActive && sub?.plan !== 'yearly';
  const showUsage = isActive && usage !== null;

  return (
    <>
      <style>{`
        .zg-primary:hover:not(:disabled) { opacity: 0.90; }
        .zg-primary:active:not(:disabled) { transform: scale(0.98); }
        .zg-ghost:hover { color: rgba(255,255,255,0.45) !important; }
        .zg-close:hover { color: rgba(255,255,255,0.50) !important; }
        .zg-plan:hover { opacity: 0.85; }
        .zg-trial:hover:not(:disabled) { opacity: 0.85; }
        .zg-tool:hover:not(:disabled) { opacity: 0.85; transform: translateY(-1px); }
        .zg-tool:active:not(:disabled) { transform: scale(0.97); }
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
            <span style={s.brandTag}>Your invisible interview edge</span>
          </div>

          {deviceRegError && (
            <p style={s.errorMsg}>{deviceRegError}</p>
          )}

          {/* Subscription card */}
          <div id="tour-plan-status" style={s.card}>
            <div style={s.cardRow}>
              <span style={s.cardLabel}>Status</span>
              <span style={statusBadgeStyle()}>{statusLabel()}</span>
            </div>

            <div style={s.divider} />

            <div style={s.cardRow}>
              <span style={s.cardLabel}>Days remaining</span>
              <span style={s.cardValue}>{daysLabel()}</span>
            </div>

            <div style={s.divider} />

            <div style={s.cardRow}>
              <span style={s.cardLabel}>Billing</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {isActive && sub.plan && (
                  <span style={s.planBadge}>{PLAN_LABELS[sub.plan]}</span>
                )}
                <span style={s.cardValue}>{billingLabel()}</span>
              </div>
            </div>
          </div>

          {/* Tool launchers — only shown when active or trial */}
          {showContinue && (
            <div id="tour-tools" style={s.toolGrid}>
              <button
                className="zg-tool"
                style={s.toolBtn}
                onClick={onContinue}
              >
                <span style={s.toolIcon}>MIC</span>
                <span style={s.toolLabel}>Interview Assistant</span>
              </button>
              <button
                className="zg-tool"
                style={s.toolBtn}
                onClick={onOpenMeeting}
              >
                <span style={s.toolIcon}>DOC</span>
                <span style={s.toolLabel}>Meeting Assistant</span>
              </button>
              <button
                className="zg-tool"
                style={s.toolBtn}
                onClick={onOpenInterviewer}
              >
                <span style={s.toolIcon}>AI</span>
                <span style={s.toolLabel}>AI Interviewer</span>
              </button>
            </div>
          )}

          {/* Usage meters */}
          {showUsage && (
            <div style={s.usageSection}>
              <span style={s.usageSectionLabel}>Usage this period</span>
              <UsageMeter label="Copilot Requests" data={usage.copilot_requests} />
              <UsageMeter label="Scorer Reports" data={usage.scorer_reports} />
              <UsageMeter label="Doc Copilot Requests" data={usage.doc_copilot_requests} />
            </div>
          )}

          {/* Upgrade CTA for weekly / monthly */}
          {showUpgradeCta && (
            <div style={s.upgradeCta}>
              <span style={s.upgradeText}>Upgrade to Yearly for 4× more quota</span>
              <button
                className="zg-primary"
                style={s.upgradeBtn}
                onClick={() => {
                  void handleSubscribe('yearly');
                }}
              >
                Upgrade to Yearly
              </button>
            </div>
          )}

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

          {/* Plan selector — hidden only when subscription is fully active */}
          {!isActive && (
            <div style={s.planSelector}>
              <button
                className="zg-plan"
                style={selectedPlan === 'weekly' ? s.planBtnActive : s.planBtn}
                onClick={() => setSelectedPlan('weekly')}
              >
                Weekly
              </button>
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

          {/* Actions row */}
          <div style={s.actions}>
            {showContinue && !sub?.trialActive && (
              <button
                id="tour-continue-btn"
                className="zg-primary"
                style={s.continueBtn}
                onClick={onContinue}
              >
                Continue →
              </button>
            )}
            {sub?.trialActive && trialMsLeft !== null && (
              <div style={s.trialCountdownRow}>
                <span style={s.trialCountdownLabel}>Free trial ends in</span>
                <span style={s.trialCountdownValue}>{formatCountdown(trialMsLeft)}</span>
              </div>
            )}
            {onStartTour && (
              <button
                className="zg-ghost"
                style={s.tourBtn}
                onClick={onStartTour}
              >
                Take the Tour
              </button>
            )}
            {sub?.isAdmin && (
              <button
                className="zg-admin"
                style={s.adminBtn}
                onClick={() => {
                  const adminUrl = (import.meta.env.VITE_ADMIN_URL as string | undefined) ?? `${API_URL.replace(':3000', ':5174')}`;
                  void window.zoomguru.openExternal(`${adminUrl}/broadcast`);
                }}
              >
                Broadcast Mail
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
    maxWidth: '310px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: '14px',
    WebkitAppRegion: 'no-drag',
    overflowY: 'auto',
    maxHeight: 'calc(100vh - 32px)',
    paddingBottom: '8px',
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
  planBadge: {
    fontSize: '9px',
    fontWeight: 600,
    letterSpacing: '0.3px',
    color: 'rgba(99,179,237,0.85)',
    background: 'rgba(99,179,237,0.12)',
    padding: '2px 6px',
    borderRadius: '3px',
    fontFamily: SANS,
    textTransform: 'uppercase' as const,
  },
  toolGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '8px',
  },
  toolBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    padding: '12px 6px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'opacity 120ms ease, transform 100ms ease',
    fontFamily: SANS,
  },
  toolIcon: {
    fontSize: '18px',
    lineHeight: '1',
  },
  toolLabel: {
    fontSize: '9px',
    color: 'rgba(255,255,255,0.45)',
    fontFamily: SANS,
    letterSpacing: '0.1px',
    textAlign: 'center' as const,
  },
  usageSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '12px 14px',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '8px',
    background: 'rgba(255,255,255,0.02)',
  },
  usageSectionLabel: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.25)',
    fontFamily: SANS,
    letterSpacing: '0.3px',
    textTransform: 'uppercase' as const,
    marginBottom: '2px',
  },
  upgradeCta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '12px 14px',
    border: '1px solid rgba(99,179,237,0.15)',
    borderRadius: '8px',
    background: 'rgba(99,179,237,0.04)',
  },
  upgradeText: {
    fontSize: '10px',
    color: 'rgba(99,179,237,0.70)',
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
    background: 'rgba(99,179,237,0.15)',
    color: 'rgba(99,179,237,0.90)',
    border: '1px solid rgba(99,179,237,0.25)',
    cursor: 'pointer',
    transition: 'opacity 120ms ease, transform 100ms ease',
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
    gap: '4px',
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
    textAlign: 'center' as const,
  },
  tourBtn: {
    width: '100%',
    padding: '8px',
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.35)',
    fontSize: '11px',
    cursor: 'pointer',
    fontFamily: SANS,
    transition: 'color 120ms ease',
    letterSpacing: '0.1px',
    textAlign: 'center' as const,
  },
  adminBtn: {
    width: '100%',
    padding: '8px',
    background: 'transparent',
    border: 'none',
    color: 'rgba(248,113,113,0.50)',
    fontSize: '11px',
    cursor: 'pointer',
    fontFamily: SANS,
    transition: 'color 120ms ease',
    letterSpacing: '0.1px',
    textAlign: 'center' as const,
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
  trialCountdownRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '4px 0',
  },
  trialCountdownLabel: {
    fontSize: '10px',
    color: 'rgba(251,191,36,0.55)',
    fontFamily: SANS,
    letterSpacing: '0.1px',
  },
  trialCountdownValue: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'rgba(251,191,36,0.9)',
    fontFamily: SANS,
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '0.5px',
  },
};
