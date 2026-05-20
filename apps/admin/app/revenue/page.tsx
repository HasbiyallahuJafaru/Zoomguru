'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { AdminLayout } from '@/components/AdminLayout';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const API = process.env.NEXT_PUBLIC_API_URL!;

const PERIODS = [
  { label: 'Last 7 days', value: 7 },
  { label: 'Last 30 days', value: 30 },
  { label: 'Last 90 days', value: 90 },
  { label: 'Last 365 days', value: 365 },
];

type CurrencyMode = 'ngn' | 'usd' | 'combined';

interface KPIs {
  mrr: number;
  arr: number;
  totalRevenue: number;
  netRevenue: number;
  arpu: number;
  ltv: number;
}

interface DailyRevenue {
  date: string;
  ngn: number;
  usd: number;
  count: number;
}

interface PlanBreakdown {
  plan: string;
  currency: string;
  total: number;
  count: number;
}

interface CohortRow {
  cohort: string;
  month1: number;
  month2: number;
  month3: number;
  month6: number;
  month12?: number;
}

interface ChurnPoint {
  month: string;
  rate: number;
  count: number;
}

interface ChurnUser {
  username: string;
  plan: string;
  amount_lost: number;
  days_since_activation: number;
}

interface RevenueData {
  kpis: KPIs;
  dailyRevenue: DailyRevenue[];
  planBreakdown: PlanBreakdown[];
  cohortRetention: CohortRow[];
  churnData: ChurnPoint[];
  churnedUsers?: ChurnUser[];
}

function fmtNGN(n: number) {
  return '₦' + Number(n).toLocaleString('en-NG', { maximumFractionDigits: 0 });
}
function fmtUSD(n: number) {
  return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
}
function fmtPct(n: number) {
  return (Number(n) * 100).toFixed(1) + '%';
}

function KPICard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
      padding: '20px 24px', flex: 1, minWidth: 160,
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: '#0f172a' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function retentionColor(pct: number | null | undefined): string {
  if (pct == null) return '#f8fafc';
  const v = Number(pct);
  if (v >= 0.8) return '#dcfce7';
  if (v >= 0.5) return '#fef9c3';
  return '#fee2e2';
}
function retentionText(pct: number | null | undefined): string {
  if (pct == null) return '—';
  return fmtPct(Number(pct));
}

const CHART_COLORS = ['#4f6ef7', '#7c3aed', '#0ea5e9', '#f59e0b', '#10b981', '#ef4444'];

const AREA_GRADIENT_ID = 'revenueGrad';

export default function RevenuePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [period, setPeriod] = useState(30);
  const [currMode, setCurrMode] = useState<CurrencyMode>('ngn');
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    setLoading(true);
    setError('');
    fetch(`${API}/admin/analytics/revenue?period=${period}`, {
      headers: { Authorization: `Bearer ${(session as any)?.accessToken}` },
    })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [period, status, session]);

  if (status === 'loading' || loading) {
    return (
      <AdminLayout>
        <div style={{ padding: 40, color: '#64748b', fontSize: 14 }}>Loading revenue data…</div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div style={{ padding: 40, color: '#dc2626', fontSize: 14 }}>Error: {error}</div>
      </AdminLayout>
    );
  }

  const kpis = data?.kpis ?? { mrr: 0, arr: 0, totalRevenue: 0, netRevenue: 0, arpu: 0, ltv: 0 };
  const daily = data?.dailyRevenue ?? [];
  const planBreakdown = data?.planBreakdown ?? [];
  const cohort = data?.cohortRetention ?? [];
  const churnData = data?.churnData ?? [];
  const churnedUsers = data?.churnedUsers ?? [];

  // Area chart data based on currency toggle
  const areaData = daily.map(d => ({
    date: d.date,
    value: currMode === 'ngn' ? d.ngn : currMode === 'usd' ? d.usd * 1600 : d.ngn + d.usd * 1600,
    count: d.count,
    ngn: d.ngn,
    usd: d.usd,
  }));

  // Stacked bar: aggregate planBreakdown by date bucket (show totals per plan-currency combo)
  const planKeys = Array.from(new Set(planBreakdown.map(p => `${p.currency.toUpperCase()} ${p.plan.charAt(0).toUpperCase() + p.plan.slice(1)}`)));
  const barData = [{ name: `Last ${period}d`, ...Object.fromEntries(planBreakdown.map(p => [`${p.currency.toUpperCase()} ${p.plan.charAt(0).toUpperCase() + p.plan.slice(1)}`, p.total])) }];

  // Pie: NGN vs USD
  const ngnTotal = planBreakdown.filter(p => p.currency === 'ngn').reduce((s, p) => s + Number(p.total), 0);
  const usdTotal = planBreakdown.filter(p => p.currency === 'usd').reduce((s, p) => s + Number(p.total), 0) * 1600;
  const pieData = [
    { name: 'NGN', value: ngnTotal },
    { name: 'USD (×1600)', value: usdTotal },
  ].filter(d => d.value > 0);

  // Churn stats
  const avgChurn = churnData.length ? churnData.reduce((s, d) => s + Number(d.rate), 0) / churnData.length : 0;
  const bestMonth = churnData.length ? churnData.reduce((a, b) => Number(a.rate) < Number(b.rate) ? a : b) : null;
  const worstMonth = churnData.length ? churnData.reduce((a, b) => Number(a.rate) > Number(b.rate) ? a : b) : null;

  return (
    <AdminLayout>
      <div style={{ padding: '32px 40px', maxWidth: 1400, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', margin: 0 }}>Revenue Analytics</h1>
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Financial performance overview</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {PERIODS.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                style={{
                  padding: '7px 14px', borderRadius: 6, fontSize: 13, fontWeight: 500,
                  border: period === p.value ? '1.5px solid #4f6ef7' : '1px solid #e2e8f0',
                  background: period === p.value ? '#eef2ff' : '#fff',
                  color: period === p.value ? '#4f6ef7' : '#475569',
                  cursor: 'pointer',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* ROW 1 — KPI cards */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 28 }}>
          <KPICard label="MRR" value={fmtNGN(kpis.mrr)} sub="Monthly recurring revenue" />
          <KPICard label="ARR" value={fmtNGN(kpis.arr)} sub="Annualised run rate" />
          <KPICard label="Total Revenue" value={fmtNGN(kpis.totalRevenue)} sub="All time" />
          <KPICard label="Net Revenue" value={fmtNGN(kpis.netRevenue)} sub="After fees & commissions" />
          <KPICard label="ARPU" value={fmtNGN(kpis.arpu)} sub="Per paying user" />
          <KPICard label="LTV" value={fmtNGN(kpis.ltv)} sub="Avg lifetime value" />
        </div>

        {/* ROW 2 — Revenue over time */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '24px 28px', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 }}>Revenue Over Time</h2>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['ngn', 'usd', 'combined'] as CurrencyMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setCurrMode(m)}
                  style={{
                    padding: '5px 12px', borderRadius: 5, fontSize: 12, fontWeight: 600,
                    border: currMode === m ? '1.5px solid #4f6ef7' : '1px solid #e2e8f0',
                    background: currMode === m ? '#eef2ff' : '#f8fafc',
                    color: currMode === m ? '#4f6ef7' : '#64748b',
                    cursor: 'pointer', textTransform: 'uppercase',
                  }}
                >
                  {m === 'combined' ? 'Combined' : m.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={areaData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={AREA_GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f6ef7" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#4f6ef7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={v => '₦' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v)} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                formatter={(value: number, name: string) => [fmtNGN(value), 'Revenue']}
                labelFormatter={(label, payload) => {
                  const count = payload?.[0]?.payload?.count ?? 0;
                  return `${label}  (${count} transactions)`;
                }}
              />
              <Area type="monotone" dataKey="value" stroke="#4f6ef7" strokeWidth={2} fill={`url(#${AREA_GRADIENT_ID})`} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* ROW 3 — Bar + Pie */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
          {/* Bar: Revenue by plan */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '24px 28px' }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 20px' }}>Revenue by Plan</h2>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={barData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={v => '₦' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v)} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} formatter={(v: number) => fmtNGN(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {planKeys.map((key, i) => (
                  <Bar key={key} dataKey={key} stackId="a" fill={CHART_COLORS[i % CHART_COLORS.length]} radius={i === planKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pie: NGN vs USD split */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '24px 28px' }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 20px' }}>NGN vs USD Split</h2>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260 }}>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={pieData} cx="50%" cy="50%"
                    innerRadius={75} outerRadius={110}
                    paddingAngle={3} dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmtNGN(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center', pointerEvents: 'none',
              }}>
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>TOTAL</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{fmtNGN(ngnTotal + usdTotal)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ROW 4 — Cohort retention table */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '24px 28px', marginBottom: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>Cohort Retention</h2>
          <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 16px' }}>Monthly subscribers who are still active — % retained per cohort month</p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={{ textAlign: 'left', padding: '10px 14px', color: '#64748b', fontWeight: 600, fontSize: 12, borderBottom: '1px solid #e2e8f0' }}>Cohort</th>
                  {['Month 1', 'Month 2', 'Month 3', 'Month 6', 'Month 12'].map(m => (
                    <th key={m} style={{ textAlign: 'center', padding: '10px 14px', color: '#64748b', fontWeight: 600, fontSize: 12, borderBottom: '1px solid #e2e8f0' }}>{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cohort.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: '#94a3b8', fontSize: 13 }}>No cohort data yet</td>
                  </tr>
                ) : cohort.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a' }}>{row.cohort}</td>
                    {[row.month1, row.month2, row.month3, row.month6, row.month12].map((v, ci) => (
                      <td key={ci} style={{ padding: '10px 14px', textAlign: 'center', background: retentionColor(v), fontWeight: 600, color: '#374151' }}>
                        {retentionText(v)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ROW 5 — Churn analysis */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '24px 28px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 16px' }}>Churn Analysis</h2>

          {/* Churn stats row */}
          <div style={{ display: 'flex', gap: 20, marginBottom: 24 }}>
            {[
              { label: 'Avg Churn Rate', value: fmtPct(avgChurn) },
              { label: 'Best Month', value: bestMonth ? `${bestMonth.month} (${fmtPct(Number(bestMonth.rate))})` : '—' },
              { label: 'Worst Month', value: worstMonth ? `${worstMonth.month} (${fmtPct(Number(worstMonth.rate))})` : '—' },
            ].map(s => (
              <div key={s.label} style={{
                flex: 1, background: '#f8fafc', borderRadius: 8, padding: '14px 18px',
                border: '1px solid #e2e8f0',
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Churn line chart */}
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={churnData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={v => fmtPct(v)} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} formatter={(v: number) => [fmtPct(v), 'Churn rate']} />
              <Line type="monotone" dataKey="rate" stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: '#ef4444' }} />
            </LineChart>
          </ResponsiveContainer>

          {/* Churned users table */}
          {churnedUsers.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '0 0 12px' }}>Cancelled this month</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Username', 'Plan', 'Amount Lost', 'Days Since Activation'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '9px 14px', color: '#64748b', fontWeight: 600, fontSize: 12, borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {churnedUsers.map((u, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '9px 14px', color: '#0f172a', fontWeight: 500 }}>@{u.username}</td>
                      <td style={{ padding: '9px 14px', color: '#475569', textTransform: 'capitalize' }}>{u.plan}</td>
                      <td style={{ padding: '9px 14px', color: '#dc2626', fontWeight: 600 }}>{fmtNGN(u.amount_lost)}</td>
                      <td style={{ padding: '9px 14px', color: '#64748b' }}>{u.days_since_activation}d</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </AdminLayout>
  );
}
