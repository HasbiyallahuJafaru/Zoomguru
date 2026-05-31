import { useState, useEffect, useCallback } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  fetchStats,
  fetchSignups,
  fetchPayments,
  fetchUsage,
  fetchDownloads,
  fetchUsers,
} from './api';
import type { DashboardData } from './types';

const COLORS = {
  blue: '#3b82f6',
  purple: '#8b5cf6',
  green: '#10b981',
  orange: '#f59e0b',
  red: '#ef4444',
  gray: '#6b7280',
};

const DAYS_OPTIONS = [7, 30, 90] as const;
type DaysOption = (typeof DAYS_OPTIONS)[number];

interface Props {
  adminKey: string;
  onLogout: () => void;
}

function StatCard({
  label,
  value,
  color,
  sub,
}: {
  label: string;
  value: number | string;
  color: string;
  sub?: string;
}) {
  return (
    <div style={{
      background: '#13131a',
      border: '1px solid #1e1e2e',
      borderRadius: 10,
      padding: '20px 24px',
      flex: 1,
      minWidth: 160,
    }}>
      <p style={{ color: '#6b6b8a', fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
        {label}
      </p>
      <p style={{ color, fontSize: 32, fontWeight: 700, lineHeight: 1 }}>{value.toLocaleString()}</p>
      {sub && <p style={{ color: '#6b6b8a', fontSize: 12, marginTop: 6 }}>{sub}</p>}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: '#13131a',
      border: '1px solid #1e1e2e',
      borderRadius: 10,
      padding: '20px 24px',
      flex: 1,
      minWidth: 0,
    }}>
      <p style={{ color: '#9090b0', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>{title}</p>
      {children}
    </div>
  );
}

function shortDate(d: string): string {
  const [, m, day] = d.split('-');
  return `${m}/${day}`;
}

export default function Dashboard({ adminKey, onLogout }: Props) {
  const [days, setDays] = useState<DaysOption>(30);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (d: DaysOption) => {
    setRefreshing(true);
    setError('');
    try {
      const [stats, signups, payments, usage, downloads, users] = await Promise.all([
        fetchStats(adminKey),
        fetchSignups(adminKey, d),
        fetchPayments(adminKey, d),
        fetchUsage(adminKey, d),
        fetchDownloads(adminKey, d),
        fetchUsers(adminKey),
      ]);
      setData({ stats, signups, payments, usage, downloads, users });
    } catch {
      setError('Failed to load data. Check backend connection.');
    } finally {
      setRefreshing(false);
    }
  }, [adminKey]);

  useEffect(() => {
    void load(days);
  }, [load, days]);

  const axisStyle = { fill: '#6b6b8a', fontSize: 11 };
  const gridStroke = '#1e1e2e';
  const tooltipStyle = { background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 8 };
  const tooltipLabel = { color: '#e8e8f0' };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', padding: '28px 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e8e8f0' }}>ZoomGuru Analytics</h1>
          <p style={{ color: '#6b6b8a', fontSize: 13, marginTop: 2 }}>alto.zoomguru.xyz</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', background: '#13131a', border: '1px solid #1e1e2e', borderRadius: 8, overflow: 'hidden' }}>
            {DAYS_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                style={{
                  padding: '6px 14px',
                  background: days === d ? '#3b82f6' : 'transparent',
                  border: 'none',
                  color: days === d ? '#fff' : '#6b6b8a',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {d}d
              </button>
            ))}
          </div>
          <button
            onClick={() => { void load(days); }}
            disabled={refreshing}
            style={{
              padding: '6px 16px',
              background: '#1e1e2e',
              border: '1px solid #2e2e3e',
              borderRadius: 8,
              color: '#9090b0',
              fontSize: 13,
              cursor: refreshing ? 'not-allowed' : 'pointer',
            }}
          >
            {refreshing ? 'Loading...' : 'Refresh'}
          </button>
          <button
            onClick={onLogout}
            style={{
              padding: '6px 16px',
              background: 'transparent',
              border: '1px solid #1e1e2e',
              borderRadius: 8,
              color: '#6b6b8a',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#1a0a0a', border: '1px solid #3b1010', borderRadius: 8, padding: '12px 16px', color: '#ef4444', fontSize: 13, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {!data && !error && (
        <div style={{ color: '#6b6b8a', fontSize: 14, textAlign: 'center', paddingTop: 80 }}>Loading dashboard...</div>
      )}

      {data && (
        <>
          {/* Stat Cards */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
            <StatCard label="Total Users" value={data.stats.total_users} color={COLORS.blue} />
            <StatCard label="Downloads" value={data.stats.total_downloads} color={COLORS.green} />
            <StatCard
              label="Active Subs"
              value={data.stats.active_subscriptions}
              color={COLORS.purple}
              sub="₦50k/mo each"
            />
            <StatCard
              label="Lifetime Subs"
              value={data.stats.lifetime_subscriptions}
              color={COLORS.orange}
              sub="₦1M one-time"
            />
            <StatCard label="AI Sessions" value={data.stats.total_ai_sessions} color={COLORS.red} />
          </div>

          {/* Charts Row 1 */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            <ChartCard title={`Signups — last ${days} days`}>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data.signups.map((d) => ({ ...d, date: shortDate(d.date) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis dataKey="date" tick={axisStyle} />
                  <YAxis tick={axisStyle} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabel} />
                  <Line type="monotone" dataKey="count" stroke={COLORS.blue} strokeWidth={2} dot={false} name="Signups" />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title={`Payments — last ${days} days`}>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data.payments.map((d) => ({ ...d, date: shortDate(d.date) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis dataKey="date" tick={axisStyle} />
                  <YAxis tick={axisStyle} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabel} />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#9090b0' }} />
                  <Line type="monotone" dataKey="monthly" stroke={COLORS.purple} strokeWidth={2} dot={false} name="Monthly" />
                  <Line type="monotone" dataKey="lifetime" stroke={COLORS.orange} strokeWidth={2} dot={false} name="Lifetime" />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Charts Row 2 */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
            <ChartCard title={`AI Usage — last ${days} days`}>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.usage.map((d) => ({ ...d, date: shortDate(d.date) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis dataKey="date" tick={axisStyle} />
                  <YAxis tick={axisStyle} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabel} />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#9090b0' }} />
                  <Bar dataKey="stream" stackId="a" fill={COLORS.blue} name="Stream" />
                  <Bar dataKey="screenshot" stackId="a" fill={COLORS.green} name="Screenshot" />
                  <Bar dataKey="transcribe" stackId="a" fill={COLORS.orange} name="Transcribe" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title={`Downloads — last ${days} days`}>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.downloads.map((d) => ({ ...d, date: shortDate(d.date) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis dataKey="date" tick={axisStyle} />
                  <YAxis tick={axisStyle} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabel} />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#9090b0' }} />
                  <Bar dataKey="windows" fill={COLORS.blue} name="Windows" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="mac" fill={COLORS.gray} name="Mac" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Users Table */}
          <div style={{
            background: '#13131a',
            border: '1px solid #1e1e2e',
            borderRadius: 10,
            overflow: 'hidden',
          }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #1e1e2e' }}>
              <p style={{ color: '#9090b0', fontSize: 13, fontWeight: 600 }}>Recent Users (last 50)</p>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#0f0f18' }}>
                    {['Email', 'Name', 'Plan', 'Status', 'Joined'].map((h) => (
                      <th key={h} style={{
                        padding: '10px 16px',
                        textAlign: 'left',
                        color: '#6b6b8a',
                        fontWeight: 500,
                        fontSize: 12,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        borderBottom: '1px solid #1e1e2e',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((user, i) => (
                    <tr
                      key={user.id}
                      style={{ background: i % 2 === 0 ? 'transparent' : '#0f0f18' }}
                    >
                      <td style={{ padding: '10px 16px', color: '#e8e8f0' }}>{user.email}</td>
                      <td style={{ padding: '10px 16px', color: '#9090b0' }}>{user.name ?? '—'}</td>
                      <td style={{ padding: '10px 16px' }}>
                        {user.plan ? (
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            background: user.plan === 'lifetime' ? '#2a1a00' : '#1a1a40',
                            color: user.plan === 'lifetime' ? COLORS.orange : COLORS.purple,
                          }}>
                            {user.plan}
                          </span>
                        ) : <span style={{ color: '#3b3b5a' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        {user.status ? (
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            background: user.status === 'active' ? '#0a2a1a' : '#1a0a0a',
                            color: user.status === 'active' ? COLORS.green : COLORS.red,
                          }}>
                            {user.status}
                          </span>
                        ) : <span style={{ color: '#3b3b5a' }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 16px', color: '#6b6b8a' }}>
                        {user.created_at.slice(0, 10)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
