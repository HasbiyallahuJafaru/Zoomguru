import { useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import {
  fetchStats, fetchSignups, fetchPayments,
  fetchUsage, fetchApiUsage, fetchApiHealth, fetchDownloads, fetchUsers, fetchReferrals,
} from './api';
import type { DashboardData, ReferralCommissionRow, StatsResult } from './types';
import BroadcastPage from './BroadcastPage';
import {
  SERIES, STATUS, AXIS, GRID, SEGMENT_GAP, ChartTooltip, TOOLTIP_CURSOR,
  Wordmark, SectionHead, ChartCard, LedgerCard, Badge, Notice, Skel, Empty, Segmented,
} from './ui';

const DAYS = [7, 30, 90] as const;
type Days = (typeof DAYS)[number];
type Page = 'analytics' | 'broadcast';

const DAY_OPTIONS = DAYS.map((d) => ({ value: d, label: `${d}d` }));
const PAGE_OPTIONS = [
  { value: 'analytics' as const, label: 'Analytics' },
  { value: 'broadcast' as const, label: 'Broadcast' },
];

/** The API stores provider keys lowercase. CSS capitalize would render
 *  "Openrouter" and "Openai"; these are product names and get spelled right. */
const PROVIDER_NAME: Record<string, string> = {
  gemini: 'Gemini',
  openrouter: 'OpenRouter',
  groq: 'Groq',
  openai: 'OpenAI',
  lemonfox: 'LemonFox',
};

/** Recharts wants short ticks, and a 90-day axis has no room for full dates. */
function shortDate(d: string): string {
  const [, m, day] = d.split('-');
  return `${day}/${m}`;
}

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

// ── Masthead ───────────────────────────────────────────────────

/** The page opens like an issue: a dateline, a name, a rule. The dateline is
 *  the only place the reporting window is written out in words, which is what
 *  stops every chart title having to repeat "last 30 days". */
function Masthead({ title, dateline }: { title: string; dateline: string }) {
  return (
    <header className="rise">
      <p className="label">{dateline}</p>
      <h1 className="mt-3 text-mega">{title}</h1>
      <hr className="mt-6 border-0 border-t border-ink/15" />
    </header>
  );
}

// ── The lede ───────────────────────────────────────────────────

/** Two kinds of number, told apart by their surface.
 *
 *  `online_now` is a live reading of the product itself, so it gets the site's
 *  overlay panel and the only display-face figure on the page. Everything else
 *  is a cumulative counter, so it goes in a ruled rail where the values stack
 *  into one right-aligned column and can actually be compared. */
function Lede({ stats }: { stats: StatsResult | null }) {
  const counters: Array<{ label: string; value: number; note?: string }> = stats
    ? [
        { label: 'Total users', value: stats.total_users },
        { label: 'Downloads', value: stats.total_downloads, note: 'All time' },
        { label: 'Downloads this month', value: stats.downloads_this_month, note: 'Since the 1st, UTC' },
        { label: 'Active subs', value: stats.active_subscriptions, note: 'All plans, currently paid' },
        { label: 'Yearly subs', value: stats.yearly_subscriptions },
        { label: 'AI sessions', value: stats.total_ai_sessions },
      ]
    : [];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      <section
        className="overlay-panel rise flex flex-col justify-between gap-8 p-7"
        style={{ '--d': '60ms' } as React.CSSProperties}
        aria-label="Live now"
      >
        <p className="label flex items-center gap-2.5 !text-overlay">
          <span className="live-dot" aria-hidden />
          Live now
        </p>

        {stats ? (
          <p
            className="figure font-display text-lede leading-[0.85] text-overlay"
            style={{ fontVariationSettings: '"SOFT" 0, "WONK" 1, "opsz" 144' }}
          >
            {stats.online_now.toLocaleString()}
          </p>
        ) : (
          <Skel w="45%" h={88} />
        )}

        <p className="max-w-[24ch] text-[0.9375rem] leading-snug text-muted">
          people with the app open, counted over the last five minutes
        </p>
      </section>

      <section
        className="card rise"
        style={{ '--d': '120ms' } as React.CSSProperties}
        aria-label="Totals"
      >
        <ul>
          {(stats ? counters : Array.from({ length: 5 }, () => null)).map((c, i) => (
            <li
              key={c?.label ?? i}
              className="flex items-baseline justify-between gap-6 border-b border-rule/45 px-6 py-[1.15rem] last:border-b-0"
            >
              {c ? (
                <>
                  <span className="min-w-0">
                    <span className="label block">{c.label}</span>
                    {c.note && (
                      <span className="mt-1 block text-[0.75rem] text-muted/80">{c.note}</span>
                    )}
                  </span>
                  <span className="figure shrink-0 text-2xl font-semibold text-ink">
                    {c.value.toLocaleString()}
                  </span>
                </>
              ) : (
                <>
                  <Skel w="7rem" h={10} />
                  <Skel w="3.5rem" h={20} />
                </>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// ── Plot frames ────────────────────────────────────────────────

const PLOT_HEIGHT = 220;
/** Full-width plots get more height, or a 6:1 frame flattens the trend out. */
const PLOT_HEIGHT_WIDE = 280;
const ACTIVE_DOT = { r: 4, strokeWidth: 2, stroke: '#ffffff' } as const;
const PLOT_MARGIN = { top: 6, right: 8, left: 0, bottom: 0 };

function PlotSkeleton({ height = PLOT_HEIGHT }: { height?: number }) {
  return <div className="skeleton mx-3" style={{ height }} />;
}

// ── Dashboard ──────────────────────────────────────────────────

interface Props { adminKey: string; onLogout: () => void; }

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
      setError('Could not load the data. Check that the backend is reachable, then refresh.');
    } finally {
      setRefreshing(false);
    }
  }, [adminKey]);

  useEffect(() => { void load(days); }, [load, days]);

  const servingProviders = data?.apiHealth.filter((r) => r.callsToday > 0 || r.calls30d > 0) ?? [];

  const dateline = `Admin · ${new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })}${page === 'analytics' ? ` · Last ${days} days` : ''}`;

  return (
    <div className="min-h-screen">
      {/* ── Bar ── */}
      <div className="sticky top-0 z-50 border-b border-rule/70 bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-3 md:px-9">
          <div className="flex items-center gap-3">
            <Wordmark />
            <span className="label hidden sm:inline">Admin</span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Segmented options={PAGE_OPTIONS} value={page} onChange={setPage} label="Section" />
            {page === 'analytics' && (
              <>
                <Segmented options={DAY_OPTIONS} value={days} onChange={setDays} label="Reporting window" />
                <button
                  type="button"
                  onClick={() => void load(days)}
                  disabled={refreshing}
                  className="btn btn-outline btn-sm"
                >
                  {refreshing ? 'Loading…' : 'Refresh'}
                </button>
              </>
            )}
            <button type="button" onClick={onLogout} className="btn btn-secondary btn-sm">
              Sign out
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1320px] px-5 pb-24 pt-10 md:px-9 md:pt-14">
        <Masthead title={page === 'analytics' ? 'Analytics' : 'Broadcast'} dateline={dateline} />

        {page === 'broadcast' ? (
          <div className="rise mt-10" style={{ '--d': '60ms' } as React.CSSProperties}>
            <BroadcastPage adminKey={adminKey} />
          </div>
        ) : (
          <>
            {error && (
              <div className="mt-8">
                <Notice tone={STATUS.bad} onClose={() => setError('')}>{error}</Notice>
              </div>
            )}

            <div className="mt-10">
              <Lede stats={data?.stats ?? null} />
            </div>

            {/* ── Infrastructure ── */}
            <section className="mt-16">
              <SectionHead eyebrow="Infrastructure" title="AI providers" />

              <LedgerCard title="Provider traffic" caption="Providers with no calls in the window are hidden">
                {!data ? (
                  <div className="p-5"><Skel h={140} /></div>
                ) : servingProviders.length === 0 ? (
                  <p className="px-5 py-10 text-center text-[0.875rem] text-muted">
                    No provider has served a request yet.
                  </p>
                ) : (
                  <table className="ledger">
                    <thead>
                      <tr>
                        <th>Provider</th>
                        <th className="num">Calls today</th>
                        <th className="num">Calls 30d</th>
                      </tr>
                    </thead>
                    <tbody>
                      {servingProviders.map((r) => (
                        <tr key={r.provider}>
                          <td className="font-medium text-ink">
                            {PROVIDER_NAME[r.provider] ?? r.provider}
                          </td>
                          <td className="num text-muted">{r.callsToday.toLocaleString()}</td>
                          <td className="num text-muted">{r.calls30d.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </LedgerCard>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <ChartCard
                  title="Requests by feature"
                  delay={60}
                  series={[
                    { name: 'Stream', color: SERIES[0] },
                    { name: 'Screenshot', color: SERIES[1] },
                    { name: 'Transcribe', color: SERIES[2] },
                  ]}
                >
                  {!data ? <PlotSkeleton /> : (
                    <ResponsiveContainer width="100%" height={PLOT_HEIGHT}>
                      <BarChart data={data.usage.map((d) => ({ ...d, date: shortDate(d.date) }))} margin={PLOT_MARGIN}>
                        <CartesianGrid {...GRID} />
                        <XAxis dataKey="date" {...AXIS} interval="preserveStartEnd" minTickGap={26} />
                        <YAxis {...AXIS} allowDecimals={false} width={38} />
                        <Tooltip content={<ChartTooltip />} cursor={TOOLTIP_CURSOR} />
                        <Bar dataKey="stream"     stackId="a" fill={SERIES[0]} name="Stream" {...SEGMENT_GAP} />
                        <Bar dataKey="screenshot" stackId="a" fill={SERIES[1]} name="Screenshot" {...SEGMENT_GAP} />
                        <Bar dataKey="transcribe" stackId="a" fill={SERIES[2]} name="Transcribe" {...SEGMENT_GAP} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </ChartCard>

                <ChartCard
                  title="Calls by provider"
                  delay={100}
                  series={[
                    { name: 'Gemini', color: SERIES[0] },
                    { name: 'OpenRouter', color: SERIES[1] },
                    { name: 'Groq', color: SERIES[2] },
                    { name: 'OpenAI', color: SERIES[3] },
                    { name: 'LemonFox', color: SERIES[4] },
                    { name: 'Other', color: SERIES[5] },
                  ]}
                >
                  {!data ? <PlotSkeleton /> : (
                    <ResponsiveContainer width="100%" height={PLOT_HEIGHT}>
                      <BarChart data={data.apiUsage.map((d) => ({ ...d, date: shortDate(d.date) }))} margin={PLOT_MARGIN}>
                        <CartesianGrid {...GRID} />
                        <XAxis dataKey="date" {...AXIS} interval="preserveStartEnd" minTickGap={26} />
                        <YAxis {...AXIS} allowDecimals={false} width={38} />
                        <Tooltip content={<ChartTooltip />} cursor={TOOLTIP_CURSOR} />
                        {/* Stack order is fixed and must stay fixed: it is what keeps
                            the two weakest colour pairs from ever touching. */}
                        <Bar dataKey="gemini"     stackId="p" fill={SERIES[0]} name="Gemini" {...SEGMENT_GAP} />
                        <Bar dataKey="openrouter" stackId="p" fill={SERIES[1]} name="OpenRouter" {...SEGMENT_GAP} />
                        <Bar dataKey="groq"       stackId="p" fill={SERIES[2]} name="Groq" {...SEGMENT_GAP} />
                        <Bar dataKey="openai"     stackId="p" fill={SERIES[3]} name="OpenAI" {...SEGMENT_GAP} />
                        <Bar dataKey="lemonfox"   stackId="p" fill={SERIES[4]} name="LemonFox" {...SEGMENT_GAP} />
                        <Bar dataKey="other"      stackId="p" fill={SERIES[5]} name="Other" {...SEGMENT_GAP} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </ChartCard>
              </div>
            </section>

            {/* ── Traffic ── */}
            <section className="mt-16">
              <SectionHead eyebrow="Traffic" title="Signups and downloads" />

              <div className="grid gap-4 lg:grid-cols-2">
                <ChartCard title="Signups" delay={0}>
                  {!data ? <PlotSkeleton /> : (
                    <ResponsiveContainer width="100%" height={PLOT_HEIGHT}>
                      <LineChart data={data.signups.map((d) => ({ ...d, date: shortDate(d.date) }))} margin={PLOT_MARGIN}>
                        <CartesianGrid {...GRID} />
                        <XAxis dataKey="date" {...AXIS} interval="preserveStartEnd" minTickGap={26} />
                        <YAxis {...AXIS} allowDecimals={false} width={38} />
                        <Tooltip content={<ChartTooltip />} />
                        <Line type="monotone" dataKey="count" name="Signups" stroke={SERIES[0]} strokeWidth={2} dot={false} activeDot={ACTIVE_DOT} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </ChartCard>

                <ChartCard
                  title="Downloads"
                  delay={60}
                  series={[
                    { name: 'Windows', color: SERIES[0] },
                    { name: 'Mac', color: SERIES[1] },
                  ]}
                >
                  {!data ? <PlotSkeleton /> : (
                    <ResponsiveContainer width="100%" height={PLOT_HEIGHT}>
                      <BarChart data={data.downloads.map((d) => ({ ...d, date: shortDate(d.date) }))} margin={PLOT_MARGIN}>
                        <CartesianGrid {...GRID} />
                        <XAxis dataKey="date" {...AXIS} interval="preserveStartEnd" minTickGap={26} />
                        <YAxis {...AXIS} allowDecimals={false} width={38} />
                        <Tooltip content={<ChartTooltip />} cursor={TOOLTIP_CURSOR} />
                        <Bar dataKey="windows" stackId="d" fill={SERIES[0]} name="Windows" {...SEGMENT_GAP} />
                        <Bar dataKey="mac"     stackId="d" fill={SERIES[1]} name="Mac" {...SEGMENT_GAP} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </ChartCard>
              </div>
            </section>

            {/* ── Revenue ── */}
            <section className="mt-16">
              <SectionHead eyebrow="Revenue" title="Payments and payouts" />

              <ChartCard
                title="Payments"
                series={[
                  { name: 'Monthly', color: SERIES[0] },
                  { name: 'Yearly', color: SERIES[1] },
                ]}
              >
                {!data ? <PlotSkeleton height={PLOT_HEIGHT_WIDE} /> : (
                  <ResponsiveContainer width="100%" height={PLOT_HEIGHT_WIDE}>
                    <LineChart data={data.payments.map((d) => ({ ...d, date: shortDate(d.date) }))} margin={PLOT_MARGIN}>
                      <CartesianGrid {...GRID} />
                      <XAxis dataKey="date" {...AXIS} interval="preserveStartEnd" minTickGap={26} />
                      <YAxis {...AXIS} allowDecimals={false} width={38} />
                      <Tooltip content={<ChartTooltip />} />
                      <Line type="monotone" dataKey="monthly" name="Monthly" stroke={SERIES[0]} strokeWidth={2} dot={false} activeDot={ACTIVE_DOT} />
                      <Line type="monotone" dataKey="yearly"  name="Yearly"  stroke={SERIES[1]} strokeWidth={2} dot={false} activeDot={ACTIVE_DOT} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              <div className="mt-4">
                <LedgerCard
                  title="Referral payouts"
                  caption="One row per referrer, most owed first"
                  delay={60}
                  footer={
                    data && data.referrals.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => downloadReferralsCsv(data.referrals)}
                        className="btn btn-primary btn-sm"
                      >
                        Download bank CSV
                      </button>
                    ) : undefined
                  }
                >
                  {!data ? (
                    <div className="p-5"><Skel h={120} /></div>
                  ) : data.referrals.length === 0 ? (
                    <p className="px-5 py-10 text-center text-[0.875rem] text-muted">
                      No commissions owed. Rows appear here once a referred user pays.
                    </p>
                  ) : (
                    <table className="ledger">
                      <thead>
                        <tr>
                          <th>Referrer</th>
                          <th className="num">Referrals</th>
                          <th className="num">Owed</th>
                          <th>Account</th>
                          <th>Bank</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.referrals.map((r) => (
                          <tr key={r.referrer_email}>
                            <td>
                              <span className="block font-medium text-ink">{r.referrer_name ?? <Empty />}</span>
                              <span className="mt-0.5 block text-[0.75rem] text-muted">{r.referrer_email}</span>
                            </td>
                            <td className="num text-muted">{r.referral_count}</td>
                            <td className="num">
                              <span className="figure font-semibold text-ink">
                                &#8358;{r.pending_naira.toLocaleString()}
                              </span>
                              {r.total_naira !== r.pending_naira && (
                                <span className="mt-0.5 block text-[0.75rem] text-muted">
                                  &#8358;{r.total_naira.toLocaleString()} all time
                                </span>
                              )}
                            </td>
                            <td className="font-mono text-[0.8125rem] text-muted">
                              {r.account_number ?? <Empty />}
                            </td>
                            <td>
                              <span className="block text-muted">{r.bank_name ?? <Empty />}</span>
                              {r.account_name && (
                                <span className="mt-0.5 block text-[0.75rem] text-muted/80">{r.account_name}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </LedgerCard>
              </div>
            </section>

            {/* ── People ── */}
            <section className="mt-16">
              <SectionHead eyebrow="People" title="Recent accounts" />

              <LedgerCard title="Latest signups" caption="The 50 most recent registrations">
                {!data ? (
                  <div className="p-5"><Skel h={160} /></div>
                ) : data.users.length === 0 ? (
                  <p className="px-5 py-10 text-center text-[0.875rem] text-muted">
                    No accounts yet.
                  </p>
                ) : (
                  <table className="ledger">
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th>Name</th>
                        <th>Plan</th>
                        <th>Status</th>
                        <th>Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.users.map((user) => (
                        <tr key={user.id}>
                          <td className="font-medium text-ink">{user.email}</td>
                          <td className="text-muted">{user.name ?? <Empty />}</td>
                          <td>
                            {user.plan
                              ? <Badge tone={user.plan === 'yearly' ? SERIES[1] : SERIES[0]}>{user.plan}</Badge>
                              : <Empty />}
                          </td>
                          <td>
                            {user.status
                              ? <Badge tone={user.status === 'active' ? STATUS.good : STATUS.bad}>{user.status}</Badge>
                              : <Empty />}
                          </td>
                          <td className="font-mono text-[0.8125rem] text-muted">{user.created_at.slice(0, 10)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </LedgerCard>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
