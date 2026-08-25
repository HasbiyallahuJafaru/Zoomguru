import { useState, useEffect, useCallback } from 'react';
import type { ReactNode, CSSProperties } from 'react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import {
  fetchStats, fetchSignups, fetchPayments,
  fetchUsage, fetchApiUsage, fetchApiHealth, fetchDownloads, fetchUsers, fetchReferrals,
} from './api';
import type { DashboardData, ReferralCommissionRow } from './types';
import BroadcastPage from './BroadcastPage';

// ── Design tokens ──────────────────────────────────────────────
const C = {
  bg:       '#F7F4F0',
  card:     '#FFFFFF',
  border:   'rgba(23,20,17,0.07)',
  primary:  '#26221F',
  secondary:'#6E6660',
  muted:    '#A69E97',
  // Sharper than a soft drop shadow: a crisp hairline carries the edge and
  // the shadow only lifts the card off the ground.
  shadow:   '0 1px 2px rgba(23,20,17,0.04), 0 10px 24px -12px rgba(23,20,17,0.12)',
};
const F = {
  heading: "'Cormorant Garamond', Georgia, serif",
  body:    "'Inter', system-ui, sans-serif",
};

// ── 60 / 30 / 10 ────────────────────────────────────────────────
//
//   60%  C.bg      warm cream ground — the page itself, and the space
//                  between cards. Dominant by area, never competes.
//   30%  C.card    white card surfaces carrying ink type (C.primary,
//                  C.secondary) and hairline rules. The content layer.
//   10%  ACCENT.purple  warm orange. Scarce on purpose: it marks the one
//                  series or state that deserves attention, nothing else.
//
// The rule only holds if the accent stays rare, so charts lead with ink and
// promote a single series to orange — the same move the reference makes,
// where dark bars are the baseline and orange marks the figure you act on.
// Grade the remaining series through ink tints rather than new hues, so six
// stacked series stay separable without becoming a rainbow.
//
// `green` and `red` are semantic only — active / failing status — and are
// muted so they read as state, not as data.
// Keys keep their original names so every existing call site still resolves.
const ACCENT = {
  blue:   '#26221F', // ink            — baseline series (the 30%)
  gray:   '#8C847D', // ink, mid       — secondary series
  orange: '#CFC8C1', // ink, soft      — tertiary series
  purple: '#E2894A', // warm accent    — the 10%, use sparingly
  green:  '#5C7F6B', // semantic positive
  red:    '#BE5540', // semantic negative
};

// ── Chart shared config ─────────────────────────────────────────
const CHART = {
  axis:    { fill: '#A69E97', fontSize: 10 },
  grid:    'rgba(23,20,17,0.05)',
  tooltip: {
    background: '#FFFFFF',
    border: '1px solid rgba(23,20,17,0.08)',
    borderRadius: 12,
    boxShadow: '0 10px 30px -12px rgba(23,20,17,0.22)',
    fontSize: 12,
    fontFamily: "'Inter', sans-serif",
  },
  tooltipLabel: { color: '#26221F', fontWeight: 600 },
};

// Wide-tracked uppercase micro-label — the reference's recurring device.
// Every section title and stat caption uses it, which is where the
// uniformity comes from.
const MICRO: CSSProperties = {
  fontFamily: F.body,
  fontSize: 10,
  fontWeight: 500,
  color: '#A69E97',
  textTransform: 'uppercase',
  letterSpacing: '0.16em',
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
        borderRadius: 14,
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
      padding: '18px 18px 20px',
      animation: `fadeSlideUp 0.55s cubic-bezier(0.16,1,0.3,1) ${delay}ms both`,
    }}>
      {/* Short rule in the metric's own colour — the only place a stat card
          carries hue. Ink for baseline metrics, orange for the one that
          matters, which keeps the accent at roughly a tenth of the surface. */}
      <div style={{
        width: 22, height: 2, borderRadius: 2,
        background: color, marginBottom: 14,
      }} />
      <p style={{ ...MICRO, marginBottom: 10 }}>{label}</p>
      <p style={{
        fontFamily: F.body, fontSize: 28, fontWeight: 600,
        color: C.primary, lineHeight: 1, letterSpacing: '-0.02em',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value.toLocaleString()}
      </p>
      {sub && (
        <p style={{ fontFamily: F.body, fontSize: 11, color: C.muted, marginTop: 8 }}>
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
      <div style={{
        padding: '18px 20px 14px',
        borderBottom: `1px solid ${C.border}`,
      }}>
        <p style={MICRO}>{title}</p>
      </div>
      <div style={{ padding: '18px 12px 14px', overflow: 'hidden' }}>
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
      const [stats, signups, payments, usage, apiUsage, apiHealth, downloads, users, referrals] = await Promise.all([
        fetchStats(adminKey), fetchSignups(adminKey, d),
        fetchPayments(adminKey, d), fetchUsage(adminKey, d),
        fetchApiUsage(adminKey, d), fetchApiHealth(adminKey),
        fetchDownloads(adminKey, d), fetchUsers(adminKey),
        fetchReferrals(adminKey),
      ]);
      setData({ stats, signups, payments, usage, apiUsage, apiHealth, downloads, users, referrals });
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
              display: 'flex', background: '#EFEAE4',
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
              display: 'flex', background: '#EFEAE4',
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
            fontFamily: F.body, fontSize: 13, color: ACCENT.red,
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
              <StatCard label="Downloads"       value={data.stats.total_downloads}       color={ACCENT.gray}   delay={55}  />
              <StatCard label="Active Subs"     value={data.stats.active_subscriptions}  color={ACCENT.purple} sub="All plans, currently paid" delay={110} />
              <StatCard label="Yearly Subs"     value={data.stats.yearly_subscriptions}  color={ACCENT.orange} sub="₦450k/year"  delay={165} />
              <StatCard label="AI Sessions"     value={data.stats.total_ai_sessions}     color={ACCENT.gray}   delay={220} />
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
                    <Line type="monotone" dataKey="count" stroke={ACCENT.purple} strokeWidth={2} dot={false} name="Signups" />
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
                    <Line type="monotone" dataKey="monthly"  stroke={ACCENT.blue}   strokeWidth={2}   dot={false} name="Monthly"  />
                    <Line type="monotone" dataKey="yearly"   stroke={ACCENT.purple} strokeWidth={2}   dot={false} name="Yearly"   />
                  </LineChart>
                </ResponsiveContainer>
              )}
          </ChartCard>
        </div>

        {/* ── API billing health ── */}
        <ChartCard title="AI Provider Billing — calls, failures and balance" delay={400}>
          {!data
            ? <div className="skeleton" style={{ height: 180, borderRadius: 12 }} />
            : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: F.body, fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#FBF9F6' }}>
                      {['Provider', 'Calls today', 'Calls 30d', 'Billing errors', 'Balance', 'How to check'].map((h) => (
                        <th key={h} style={{
                          padding: '11px 16px', textAlign: 'left', fontWeight: 500, fontSize: 10,
                          color: C.muted, textTransform: 'uppercase', letterSpacing: '0.09em',
                          borderBottom: '1px solid rgba(0,0,0,0.04)', whiteSpace: 'nowrap',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.apiHealth.map((r) => {
                      const failing = r.billingFailuresToday > 0;
                      const low = r.balanceUsd !== null && parseFloat(r.balanceUsd) < 5;
                      return (
                        <tr key={r.provider} className="trow">
                          <td style={{ padding: '12px 16px', color: C.primary, fontWeight: 600, textTransform: 'capitalize' }}>
                            {r.provider}
                          </td>
                          <td style={{ padding: '12px 16px', color: C.secondary }}>{r.callsToday.toLocaleString()}</td>
                          <td style={{ padding: '12px 16px', color: C.secondary }}>{r.calls30d.toLocaleString()}</td>
                          <td style={{ padding: '12px 16px', fontWeight: failing ? 700 : 400, color: failing ? ACCENT.red : C.secondary }}>
                            {failing
                              ? `${r.billingFailuresToday} today — CHECK BILLING`
                              : r.billingFailures30d > 0
                                ? `${r.billingFailures30d} in 30d`
                                : 'none'}
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: low ? 700 : 500, color: low ? ACCENT.red : C.primary }}>
                            {r.balanceUsd !== null ? `$${r.balanceUsd}${low ? ' — LOW' : ''}` : '—'}
                          </td>
                          <td style={{ padding: '12px 16px', color: C.muted, fontSize: 12 }}>{r.balanceNote}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
        </ChartCard>

        <div style={{ height: 28 }} />

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
                    <Bar dataKey="screenshot" stackId="a" fill={ACCENT.gray}   name="Screenshot" />
                    <Bar dataKey="transcribe" stackId="a" fill={ACCENT.purple} name="Transcribe" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
          </ChartCard>

          <ChartCard title={`AI Provider Calls — last ${days} days`} delay={438}>
            {!data
              ? <div className="skeleton" style={{ height: 200, borderRadius: 12 }} />
              : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.apiUsage.map((d) => ({ ...d, date: shortDate(d.date) }))} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                    <XAxis dataKey="date" tick={CHART.axis} axisLine={false} tickLine={false} />
                    <YAxis tick={CHART.axis} allowDecimals={false} axisLine={false} tickLine={false} width={36} />
                    <Tooltip contentStyle={CHART.tooltip} labelStyle={CHART.tooltipLabel} />
                    <Legend wrapperStyle={{ fontSize: 11, color: C.muted }} />
                    <Bar dataKey="gemini"   stackId="p" fill={ACCENT.blue}   name="Gemini" />
                    <Bar dataKey="deepseek" stackId="p" fill={ACCENT.purple} name="DeepSeek" />
                    <Bar dataKey="groq"     stackId="p" fill={ACCENT.gray}   name="Groq" />
                    <Bar dataKey="openai"   stackId="p" fill={ACCENT.orange} name="OpenAI" />
                    <Bar dataKey="lemonfox" stackId="p" fill="#E8E3DE"       name="LemonFox" />
                    <Bar dataKey="other"    stackId="p" fill="#F1ECE7"       name="Other" radius={[4,4,0,0]} />
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
                    <Bar dataKey="windows" fill={ACCENT.blue} name="Windows" radius={[4,4,0,0]} />
                    <Bar dataKey="mac"     fill={ACCENT.gray} name="Mac"     radius={[4,4,0,0]} />
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
                  <tr style={{ background: '#FBF9F6' }}>
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
                    <tr style={{ background: '#FBF9F6' }}>
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
