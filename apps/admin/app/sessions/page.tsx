'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { AdminLayout } from '@/components/AdminLayout';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const API = process.env.NEXT_PUBLIC_API_URL!;

const PERIODS = [
  { label: 'Last 7 days', value: 7 },
  { label: 'Last 30 days', value: 30 },
  { label: 'Last 90 days', value: 90 },
];

const TYPE_COLORS: Record<string, string> = {
  behavioral:   '#4f6ef7',
  technical:    '#10b981',
  coding:       '#7c3aed',
  systemdesign: '#f59e0b',
  general:      '#64748b',
};

const TYPE_LABELS: Record<string, string> = {
  behavioral:   'Behavioral',
  technical:    'Technical',
  coding:       'Coding',
  systemdesign: 'System Design',
  general:      'General',
};

const PIE_COLORS = ['#4f6ef7', '#10b981', '#7c3aed', '#f59e0b', '#64748b', '#0ea5e9', '#ef4444'];

interface KPIs {
  total: number;
  dailyAvg: number;
  avgDuration: number;
  avgQuestions: number;
  screenshotPct: number;
  topType: string;
}

interface DayRow {
  date: string;
  behavioral: number;
  technical: number;
  coding: number;
  systemdesign: number;
  general: number;
  total: number;
}

interface TypeRow { type: string; count: number; pct: number }
interface HourRow { hour: number; avg_sessions: number; count: number }
interface PlatformRow { platform: string; count: number }
interface SessionRow {
  id: string; username: string; type: string;
  duration: number; questions: number; summary: string | null; date: string;
}

interface SessionData {
  kpis: KPIs;
  dailySessions: DayRow[];
  typeBreakdown: TypeRow[];
  hourlyUsage: HourRow[];
  platformSplit: PlatformRow[];
  recentSessions: SessionRow[];
}

function fmtDuration(s: number) {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
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

function TypeBadge({ type }: { type: string }) {
  const color = TYPE_COLORS[type] ?? '#64748b';
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
      background: color + '18', color,
    }}>
      {TYPE_LABELS[type] ?? type}
    </span>
  );
}

export default function SessionsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [period, setPeriod] = useState(30);
  const [data, setData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    setLoading(true);
    setError('');
    fetch(`${API}/admin/analytics/sessions?period=${period}`, {
      headers: { Authorization: `Bearer ${(session as any)?.accessToken}` },
    })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [period, status, session]);

  if (status === 'loading' || loading) {
    return <AdminLayout><div style={{ padding: 40, color: '#64748b', fontSize: 14 }}>Loading session data…</div></AdminLayout>;
  }
  if (error) {
    return <AdminLayout><div style={{ padding: 40, color: '#dc2626', fontSize: 14 }}>Error: {error}</div></AdminLayout>;
  }

  const kpis = data?.kpis ?? { total: 0, dailyAvg: 0, avgDuration: 0, avgQuestions: 0, screenshotPct: 0, topType: 'general' };
  const daily = data?.dailySessions ?? [];
  const types = data?.typeBreakdown ?? [];
  const hourly = data?.hourlyUsage ?? [];
  const platforms = data?.platformSplit ?? [];
  const recent = data?.recentSessions ?? [];

  // Fill in all 24 hours for the chart
  const hourlyFull = Array.from({ length: 24 }, (_, h) => {
    const found = hourly.find(r => Number(r.hour) === h);
    return { hour: h, avg_sessions: found ? Number(found.avg_sessions) : 0 };
  });
  const topHours = [...hourlyFull].sort((a, b) => b.avg_sessions - a.avg_sessions).slice(0, 3).map(r => r.hour);

  const stacked = ['behavioral', 'technical', 'coding', 'systemdesign', 'general'];

  return (
    <AdminLayout>
      <div style={{ padding: '32px 40px', maxWidth: 1400, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', margin: 0 }}>Session Analytics</h1>
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Interview session activity and patterns</p>
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
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 24 }}>
          <KPICard label="Total Sessions" value={kpis.total.toLocaleString()} sub={`Last ${period} days`} />
          <KPICard label="Daily Average" value={kpis.dailyAvg.toString()} sub="Sessions per day" />
          <KPICard label="Avg Duration" value={fmtDuration(kpis.avgDuration)} />
          <KPICard label="Avg Questions" value={kpis.avgQuestions.toString()} sub="Per session" />
          <KPICard label="Screenshot Mode" value={`${kpis.screenshotPct}%`} sub="Of all sessions" />
          <KPICard label="Listen-only" value={`${(100 - kpis.screenshotPct).toFixed(1)}%`} sub="Of all sessions" />
          <KPICard label="Top Interview Type" value={TYPE_LABELS[kpis.topType] ?? kpis.topType} />
        </div>

        {/* ROW 2 — Sessions over time stacked bar */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '24px 28px', marginBottom: 22 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 18px' }}>Sessions Over Time</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={daily} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} formatter={(value) => TYPE_LABELS[value] ?? value} />
              {stacked.map((key, i) => (
                <Bar key={key} dataKey={key} stackId="a" fill={TYPE_COLORS[key]} name={key}
                  radius={i === stacked.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ROW 3 — Pie + Hourly */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 22 }}>
          {/* Pie: interview type */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '24px 28px' }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 18px' }}>Interview Type Breakdown</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <ResponsiveContainer width={200} height={200}>
                <PieChart>
                  <Pie data={types} dataKey="count" cx="50%" cy="50%"
                    innerRadius={55} outerRadius={88} paddingAngle={2}>
                    {types.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => [v, 'sessions']} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {types.map((t, i) => (
                  <div key={t.type} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: '#374151', flex: 1 }}>{TYPE_LABELS[t.type] ?? t.type}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{t.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bar: peak usage hours */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '24px 28px' }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>Peak Usage Hours</h2>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 14px' }}>Avg sessions per hour of day</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={hourlyFull} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                  tickFormatter={h => `${h}:00`} interval={2} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  formatter={(v: number) => [v, 'avg sessions']}
                  labelFormatter={h => `${h}:00`} />
                <Bar dataKey="avg_sessions" radius={[3, 3, 0, 0]}>
                  {hourlyFull.map((entry, i) => (
                    <Cell key={i} fill={topHours.includes(entry.hour) ? '#4f6ef7' : '#cbd5e1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ROW 4 — Platform breakdown */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '24px 28px', marginBottom: 22 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>Platform Breakdown</h2>
          {platforms.length === 0 ? (
            <p style={{ fontSize: 13, color: '#94a3b8', margin: '12px 0 0' }}>
              Platform data not yet tracked — add a <code style={{ fontSize: 12, background: '#f1f5f9', padding: '1px 5px', borderRadius: 3 }}>platform</code> column to <code style={{ fontSize: 12, background: '#f1f5f9', padding: '1px 5px', borderRadius: 3 }}>interview_sessions</code> to enable this view.
            </p>
          ) : (
            <div style={{ display: 'flex', gap: 24, alignItems: 'center', marginTop: 16 }}>
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie data={platforms} dataKey="count" cx="50%" cy="50%"
                    innerRadius={50} outerRadius={80} paddingAngle={3}>
                    {platforms.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {platforms.map((p, i) => (
                  <div key={p.platform} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span style={{ fontSize: 13, color: '#374151', minWidth: 80 }}>{p.platform}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{Number(p.count).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ROW 5 — Recent sessions table */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '24px 28px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 16px' }}>Recent Sessions</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['User', 'Type', 'Duration', 'Questions', 'Date', ''].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '10px 14px', color: '#64748b',
                    fontWeight: 600, fontSize: 12, borderBottom: '1px solid #e2e8f0',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>No sessions in this period</td>
                </tr>
              ) : recent.map(s => (
                <>
                  <tr
                    key={s.id}
                    style={{ borderBottom: expandedId === s.id ? 'none' : '1px solid #f1f5f9', cursor: s.summary ? 'pointer' : 'default' }}
                    onClick={() => s.summary && setExpandedId(expandedId === s.id ? null : s.id)}
                  >
                    <td style={{ padding: '10px 14px', fontWeight: 500, color: '#0f172a' }}>@{s.username}</td>
                    <td style={{ padding: '10px 14px' }}><TypeBadge type={s.type} /></td>
                    <td style={{ padding: '10px 14px', color: '#475569' }}>{fmtDuration(s.duration)}</td>
                    <td style={{ padding: '10px 14px', color: '#475569' }}>{s.questions}</td>
                    <td style={{ padding: '10px 14px', color: '#64748b', whiteSpace: 'nowrap' }}>{fmtDate(s.date)}</td>
                    <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: 12 }}>
                      {s.summary ? (expandedId === s.id ? '▲ hide' : '▼ summary') : ''}
                    </td>
                  </tr>
                  {expandedId === s.id && s.summary && (
                    <tr key={s.id + '-exp'} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td colSpan={6} style={{ padding: '0 14px 14px 14px' }}>
                        <div style={{
                          background: '#f8fafc', borderRadius: 8, padding: '12px 14px',
                          fontSize: 13, color: '#374151', lineHeight: 1.6, border: '1px solid #e2e8f0',
                        }}>
                          {s.summary}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </AdminLayout>
  );
}
