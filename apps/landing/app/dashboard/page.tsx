'use client';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface DashboardSummary {
  plan: string;
  isPro: boolean;
  expiresAt: string | null;
  totalSessions: number;
  totalQuestions: number;
  referralPendingBalance: number;
  referralCurrency: string;
  referralCode: string;
  recentSessions: {
    id: string;
    interview_type: string;
    duration_seconds: number | null;
    total_questions: number;
    summary: string | null;
    started_at: string;
  }[];
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const user = session?.user as any;

  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user?.accessToken) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/user/dashboard-summary`, {
      headers: { Authorization: `Bearer ${user.accessToken}` },
    })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError('Failed to load dashboard data'); setLoading(false); });
  }, [user?.accessToken]);

  function copyReferral() {
    if (!data?.referralCode) return;
    navigator.clipboard.writeText(`https://zoomguru.com?ref=${data.referralCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function formatDuration(secs: number | null) {
    if (!secs) return '—';
    const m = Math.floor(secs / 60);
    return m < 1 ? '<1 min' : `${m} min`;
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function planLabel(plan: string, isPro: boolean) {
    if (!isPro) return 'Free';
    if (plan === 'lifetime') return 'Pro Lifetime';
    return 'Pro Monthly';
  }

  function planColor(isPro: boolean) {
    return isPro ? '#4f6ef7' : 'rgba(0,0,0,0.35)';
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <PageHeader name={user?.name || user?.username} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          {[1,2,3,4].map(i => (
            <div key={i} className="glass" style={{ borderRadius: '12px', padding: '20px', height: '90px', opacity: 0.4 }} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ color: '#f87171', padding: '20px', background: 'rgba(239,68,68,0.1)', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.2)' }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

      <PageHeader name={user?.name || user?.username} />

      {/* ── Row 1: stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <StatCard
          label="Current Plan"
          value={planLabel(data?.plan || 'free', !!data?.isPro)}
          sub={data?.expiresAt ? `Renews ${formatDate(data.expiresAt)}` : data?.isPro ? 'Never expires' : '3 sessions · 10 Q each'}
          accent={planColor(!!data?.isPro)}
          icon="◈"
        />
        <StatCard
          label="Sessions"
          value={String(data?.totalSessions ?? 0)}
          sub="Total interviews started"
          icon="▣"
        />
        <StatCard
          label="Questions"
          value={String(data?.totalQuestions ?? 0)}
          sub="Total AI answers received"
          icon="◎"
        />
        <StatCard
          label="Referral Earnings"
          value={`₦${(data?.referralPendingBalance ?? 0).toLocaleString()}`}
          sub="Pending payout"
          accent="#10b981"
          icon="◇"
        />
      </div>

      {/* ── Row 2: recent sessions ── */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1a1a1a' }}>Recent Sessions</h2>
          <Link href="/dashboard/sessions" style={{ fontSize: '13px', color: '#4f6ef7', textDecoration: 'none' }}>
            View all →
          </Link>
        </div>

        {!data?.recentSessions?.length ? (
          <div className="glass" style={{ borderRadius: '12px', padding: '32px', textAlign: 'center', color: 'rgba(0,0,0,0.3)', fontSize: '14px' }}>
            No sessions yet. Download the app to start your first interview.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {data.recentSessions.map(s => (
              <div key={s.id} className="glass" style={{
                borderRadius: '10px', padding: '16px 20px',
                display: 'flex', alignItems: 'center', gap: '16px',
                flexWrap: 'wrap',
              }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '8px',
                  background: 'rgba(79,110,247,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <span style={{ fontSize: '18px' }}>▣</span>
                </div>
                <div style={{ flex: 1, minWidth: '120px' }}>
                  <p style={{ fontSize: '14px', fontWeight: 500, color: '#1a1a1a', textTransform: 'capitalize' }}>
                    {s.interview_type.replace(/_/g, ' ')} Interview
                  </p>
                  {s.summary && (
                    <p style={{ fontSize: '12px', color: 'rgba(0,0,0,0.35)', marginTop: '2px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>
                      {s.summary}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '20px', flexShrink: 0 }}>
                  <Chip label={`${s.total_questions} Q`} />
                  <Chip label={formatDuration(s.duration_seconds)} />
                  <Chip label={formatDate(s.started_at)} dim />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Row 3: quick actions ── */}
      <section>
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1a1a1a', marginBottom: '16px' }}>Quick Actions</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          {data?.isPro ? (
            <Link href="/download" style={{ textDecoration: 'none' }}>
              <ActionButton label="Download App" icon="↓" primary />
            </Link>
          ) : (
            <Link href="/dashboard/subscription" style={{ textDecoration: 'none' }}>
              <ActionButton label="Upgrade to Pro" icon="✦" primary />
            </Link>
          )}

          <button onClick={copyReferral} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}>
            <ActionButton label={copied ? 'Copied!' : 'Copy Referral Link'} icon="◇" />
          </button>

          <Link href="/dashboard/subscription" style={{ textDecoration: 'none' }}>
            <ActionButton label="View Subscription" icon="◈" />
          </Link>
        </div>
      </section>

    </div>
  );
}

function PageHeader({ name }: { name?: string }) {
  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111', letterSpacing: '-0.3px' }}>
        Welcome back{name ? `, ${name.split(' ')[0]}` : ''} 👋
      </h1>
      <p style={{ color: 'rgba(0,0,0,0.35)', fontSize: '14px', marginTop: '4px' }}>
        Here&apos;s your ZoomGuru overview
      </p>
    </div>
  );
}

function StatCard({ label, value, sub, accent, icon }: {
  label: string; value: string; sub: string; accent?: string; icon: string;
}) {
  return (
    <div className="glass" style={{ borderRadius: '12px', padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <span style={{ fontSize: '11px', fontWeight: 500, color: 'rgba(0,0,0,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
        <span style={{ fontSize: '18px', opacity: 0.5 }}>{icon}</span>
      </div>
      <p style={{ fontSize: '26px', fontWeight: 700, color: accent || '#e8e8e8', letterSpacing: '-0.5px' }}>{value}</p>
      <p style={{ fontSize: '12px', color: 'rgba(0,0,0,0.3)', marginTop: '4px' }}>{sub}</p>
    </div>
  );
}

function Chip({ label, dim }: { label: string; dim?: boolean }) {
  return (
    <span style={{ fontSize: '12px', color: dim ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.5)' }}>
      {label}
    </span>
  );
}

function ActionButton({ label, icon, primary }: { label: string; icon: string; primary?: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '11px 18px', borderRadius: '10px',
      background: primary ? '#fff' : 'rgba(0,0,0,0.06)',
      border: primary ? 'none' : '1px solid rgba(0,0,0,0.1)',
      color: primary ? '#080808' : '#e8e8e8',
      fontSize: '14px', fontWeight: primary ? 600 : 500,
      transition: 'opacity 0.15s',
      cursor: 'pointer',
    }}>
      <span>{icon}</span>
      {label}
    </div>
  );
}
