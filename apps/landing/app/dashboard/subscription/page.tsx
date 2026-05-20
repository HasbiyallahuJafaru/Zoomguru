'use client';
export const dynamic = 'force-dynamic';
import { useSession } from 'next-auth/react';
import { useEffect, useState, useCallback } from 'react';
import Script from 'next/script';

declare global {
  interface Window {
    PaystackPop: {
      newTransaction: (config: {
        key: string; email: string; amount: number; currency: string;
        ref: string; metadata?: Record<string, unknown>;
        onSuccess: (t: { reference: string }) => void;
        onCancel: () => void;
      }) => void;
    };
  }
}

interface Subscription {
  plan: string;
  isPro: boolean;
  status: string;
  expiresAt: string | null;
  deviceFingerprint: string | null;
  sessionsUsed: number;
  responsesUsed: number;
}

const FEATURES = [
  { label: 'Interview sessions',  free: '3 total',    pro: 'Unlimited' },
  { label: 'AI responses',        free: '10/session', pro: 'Unlimited' },
  { label: 'Screenshot mode',     free: false,        pro: true },
  { label: 'Wake word',           free: false,        pro: true },
  { label: 'Session history',     free: false,        pro: true },
  { label: 'Priority support',    free: false,        pro: true },
];

const USD_RATES = { monthly: 12, lifetime: 79 };
const NGN_RATES = { monthly: 15000, lifetime: 100000 };

export default function SubscriptionPage() {
  const { data: session } = useSession();
  const user = session?.user as any;

  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState<'NGN' | 'USD'>('NGN');
  const [paying, setPaying] = useState<string | null>(null);

  const fetchSub = useCallback(async () => {
    if (!user?.accessToken) return;
    setLoading(true);
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/user/subscription`, {
      headers: { Authorization: `Bearer ${user.accessToken}` },
    });
    if (res.ok) setSub(await res.json());
    setLoading(false);
  }, [user?.accessToken]);

  useEffect(() => { fetchSub(); }, [fetchSub]);

  function openPaystack(plan: 'monthly' | 'lifetime') {
    if (!user?.email || paying) return;
    setPaying(plan);

    const amount = currency === 'NGN'
      ? NGN_RATES[plan] * 100
      : USD_RATES[plan] * 100;

    window.PaystackPop.newTransaction({
      key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY!,
      email: user.email,
      amount,
      currency,
      ref: `ZG-${plan.toUpperCase()}-${Date.now()}`,
      metadata: { plan, userId: user.id, currency },
      onSuccess: async (t) => {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/paystack/webhook-verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reference: t.reference }),
        });
        setPaying(null);
        await fetchSub();
      },
      onCancel: () => setPaying(null),
    });
  }

  function planName(plan: string, isPro: boolean) {
    if (!isPro) return 'Free';
    if (plan === 'lifetime') return 'Pro Lifetime';
    return 'Pro Monthly';
  }

  function statusColor(status: string) {
    if (status === 'active') return '#10b981';
    if (status === 'expired') return '#ef4444';
    return '#f59e0b';
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <PageTitle />
        <div className="glass" style={{ borderRadius: '16px', padding: '32px', height: '140px', opacity: 0.4 }} />
      </div>
    );
  }

  const isLifetime = sub?.plan === 'lifetime' && sub?.isPro;

  return (
    <>
      <Script src="https://js.paystack.co/v2/inline.js" strategy="lazyOnload" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '780px' }}>
        <PageTitle />

        {/* â”€â”€ Section 1: Current plan â”€â”€ */}
        <div className="glass" style={{ borderRadius: '16px', padding: '28px 32px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Current Plan</p>
              <h2 style={{ fontSize: '28px', fontWeight: 700, color: '#fff', letterSpacing: '-0.5px' }}>
                {planName(sub?.plan || 'free', !!sub?.isPro)}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                <span style={{
                  display: 'inline-block', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                  background: statusColor(sub?.status || 'active') + '20',
                  color: statusColor(sub?.status || 'active'),
                  border: `1px solid ${statusColor(sub?.status || 'active')}40`,
                }}>
                  {(sub?.status || 'active').charAt(0).toUpperCase() + (sub?.status || 'active').slice(1)}
                </span>
              </div>
            </div>

            {sub?.isPro && (
              <div style={{ textAlign: 'right' }}>
                {sub.plan === 'lifetime' ? (
                  <p style={{ fontSize: '14px', color: '#10b981' }}>âœ“ Never expires</p>
                ) : sub.expiresAt ? (
                  <>
                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', marginBottom: '4px' }}>Next billing</p>
                    <p style={{ fontSize: '16px', fontWeight: 600, color: '#e8e8e8' }}>
                      {new Date(sub.expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>â‚¦15,000 / month</p>
                  </>
                ) : null}
              </div>
            )}
          </div>

          {/* Usage (free) or device lock (pro) */}
          <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
            {!sub?.isPro ? (
              <>
                <UsageStat label="Sessions used" value={sub?.sessionsUsed ?? 0} max={3} />
                <UsageStat label="Responses used" value={sub?.responsesUsed ?? 0} max={10} />
              </>
            ) : (
              <div>
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', marginBottom: '4px' }}>Device fingerprint</p>
                <p style={{ fontFamily: 'monospace', fontSize: '14px', color: 'rgba(255,255,255,0.55)', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '6px', display: 'inline-block' }}>
                  {sub?.deviceFingerprint ? `â€¦${sub.deviceFingerprint.slice(-8)}` : 'Not bound yet'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* â”€â”€ Section 2: Upgrade (not lifetime) â”€â”€ */}
        {!isLifetime && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#e8e8e8' }}>
                {sub?.isPro ? 'Upgrade to Lifetime' : 'Upgrade Your Plan'}
              </h2>
              {/* Currency toggle */}
              <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: '8px', padding: '3px' }}>
                {(['NGN', 'USD'] as const).map(c => (
                  <button key={c} onClick={() => setCurrency(c)} style={{
                    padding: '5px 14px', borderRadius: '6px', border: 'none',
                    background: currency === c ? 'rgba(255,255,255,0.12)' : 'transparent',
                    color: currency === c ? '#fff' : 'rgba(255,255,255,0.4)',
                    fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'background 0.15s, color 0.15s',
                  }}>{c}</button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {/* Monthly */}
              {!sub?.isPro && (
                <PlanCard
                  name="Monthly Pro"
                  price={currency === 'NGN' ? `â‚¦${NGN_RATES.monthly.toLocaleString()}` : `$${USD_RATES.monthly}`}
                  period="/month"
                  cta="Upgrade Monthly"
                  loading={paying === 'monthly'}
                  onPay={() => openPaystack('monthly')}
                />
              )}
              {/* Lifetime */}
              <PlanCard
                name="Lifetime Pro"
                price={currency === 'NGN' ? `â‚¦${NGN_RATES.lifetime.toLocaleString()}` : `$${USD_RATES.lifetime}`}
                period=" one-time"
                cta="Get Lifetime Access"
                badge="Best Value"
                primary
                loading={paying === 'lifetime'}
                onPay={() => openPaystack('lifetime')}
              />
            </div>
          </div>
        )}

        {/* â”€â”€ Section 3: Feature comparison â”€â”€ */}
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#e8e8e8', marginBottom: '16px' }}>Plan Comparison</h2>
          <div className="glass" style={{ borderRadius: '12px', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px', padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <span style={thStyle}>Feature</span>
              <span style={{ ...thStyle, textAlign: 'center' }}>Free</span>
              <span style={{ ...thStyle, textAlign: 'center', color: '#4f6ef7' }}>Pro</span>
            </div>
            {FEATURES.map((f, i) => (
              <div key={f.label} style={{
                display: 'grid', gridTemplateColumns: '1fr 120px 120px',
                padding: '13px 20px',
                borderBottom: i < FEATURES.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
              }}>
                <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.65)' }}>{f.label}</span>
                <span style={{ textAlign: 'center', fontSize: '13px', color: f.free === false ? '#ef4444' : '#10b981' }}>
                  {f.free === false ? 'âœ—' : f.free === true ? 'âœ“' : f.free}
                </span>
                <span style={{ textAlign: 'center', fontSize: '13px', color: '#10b981' }}>
                  {f.pro === true ? 'âœ“' : f.pro}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </>
  );
}

function PageTitle() {
  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#fff', letterSpacing: '-0.3px' }}>Subscription</h1>
      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '14px', marginTop: '4px' }}>Manage your plan and billing</p>
    </div>
  );
}

function UsageStat({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min((value / max) * 100, 100);
  const color = pct >= 100 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#4f6ef7';
  return (
    <div style={{ minWidth: '140px' }}>
      <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', marginBottom: '4px' }}>{label}</p>
      <p style={{ fontSize: '18px', fontWeight: 600, color: '#e8e8e8' }}>{value} <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', fontWeight: 400 }}>of {max}</span></p>
      <div style={{ marginTop: '6px', height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '2px', transition: 'width 0.4s' }} />
      </div>
    </div>
  );
}

function PlanCard({ name, price, period, cta, badge, primary, loading, onPay }: {
  name: string; price: string; period: string; cta: string;
  badge?: string; primary?: boolean; loading?: boolean; onPay: () => void;
}) {
  return (
    <div className={primary ? '' : 'glass'} style={{
      borderRadius: '14px', padding: '24px',
      border: primary ? '1px solid rgba(79,110,247,0.4)' : '1px solid rgba(255,255,255,0.08)',
      background: primary ? 'rgba(79,110,247,0.08)' : undefined,
      display: 'flex', flexDirection: 'column', gap: '16px',
      position: 'relative',
    }}>
      {badge && (
        <span style={{
          position: 'absolute', top: '-10px', right: '16px',
          background: '#4f6ef7', color: '#fff', fontSize: '11px', fontWeight: 600,
          padding: '3px 10px', borderRadius: '20px',
        }}>{badge}</span>
      )}
      <div>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>{name}</p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
          <span style={{ fontSize: '28px', fontWeight: 700, color: '#fff' }}>{price}</span>
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>{period}</span>
        </div>
      </div>
      <button
        onClick={onPay}
        disabled={!!loading}
        style={{
          width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
          background: primary ? '#4f6ef7' : 'rgba(255,255,255,0.08)',
          color: '#fff', fontSize: '14px', fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.7 : 1,
          fontFamily: 'inherit', transition: 'opacity 0.15s',
        }}
      >
        {loading ? 'Processingâ€¦' : cta}
      </button>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.35)',
  textTransform: 'uppercase', letterSpacing: '0.5px',
};

