'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { AdminLayout } from '@/components/AdminLayout';

const API = process.env.NEXT_PUBLIC_API_URL!;

function fmtNGN(n: number | string) {
  return '₦' + Number(n).toLocaleString('en-NG', { maximumFractionDigits: 0 });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

interface Summary {
  total_referrals: number;
  converted: number;
  total_commissions: number;
  total_paid_out: number;
  total_links: number;
}
interface Funnel {
  links: number;
  signups: number;
  paid: number;
  retained: number;
}
interface TopReferrer {
  username: string;
  email: string;
  referred: number;
  converted: number;
  total_earned: number;
  pending: number;
}
interface ReferralRow {
  referrer_username: string;
  referred_username: string;
  status: string;
  commission_amount: number;
  currency: string;
  plan: string;
  created_at: string;
}

interface ReferralData {
  summary: Summary;
  funnel: Funnel;
  topReferrers: TopReferrer[];
  allReferrals: ReferralRow[];
}

function KPICard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
      padding: '18px 22px', flex: 1, minWidth: 150,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  pending: { bg: '#fef9c3', color: '#854d0e' },
  earned:  { bg: '#dcfce7', color: '#166534' },
  paid:    { bg: '#e0f2fe', color: '#0369a1' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { bg: '#f1f5f9', color: '#475569' };
  return (
    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color }}>
      {status}
    </span>
  );
}

const RANK_COLORS = ['#f59e0b', '#9ca3af', '#b45309'];
const RANK_LABELS = ['🥇', '🥈', '🥉'];

function pct(a: number, b: number) {
  if (!b) return '0%';
  return Math.round((a / b) * 100) + '%';
}

function FunnelBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const w = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 4;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
      <div style={{ width: 110, fontSize: 13, color: '#475569', fontWeight: 500, textAlign: 'right', flexShrink: 0 }}>
        {label}
      </div>
      <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 6, height: 32, position: 'relative', overflow: 'hidden' }}>
        <div style={{
          width: w + '%', height: '100%', background: color,
          borderRadius: 6, transition: 'width 0.4s ease',
          display: 'flex', alignItems: 'center', paddingLeft: 12,
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
            {value.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ReferralsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch(`${API}/admin/analytics/referrals`, {
      headers: { Authorization: `Bearer ${(session as any)?.accessToken}` },
    })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [status, session]);

  if (status === 'loading' || loading) {
    return <AdminLayout><div style={{ padding: 40, color: '#64748b', fontSize: 14 }}>Loading referral data…</div></AdminLayout>;
  }
  if (error) {
    return <AdminLayout><div style={{ padding: 40, color: '#dc2626', fontSize: 14 }}>Error: {error}</div></AdminLayout>;
  }

  const s = data?.summary ?? { total_referrals: 0, converted: 0, total_commissions: 0, total_paid_out: 0, total_links: 0 };
  const funnel = data?.funnel ?? { links: 0, signups: 0, paid: 0, retained: 0 };
  const tops = data?.topReferrers ?? [];
  const all = data?.allReferrals ?? [];
  const funnelMax = Number(funnel.links) || 1;

  return (
    <AdminLayout>
      <div style={{ padding: '32px 40px', maxWidth: 1400, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', margin: 0 }}>Referral Analytics</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Track referral program performance and commissions</p>
        </div>

        {/* KPI cards */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 28 }}>
          <KPICard label="Referral Links" value={Number(s.total_links).toLocaleString()} sub="Users with referral codes" />
          <KPICard label="Total Signups" value={Number(s.total_referrals).toLocaleString()} sub="Via referral link" />
          <KPICard label="Converted to Paid" value={Number(s.converted).toLocaleString()} sub={pct(Number(s.converted), Number(s.total_referrals)) + ' conversion'} />
          <KPICard label="Commissions Earned" value={fmtNGN(s.total_commissions)} />
          <KPICard label="Commissions Paid Out" value={fmtNGN(s.total_paid_out)} />
          <KPICard label="Pending Commissions" value={fmtNGN(Number(s.total_commissions) - Number(s.total_paid_out))} />
        </div>

        {/* Funnel */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '24px 28px', marginBottom: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>Referral Funnel</h2>
          <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#94a3b8', marginBottom: 20 }}>
            <span>Shared Links → Signups: <strong style={{ color: '#0f172a' }}>{pct(Number(funnel.signups), Number(funnel.links))}</strong></span>
            <span>·</span>
            <span>Signups → Paid: <strong style={{ color: '#0f172a' }}>{pct(Number(funnel.paid), Number(funnel.signups))}</strong></span>
            <span>·</span>
            <span>Paid → Retained: <strong style={{ color: '#0f172a' }}>{pct(Number(funnel.retained), Number(funnel.paid))}</strong></span>
          </div>
          <FunnelBar label="Shared Links" value={Number(funnel.links)} max={funnelMax} color="#4f6ef7" />
          <FunnelBar label="Signups" value={Number(funnel.signups)} max={funnelMax} color="#10b981" />
          <FunnelBar label="Paid" value={Number(funnel.paid)} max={funnelMax} color="#7c3aed" />
          <FunnelBar label="Retained" value={Number(funnel.retained)} max={funnelMax} color="#f59e0b" />
        </div>

        {/* Top referrers */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '24px 28px', marginBottom: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 16px' }}>Top Referrers</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Rank', 'Username', 'Referred', 'Converted', 'Earned', 'Pending'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: '#64748b', fontWeight: 600, fontSize: 12, borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tops.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>No referrals yet</td></tr>
              ) : tops.map((r, i) => {
                const isTop3 = i < 3;
                const rankColor = isTop3 ? RANK_COLORS[i] : undefined;
                return (
                  <tr key={r.username} style={{
                    borderBottom: '1px solid #f1f5f9',
                    background: isTop3 ? rankColor + '0d' : undefined,
                  }}>
                    <td style={{ padding: '11px 14px', fontWeight: 700, color: rankColor ?? '#94a3b8' }}>
                      {isTop3 ? RANK_LABELS[i] : `#${i + 1}`}
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>@{r.username}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{r.email}</div>
                    </td>
                    <td style={{ padding: '11px 14px', color: '#374151', fontWeight: 500 }}>{Number(r.referred).toLocaleString()}</td>
                    <td style={{ padding: '11px 14px', color: '#374151' }}>{Number(r.converted).toLocaleString()}</td>
                    <td style={{ padding: '11px 14px', color: '#166534', fontWeight: 600 }}>{fmtNGN(r.total_earned)}</td>
                    <td style={{ padding: '11px 14px', color: '#854d0e', fontWeight: 500 }}>{fmtNGN(r.pending)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* All referrals */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '24px 28px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 16px' }}>All Referrals</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Referrer', 'Referred', 'Plan', 'Commission', 'Status', 'Date'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: '#64748b', fontWeight: 600, fontSize: 12, borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {all.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>No referral records</td></tr>
              ) : all.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 500, color: '#0f172a' }}>@{r.referrer_username}</td>
                  <td style={{ padding: '10px 14px', color: '#475569' }}>@{r.referred_username}</td>
                  <td style={{ padding: '10px 14px', color: '#475569', textTransform: 'capitalize' }}>{r.plan || '—'}</td>
                  <td style={{ padding: '10px 14px', color: '#166534', fontWeight: 600 }}>{fmtNGN(r.commission_amount)}</td>
                  <td style={{ padding: '10px 14px' }}><StatusBadge status={r.status} /></td>
                  <td style={{ padding: '10px 14px', color: '#64748b', whiteSpace: 'nowrap' }}>{fmtDate(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </AdminLayout>
  );
}
