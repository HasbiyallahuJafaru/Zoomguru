import { useState, useEffect, useCallback } from 'react';
import type { ReactNode, CSSProperties } from 'react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import {
  fetchStats, fetchSignups, fetchPayments,
  fetchUsage, fetchDownloads, fetchUsers, fetchReferrals,
} from './api';
import type { DashboardData, ReferralCommissionRow } from './types';
import BroadcastPage from './BroadcastPage';

// ── Design tokens ──────────────────────────────────────────────
const C = {
  bg:       '#F5F3F0',
  card:     '#FFFFFF',
  border:   'rgba(0,0,0,0.05)',
  primary:  '#0D0D0D',
  secondary:'#6B6B6B',
  muted:    '#AAAAAA',
  shadow:   '0 2px 6px rgba(0,0,0,0.04), 0 8px 28px rgba(0,0,0,0.06)',
};
const F = {
  heading: "'Cormorant Garamond', Georgia, serif",
  body:    "'Inter', system-ui, sans-serif",
};
const ACCENT = {
  blue:   '#3b82f6',
  purple: '#8b5cf6',
  green:  '#10b981',
  orange: '#f59e0b',
  red:    '#ef4444',
  gray:   '#6b7280',
};

// ── Chart shared config ─────────────────────────────────────────
const CHART = {
  axis:    { fill: '#BBBBBB', fontSize: 10 },
  grid:    'rgba(0,0,0,0.04)',
  tooltip: {
    background: '#FFFFFF',
    border: '1px solid rgba(0,0,0,0.08)',
    borderRadius: 14,
    boxShadow: '0 8px 28px rgba(0,0,0,0.1)',
    fontSize: 12,
    fontFamily: "'Inter', sans-serif",
  },
  tooltipLabel: { color: '#0D0D0D', fontWeight: 600 },
};

const DAYS = [7, 30, 90] as const;
type Days = (typeof DAYS)[number];

function downloadReferralsCsv(rows: ReferralCommissionRow[]): void {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const dueDate = `${dd}/${mm}/${yyyy}`;
  const monthTag = `${yyyy}${mm}`;

  // Zenith Bank bulk payment format — no header row, strict column order:
  // TxnRef, BeneficiaryName, Amount, DueDate, BeneficiaryCode, AccountNumber, SortCode, DebitAccount
  const sanitize = (v: string | null | undefined): string => {
    if (!v) return '';
    // strip characters forbidden in mandatory fields: comma, semicolon, apostrophe, space
    return v.replace(/[,;' ]/g, '_').slice(0, 100);
  };

  const lines = rows.map((r, i) => {
    const idx = String(i + 1).padStart(3, '0');
    const txnRef = `ZGREF_${monthTag}_${idx}`;
    const beneName = sanitize(r.account_name ?? r.referrer_name).slice(0, 100);
    const amount = r.pending_naira.toFixed(2);
    const beneCode = sanitize(r.referrer_name ?? r.referrer_email).slice(0, 35).replace(/_+/g, '_').replace(/^_|_$/g, '');
    const accountNo = r.account_number ?? '';
    const sortCode = r.bank_code ?? '';
    const debitAccount = '';
    return [txnRef, beneName, amount, dueDate, beneCode, accountNo, sortCode, debitAccount].join(',');
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `zoomguru_referral_payout_${monthTag}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

interface Props { adminKey: string; onLogout: () => void; }

function shortDate(d: string): string {
  const [, m, day] = d.split('-');
  return `${m}/${day}`;
}

// ── Card wrapper (clay + glass hybrid) ─────────────────────────
function Card({ children, style, className = '' }: {
  children: ReactNode; style?: CSSProperties; className?: string;
}) {
  return (
    <div
      className={`card-lift ${className}`}
      style={{
        background: C.card,
        borderRadius: 22,
        border: `1px solid ${C.border}`,
        boxShadow: C.shadow,
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── Stat card ──────────────────────────────────────────────────
function StatCard({
  label, value, color, sub, delay = 0,
}: {
  label: string; value: number; color: string; sub?: string; delay?: number;
}) {
  return (
    <Card style={{
      padding: '22px 20px 20px',
      animation: `fadeSlideUp 0.55s cubic-bezier(0.16,1,0.3,1) ${delay}ms both`,
    }}>
      <p style={{
        fontFamily: F.body, fontSize: 10, fontWeight: 600,
        color: C.muted, textTransform: 'uppercase', letterSpacing: '0.09em',
        marginBottom: 14,
      }}>
        {label}
      </p>
      <p style={{
        fontFamily: F.body, fontSize: 30, fontWeight: 700,
        color: C.primary, lineHeight: 1, letterSpacing: '-0.025em',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value.toLocaleString()}
      </p>
      {sub && (
        <p style={{ fontFamily: F.body, fontSize: 11, color: C.muted, marginTop: 9 }}>
          {sub}
        </p>
      )}
    </Card>
  );
}

// ── Chart card ─────────────────────────────────────────────────
function ChartCard({ title, children, delay = 0 }: {
  title: string; children: ReactNode; delay?: number;
}) {
  return (
    <Card style={{
      animation: `fadeSlideUp 0.55s cubic-bezier(0.16,1,0.3,1) ${delay}ms both`,
    }}>
      <div style={{ padding: '22px 24px 0' }}>
        <p style={{
          fontFamily: F.body, fontSize: 12, fontWeight: 600,
          color: C.secondary, letterSpacing: '-0.01em', marginBottom: 20,
        }}>
          {title}
        </p>
      </div>
      <div style={{ padding: '0 16px 20px', overflow: 'hidden' }}>
        {children}
      </div>
    </Card>
  );
}

// ── Skeleton block ─────────────────────────────────────────────
function Skel({ w = '100%', h = 14, r = 8 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div className="skeleton" style={{ width: w, height: h, borderRadius: r }} />
  );
}

type Page = 'analytics' | 'broadcast';

// ── Main dashboard ─────────────────────────────────────────────
export default function Dashboard({ adminKey, onLogout }: Props) {
  const [page, setPage] = useState<Page>('analytics');
  const [days, setDays] = useState<Days>(30);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (d: Days) => {
    setRefreshing(true);
    setError('');
    try {
      const [stats, signups, payments, usage, downloads, users, referrals] = await Promise.all([
        fetchStats(adminKey), fetchSignups(adminKey, d),
        fetchPayments(adminKey, d), fetchUsage(adminKey, d),
        fetchDownloads(adminKey, d), fetchUsers(adminKey),
        fetchReferrals(adminKey),
      ]);
      setData({ stats, signups, payments, usage, downloads, users, referrals });
    } catch {
      setError('Failed to load data. Check backend connection.');
    } finally {
      setRefreshing(false);
    }
  }, [adminKey]);

  useEffect(() => { void load(days); }, [load, days]);

  return (
    <div style={{ minHeight: '100vh', background: C.bg, overflowX: 'hidden' }}>

      {/* ── Sticky header ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        boxShadow: '0 1px 0 rgba(0,0,0,0.04), 0 4px 20px rgba(0,0,0,0.04)',
      }}>
        <div className="header-inner">
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 0 }}>
            <span style={{
              fontFamily: F.heading, fontStyle: 'italic', fontWeight: 700,
              fontSize: 26, color: C.primary, letterSpacing: '-0.025em',
            }}>
              ZoomGuru
            </span>
            <span className="header-tag">Admin</span>
          </div>

          {/* Controls */}
          <div className="header-controls">
            {/* Page nav */}
            <div style={{
              display: 'flex', background: '#EDEBE7',
              borderRadius: 11, padding: 3, gap: 1,
            }}>
              {(['analytics', 'broadcast'] as Page[]).map((p) => (
                <button
                  key={p}
                  className="day-tab"
                  onClick={() => setPage(p)}
                  style={{
                    padding: '5px 15px', borderRadius: 8,
                    background: page === p ? C.primary : 'transparent',
                    color: page === p ? '#FFFFFF' : C.secondary,
                    fontFamily: F.body, fontSize: 12,
                    fontWeight: page === p ? 600 : 400,
                  }}
                >
                  {p === 'analytics' ? 'Analytics' : 'Broadcast Mail'}
                </button>
              ))}
            </div>

            {/* Day tabs — only on analytics page */}
            {page === 'analytics' && (
            <div style={{
              display: 'flex', background: '#EDEBE7',
              borderRadius: 11, padding: 3, gap: 1,
            }}>
              {DAYS.map((d) => (
                <button
                  key={d}
                  className="day-tab"
                  onClick={() => setDays(d)}
                  style={{
                    padding: '5px 15px', borderRadius: 8,
                    background: days === d ? C.primary : 'transparent',
                    color: days === d ? '#FFFFFF' : C.secondary,
                    fontFamily: F.body, fontSize: 12,
                    fontWeight: days === d ? 600 : 400,
                  }}
                >
                  {d}d
                </button>
              ))}
            </div>
            )}

            {/* Refresh */}
            <button
              className="btn-ghost"
              onClick={() => { void load(days); }}
              disabled={refreshing}
              style={{
                padding: '6px 16px',
                background: 'transparent',
                border: '1.5px solid rgba(0,0,0,0.1)',
                borderRadius: 10,
                fontFamily: F.body, fontSize: 12, fontWeight: 500,
                color: refreshing ? C.muted : C.secondary,
                cursor: refreshing ? 'not-allowed' : 'pointer',
              }}
            >
              {refreshing ? 'Loading…' : 'Refresh'}
            </button>

            {/* Logout */}
            <button
              className="btn-ghost"
              onClick={onLogout}
              style={{
                padding: '6px 16px',
                background: 'transparent',
                border: '1.5px solid rgba(0,0,0,0.1)',
                borderRadius: 10,
                fontFamily: F.body, fontSize: 12, fontWeight: 500,
                color: C.secondary, cursor: 'pointer',
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* ── Page content ── */}
      <main className="main-content">

        {/* Broadcast Mail page */}
        {page === 'broadcast' && (
          <div style={{ animation: 'fadeSlideUp 0.45s cubic-bezier(0.16,1,0.3,1) both' }}>
            <div style={{ marginBottom: 32 }}>
              <h1 className="welcome-heading">Broadcast Mail</h1>
              <p style={{ fontFamily: F.body, fontSize: 13, color: C.muted, marginTop: 10 }}>
                Draft, target, and schedule emails to ZoomGuru users via Resend.
              </p>
            </div>
            <BroadcastPage adminKey={adminKey} />
          </div>
        )}

        {/* Analytics page */}
        {page === 'analytics' && <>

        {/* Welcome */}
        <div style={{
          marginBottom: 36,
          animation: 'fadeSlideUp 0.55s cubic-bezier(0.16,1,0.3,1) 0ms both',
        }}>
          <h1 className="welcome-heading">Analytics</h1>
          <p style={{
            fontFamily: F.body, fontSize: 13, color: C.muted, marginTop: 10,
          }}>
            ZoomGuru · {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.06)',
            border: '1px solid rgba(239,68,68,0.15)',
            borderRadius: 14, padding: '13px 18px', marginBottom: 24,
            fontFamily: F.body, fontSize: 13, color: '#DC2626',
            animation: 'fadeIn 0.2s ease',
          }}>
            {error}
          </div>
        )}

        {/* ── Stat cards ── */}
        <div className="stats-grid" style={{ marginBottom: 18 }}>
          {!data ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} style={{
                padding: '22px 20px 20px',
                animation: `fadeSlideUp 0.55s cubic-bezier(0.16,1,0.3,1) ${i * 55}ms both`,
              }}>
                <Skel w="55%" h={10} r={5} />
                <div style={{ marginTop: 14 }}><Skel w="40%" h={28} r={7} /></div>
              </Card>
            ))
          ) : (
            <>
              <StatCard label="Total Users"    value={data.stats.total_users}           color={ACCENT.blue}   delay={0}   />
              <StatCard label="Downloads"       value={data.stats.total_downloads}       color={ACCENT.green}  delay={55}  />
              <StatCard label="Active Subs"     value={data.stats.active_subscriptions}  color={ACCENT.purple} sub="₦50k/mo each" delay={110} />
              <StatCard label="Yearly Subs"     value={data.stats.yearly_subscriptions}  color={ACCENT.orange} sub="₦500k/year"  delay={165} />
              <StatCard label="AI Sessions"     value={data.stats.total_ai_sessions}     color={ACCENT.red}    delay={220} />
            </>
          )}
        </div>

        {/* ── Charts row 1 ── */}
        <div className="charts-grid" style={{ marginBottom: 18 }}>
          <ChartCard title={`Signups — last ${days} days`} delay={300}>
            {!data
              ? <div className="skeleton" style={{ height: 200, borderRadius: 12 }} />
              : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={data.signups.map((d) => ({ ...d, date: shortDate(d.date) }))} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                    <XAxis dataKey="date" tick={CHART.axis} axisLine={false} tickLine={false} />
                    <YAxis tick={CHART.axis} allowDecimals={false} axisLine={false} tickLine={false} width={36} />
                    <Tooltip contentStyle={CHART.tooltip} labelStyle={CHART.tooltipLabel} />
                    <Line type="monotone" dataKey="count" stroke={ACCENT.blue} strokeWidth={2.5} dot={false} name="Signups" />
                  </LineChart>
                </ResponsiveContainer>
              )}
          </ChartCard>

          <ChartCard title={`Payments — last ${days} days`} delay={355}>
            {!data
              ? <div className="skeleton" style={{ height: 200, borderRadius: 12 }} />
              : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={data.payments.map((d) => ({ ...d, date: shortDate(d.date) }))} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                    <XAxis dataKey="date" tick={CHART.axis} axisLine={false} tickLine={false} />
                    <YAxis tick={CHART.axis} allowDecimals={false} axisLine={false} tickLine={false} width={36} />
                    <Tooltip contentStyle={CHART.tooltip} labelStyle={CHART.tooltipLabel} />
                    <Legend wrapperStyle={{ fontSize: 11, color: C.muted }} />
                    <Line type="monotone" dataKey="monthly"  stroke={ACCENT.purple} strokeWidth={2.5} dot={false} name="Monthly"  />
                    <Line type="monotone" dataKey="yearly"   stroke={ACCENT.orange} strokeWidth={2.5} dot={false} name="Yearly"   />
                  </LineChart>
                </ResponsiveContainer>
              )}
          </ChartCard>
        </div>

        {/* ── Charts row 2 ── */}
        <div className="charts-grid" style={{ marginBottom: 28 }}>
          <ChartCard title={`AI Usage — last ${days} days`} delay={410}>
            {!data
              ? <div className="skeleton" style={{ height: 200, borderRadius: 12 }} />
              : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.usage.map((d) => ({ ...d, date: shortDate(d.date) }))} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                    <XAxis dataKey="date" tick={CHART.axis} axisLine={false} tickLine={false} />
                    <YAxis tick={CHART.axis} allowDecimals={false} axisLine={false} tickLine={false} width={36} />
                    <Tooltip contentStyle={CHART.tooltip} labelStyle={CHART.tooltipLabel} />
                    <Legend wrapperStyle={{ fontSize: 11, color: C.muted }} />
                    <Bar dataKey="stream"     stackId="a" fill={ACCENT.blue}   name="Stream" />
                    <Bar dataKey="screenshot" stackId="a" fill={ACCENT.green}  name="Screenshot" />
                    <Bar dataKey="transcribe" stackId="a" fill={ACCENT.orange} name="Transcribe" radius={[6,6,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
          </ChartCard>

          <ChartCard title={`Downloads — last ${days} days`} delay={465}>
            {!data
              ? <div className="skeleton" style={{ height: 200, borderRadius: 12 }} />
              : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.downloads.map((d) => ({ ...d, date: shortDate(d.date) }))} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                    <XAxis dataKey="date" tick={CHART.axis} axisLine={false} tickLine={false} />
                    <YAxis tick={CHART.axis} allowDecimals={false} axisLine={false} tickLine={false} width={36} />
                    <Tooltip contentStyle={CHART.tooltip} labelStyle={CHART.tooltipLabel} />
                    <Legend wrapperStyle={{ fontSize: 11, color: C.muted }} />
                    <Bar dataKey="windows" fill={ACCENT.blue} name="Windows" radius={[6,6,0,0]} />
                    <Bar dataKey="mac"     fill={ACCENT.gray} name="Mac"     radius={[6,6,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
          </ChartCard>
        </div>

        {/* ── Users table ── */}
        <Card style={{
          animation: `fadeSlideUp 0.55s cubic-bezier(0.16,1,0.3,1) 520ms both`,
        }}>
          {/* Table header */}
          <div style={{
            padding: '22px 28px 16px',
            borderBottom: '1px solid rgba(0,0,0,0.04)',
          }}>
            <h2 style={{
              fontFamily: F.heading, fontStyle: 'italic', fontWeight: 700,
              fontSize: 22, color: C.primary, letterSpacing: '-0.015em',
            }}>
              Recent Users
            </h2>
            <p style={{ fontFamily: F.body, fontSize: 12, color: C.muted, marginTop: 3 }}>
              Last 50 registered accounts
            </p>
          </div>

          <div className="table-scroll">
            {!data ? (
              <div style={{ padding: '24px 28px' }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 20, marginBottom: 18,
                    opacity: 1 - i * 0.13,
                  }}>
                    <Skel w="30%" h={12} />
                    <Skel w="18%" h={12} />
                    <Skel w="10%" h={12} r={20} />
                    <Skel w="10%" h={12} r={20} />
                    <Skel w="12%" h={12} />
                  </div>
                ))}
              </div>
            ) : (
              <table style={{
                width: '100%', borderCollapse: 'collapse',
                fontFamily: F.body, fontSize: 13,
              }}>
                <thead>
                  <tr style={{ background: '#FAFAF8' }}>
                    {['Email', 'Name', 'Plan', 'Status', 'Joined'].map((h) => (
                      <th key={h} style={{
                        padding: '11px 20px',
                        textAlign: 'left',
                        fontWeight: 500,
                        fontSize: 10,
                        color: C.muted,
                        textTransform: 'uppercase',
                        letterSpacing: '0.09em',
                        borderBottom: '1px solid rgba(0,0,0,0.04)',
                        whiteSpace: 'nowrap',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((user) => (
                    <tr key={user.id} className="trow">
                      <td style={{ padding: '12px 20px', color: C.primary, fontWeight: 500, whiteSpace: 'nowrap' }}>
                        {user.email}
                      </td>
                      <td style={{ padding: '12px 20px', color: C.secondary, whiteSpace: 'nowrap' }}>
                        {user.name ?? '—'}
                      </td>
                      <td style={{ padding: '12px 20px', whiteSpace: 'nowrap' }}>
                        {user.plan ? (
                          <span style={{
                            display: 'inline-block',
                            padding: '3px 11px', borderRadius: 20,
                            fontSize: 11, fontWeight: 600,
                            background: user.plan === 'yearly'
                              ? 'rgba(245,158,11,0.1)' : 'rgba(139,92,246,0.1)',
                            color: user.plan === 'yearly' ? ACCENT.orange : ACCENT.purple,
                            border: `1px solid ${user.plan === 'yearly' ? 'rgba(245,158,11,0.22)' : 'rgba(139,92,246,0.22)'}`,
                          }}>
                            {user.plan}
                          </span>
                        ) : <span style={{ color: 'rgba(0,0,0,0.18)' }}>—</span>}
                      </td>
                      <td style={{ padding: '12px 20px', whiteSpace: 'nowrap' }}>
                        {user.status ? (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '3px 11px', borderRadius: 20,
                            fontSize: 11, fontWeight: 600,
                            background: user.status === 'active'
                              ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                            color: user.status === 'active' ? ACCENT.green : ACCENT.red,
                            border: `1px solid ${user.status === 'active' ? 'rgba(16,185,129,0.22)' : 'rgba(239,68,68,0.22)'}`,
                          }}>
                            <span style={{
                              width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                              background: user.status === 'active' ? ACCENT.green : ACCENT.red,
                            }} />
                            {user.status}
                          </span>
                        ) : <span style={{ color: 'rgba(0,0,0,0.18)' }}>—</span>}
                      </td>
                      <td style={{ padding: '12px 20px', color: C.muted, whiteSpace: 'nowrap' }}>
                        {user.created_at.slice(0, 10)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        {/* ── Referrals table ── */}
        <Card style={{
          marginTop: 18,
          animation: `fadeSlideUp 0.55s cubic-bezier(0.16,1,0.3,1) 575ms both`,
        }}>
          <div style={{ padding: '22px 28px 16px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
            <h2 style={{
              fontFamily: F.heading, fontStyle: 'italic', fontWeight: 700,
              fontSize: 22, color: C.primary, letterSpacing: '-0.015em',
            }}>
              Referral Payouts
            </h2>
            <p style={{ fontFamily: F.body, fontSize: 12, color: C.muted, marginTop: 3 }}>
              Per referrer · sorted by amount owed (highest first)
            </p>
          </div>

          <div className="table-scroll">
            {!data ? (
              <div style={{ padding: '24px 28px' }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{ display: 'flex', gap: 20, marginBottom: 18, opacity: 1 - i * 0.18 }}>
                    <Skel w="22%" h={12} />
                    <Skel w="8%"  h={12} r={20} />
                    <Skel w="12%" h={12} />
                    <Skel w="12%" h={12} />
                    <Skel w="18%" h={12} />
                  </div>
                ))}
              </div>
            ) : data.referrals.length === 0 ? (
              <div style={{ padding: '32px 28px', fontFamily: F.body, fontSize: 13, color: C.muted }}>
                No referral commissions yet.
              </div>
            ) : (
              <>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: F.body, fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#FAFAF8' }}>
                      {['Name', 'Referrals', 'Amount Owed (₦)', 'Account Number', 'Bank'].map((h) => (
                        <th key={h} style={{
                          padding: '11px 20px',
                          textAlign: 'left', fontWeight: 500, fontSize: 10,
                          color: C.muted, textTransform: 'uppercase', letterSpacing: '0.09em',
                          borderBottom: '1px solid rgba(0,0,0,0.04)', whiteSpace: 'nowrap',
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.referrals.map((r) => (
                      <tr key={r.referrer_email} className="trow">
                        <td style={{ padding: '13px 20px', whiteSpace: 'nowrap' }}>
                          <div style={{ color: C.primary, fontWeight: 600, fontSize: 13 }}>
                            {r.referrer_name ?? '—'}
                          </div>
                          <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>
                            {r.referrer_email}
                          </div>
                        </td>
                        <td style={{ padding: '13px 20px', whiteSpace: 'nowrap' }}>
                          <span style={{
                            display: 'inline-block', padding: '3px 12px', borderRadius: 20,
                            fontSize: 12, fontWeight: 700,
                            background: 'rgba(59,130,246,0.09)', color: ACCENT.blue,
                            border: '1px solid rgba(59,130,246,0.2)',
                          }}>
                            {r.referral_count}
                          </span>
                        </td>
                        <td style={{ padding: '13px 20px', whiteSpace: 'nowrap' }}>
                          <div style={{ color: C.primary, fontWeight: 700, fontSize: 15, letterSpacing: '-0.02em' }}>
                            ₦{r.pending_naira.toLocaleString()}
                          </div>
                          {r.total_naira !== r.pending_naira && (
                            <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>
                              ₦{r.total_naira.toLocaleString()} all-time
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '13px 20px', color: C.secondary, whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 13 }}>
                          {r.account_number ?? <span style={{ color: 'rgba(0,0,0,0.18)', fontFamily: F.body }}>—</span>}
                        </td>
                        <td style={{ padding: '13px 20px', whiteSpace: 'nowrap' }}>
                          <div style={{ color: C.secondary, fontSize: 13 }}>{r.bank_name ?? <span style={{ color: 'rgba(0,0,0,0.18)' }}>—</span>}</div>
                          {r.account_name && (
                            <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{r.account_name}</div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ padding: '18px 24px', borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                  <button
                    onClick={() => downloadReferralsCsv(data.referrals)}
                    style={{
                      padding: '10px 24px',
                      background: C.primary,
                      border: 'none',
                      borderRadius: 11,
                      fontFamily: F.body, fontSize: 13, fontWeight: 600,
                      color: '#FFFFFF',
                      cursor: 'pointer',
                    }}
                  >
                    Download CSV
                  </button>
                </div>
              </>
            )}
          </div>
        </Card>

        </>}
      </main>
    </div>
  );
}
