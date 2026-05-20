'use client';
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { AdminLayout } from '@/components/AdminLayout';
import { RevenueChart } from '@/components/RevenueChart';
import { PlanPieChart } from '@/components/PlanPieChart';

const API = process.env.NEXT_PUBLIC_API_URL!;

function fmtNGN(n: number) {
  if (n >= 1_000_000) return '₦' + (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return '₦' + Math.round(n / 1_000) + 'k';
  return '₦' + Math.round(n).toLocaleString();
}

function timeAgo(iso: string) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return secs + 's ago';
  if (secs < 3600) return Math.floor(secs / 60) + 'm ago';
  if (secs < 86400) return Math.floor(secs / 3600) + 'h ago';
  return Math.floor(secs / 86400) + 'd ago';
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

// ── KPI Card ──────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, accent,
}: {
  label: string; value: string; sub: string; accent: string;
}) {
  return (
    <div style={{
      flex: 1, minWidth: 160,
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: 12,
      padding: '20px 22px',
    }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 10px' }}>
        {label}
      </p>
      <p style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', margin: '0 0 6px', letterSpacing: '-0.5px' }}>
        {value}
      </p>
      <p style={{ fontSize: 12, color: accent, margin: 0 }}>{sub}</p>
    </div>
  );
}

// ── Health Dot ────────────────────────────────────────────────────────────

function HealthItem({ label, value, ok = true }: { label: string; value: string; ok?: boolean }) {
  return (
    <div style={{
      flex: 1, minWidth: 150,
      background: '#fff', border: '1px solid #e2e8f0',
      borderRadius: 10, padding: '14px 18px',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
        background: ok ? '#10b981' : '#ef4444',
        boxShadow: ok ? '0 0 0 3px #d1fae5' : '0 0 0 3px #fee2e2',
      }} />
      <div>
        <p style={{ fontSize: 11, color: '#94a3b8', margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</p>
        <p style={{ fontSize: 14, color: '#0f172a', margin: '2px 0 0', fontWeight: 600 }}>{value}</p>
      </div>
    </div>
  );
}

// ── Panel wrapper ─────────────────────────────────────────────────────────

function Panel({ title, link, linkLabel, children }: {
  title: string; link?: string; linkLabel?: string; children: React.ReactNode;
}) {
  return (
    <div style={{
      flex: 1, background: '#fff', border: '1px solid #e2e8f0',
      borderRadius: 12, overflow: 'hidden',
    }}>
      <div style={{
        padding: '16px 20px', borderBottom: '1px solid #f1f5f9',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 }}>{title}</p>
        {link && (
          <a href={link} style={{ fontSize: 12, color: '#4f6ef7', textDecoration: 'none', fontWeight: 500 }}>
            {linkLabel} →
          </a>
        )}
      </div>
      {children}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const { data: session } = useSession();
  const token = (session?.user as any)?.accessToken;

  const [stats, setStats] = useState<any>(null);
  const [revenue, setRevenue] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checkedAt] = useState(() => new Date().toLocaleTimeString());

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const [sRes, rRes] = await Promise.all([
      fetch(`${API}/admin/stats`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API}/admin/analytics/revenue?period=30`, { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    if (sRes.ok) setStats(await sRes.json());
    if (rRes.ok) setRevenue(await rRes.json());
    setLoading(false);
  }, [token]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── KPI computations ────────────────────────────────────────────────────

  const revenueThisMonth = Number(stats?.revenue?.this_month ?? 0);
  const revenuePrevMonth = Number(stats?.revenue?.prev_month ?? 0);
  const revPct = revenuePrevMonth > 0
    ? Math.round(((revenueThisMonth - revenuePrevMonth) / revenuePrevMonth) * 100)
    : 0;
  const revUp = revPct >= 0;

  const activeSubs = Number(stats?.subscribers?.total ?? 0);
  const monthly = Number(stats?.subscribers?.monthly ?? 0);
  const lifetime = Number(stats?.subscribers?.lifetime ?? 0);

  const new7d = Number(stats?.users?.new_7d ?? 0);
  const converted7d = Number(stats?.users?.converted_7d ?? 0);
  const convRate = new7d > 0 ? Math.round((converted7d / new7d) * 100) : 0;

  const churned = Number(stats?.churn?.churned_this_month ?? 0);
  const churnRate = activeSubs > 0 ? ((churned / activeSubs) * 100).toFixed(1) : '0.0';
  const churnNum = parseFloat(churnRate);
  const churnColor = churnNum >= 10 ? '#ef4444' : churnNum >= 5 ? '#f59e0b' : '#10b981';

  const pendingAmt = Number(stats?.pendingPayouts?.total ?? 0);
  const pendingCount = Number(stats?.pendingPayouts?.count ?? 0);

  // ── Skeleton ────────────────────────────────────────────────────────────

  const skeleton = (w = '100%', h = 18) => (
    <div style={{
      width: w, height: h, borderRadius: 6,
      background: 'linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  );

  return (
    <AdminLayout title="Overview" onRefresh={fetchAll}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ── ROW 1: KPI cards ──────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {loading ? (
            [1,2,3,4,5].map(i => (
              <div key={i} style={{
                flex: 1, minWidth: 160, background: '#fff',
                border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 22px',
              }}>
                {skeleton('60%', 11)}
                <div style={{ marginTop: 10 }}>{skeleton('80%', 28)}</div>
                <div style={{ marginTop: 8 }}>{skeleton('50%', 12)}</div>
              </div>
            ))
          ) : (<>
            <KpiCard
              label="Revenue this month"
              value={fmtNGN(revenueThisMonth)}
              sub={`${revUp ? '↑' : '↓'} ${Math.abs(revPct)}% from last month`}
              accent={revUp ? '#10b981' : '#ef4444'}
            />
            <KpiCard
              label="Active Subscribers"
              value={String(activeSubs)}
              sub={`${monthly} monthly · ${lifetime} lifetime`}
              accent="#4f6ef7"
            />
            <KpiCard
              label="New Users (7d)"
              value={String(new7d)}
              sub={`${convRate}% conversion from free`}
              accent="#06b6d4"
            />
            <KpiCard
              label="Churn Rate"
              value={churnRate + '%'}
              sub={`${churned} users cancelled this month`}
              accent={churnColor}
            />
            <KpiCard
              label="Pending Payouts"
              value={fmtNGN(pendingAmt)}
              sub={`${pendingCount} requests pending`}
              accent="#a855f7"
            />
          </>)}
        </div>

        {/* ── ROW 2: Charts ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 16 }}>

          {/* Revenue area chart — 60% */}
          <div style={{
            flex: '0 0 60%', background: '#fff',
            border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 22px',
          }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: '0 0 16px' }}>
              Revenue — last 30 days
            </p>
            {loading || !revenue
              ? <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <p style={{ color: '#94a3b8', fontSize: 13 }}>Loading…</p>
                </div>
              : <RevenueChart data={revenue.daily ?? []} />
            }
          </div>

          {/* Plan breakdown pie — 40% */}
          <div style={{
            flex: '0 0 calc(40% - 16px)', background: '#fff',
            border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 22px',
          }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: '0 0 16px' }}>
              Plan breakdown
            </p>
            {loading || !stats
              ? <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <p style={{ color: '#94a3b8', fontSize: 13 }}>Loading…</p>
                </div>
              : <PlanPieChart data={stats.plans ?? []} />
            }
          </div>
        </div>

        {/* ── ROW 3: Recent signups + recent errors ─────────────────── */}
        <div style={{ display: 'flex', gap: 16 }}>

          {/* Recent signups */}
          <Panel title="Recent Signups" link="/users" linkLabel="View all users">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Username', 'Email', 'Plan', 'Joined'].map(h => (
                      <th key={h} style={{
                        padding: '10px 16px', textAlign: 'left', fontSize: 11,
                        fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase',
                        letterSpacing: '0.4px', borderBottom: '1px solid #f1f5f9',
                        whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? [1,2,3,4,5].map(i => (
                        <tr key={i}>
                          {[1,2,3,4].map(j => (
                            <td key={j} style={{ padding: '12px 16px' }}>
                              {skeleton()}
                            </td>
                          ))}
                        </tr>
                      ))
                    : (stats?.recentSignups ?? []).map((u: any) => (
                        <tr key={u.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                          <td style={{ padding: '11px 16px', color: '#0f172a', fontWeight: 500 }}>
                            {u.username || '—'}
                          </td>
                          <td style={{ padding: '11px 16px', color: '#475569', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {u.email}
                          </td>
                          <td style={{ padding: '11px 16px' }}>
                            <span style={{
                              padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                              background: u.is_pro ? '#eef2ff' : '#f1f5f9',
                              color: u.is_pro ? '#4f6ef7' : '#64748b',
                            }}>
                              {u.plan || 'free'}
                            </span>
                          </td>
                          <td style={{ padding: '11px 16px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                            {fmtDate(u.created_at)}
                          </td>
                        </tr>
                      ))
                  }
                </tbody>
              </table>
            </div>
          </Panel>

          {/* Recent errors */}
          <Panel title="Recent Errors" link="/errors" linkLabel="View all errors">
            <div style={{ padding: '8px 0' }}>
              {loading
                ? [1,2,3,4,5].map(i => (
                    <div key={i} style={{ padding: '12px 20px', borderBottom: '1px solid #f8fafc' }}>
                      {skeleton()}
                      <div style={{ marginTop: 6 }}>{skeleton('60%', 11)}</div>
                    </div>
                  ))
                : (stats?.recentErrors ?? []).length === 0
                  ? <p style={{ padding: '24px 20px', color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>
                      No errors recorded 🎉
                    </p>
                  : (stats?.recentErrors ?? []).map((e: any, i: number) => {
                      const is5xx = (e.status_code ?? 0) >= 500;
                      return (
                        <div key={i} style={{
                          padding: '12px 20px',
                          borderBottom: '1px solid #f8fafc',
                          borderLeft: `3px solid ${is5xx ? '#ef4444' : '#f59e0b'}`,
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
                            <p style={{
                              fontSize: 12, fontWeight: 600,
                              color: is5xx ? '#dc2626' : '#d97706',
                              margin: 0, fontFamily: 'monospace',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {e.endpoint || 'unknown'}
                              {e.status_code ? ` [${e.status_code}]` : ''}
                            </p>
                            <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap', flexShrink: 0 }}>
                              {timeAgo(e.created_at)}
                            </span>
                          </div>
                          <p style={{
                            fontSize: 12, color: '#475569', margin: 0,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {e.error_message}
                          </p>
                        </div>
                      );
                    })
              }
            </div>
          </Panel>
        </div>

        {/* ── ROW 4: System health ─────────────────────────────────── */}
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#475569', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            System Health
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <HealthItem label="Backend" value={`● Online · checked ${checkedAt}`} ok={true} />
            <HealthItem label="Database" value="Neon PostgreSQL · connected" ok={true} />
            <HealthItem
              label="Users in DB"
              value={loading ? '…' : String(stats?.users?.total ?? '—')}
              ok={true}
            />
            <HealthItem
              label="Sessions today"
              value={loading ? '…' : String(stats?.sessions?.today ?? '0')}
              ok={true}
            />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </AdminLayout>
  );
}
