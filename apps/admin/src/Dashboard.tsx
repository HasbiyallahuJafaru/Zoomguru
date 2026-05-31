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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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

function shortDate(d: string): string {
  const [, m, day] = d.split('-');
  return `${m}/${day}`;
}

const axisStyle = { fill: '#6b6b8a', fontSize: 11 };
const gridStroke = '#1e1e2e';
const tooltipStyle = {
  background: '#13131a',
  border: '1px solid #1e1e2e',
  borderRadius: 8,
  fontSize: 12,
};
const tooltipLabel = { color: '#e8e8f0' };

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

  return (
    <div className="dark min-h-screen bg-background">
      <div className="max-w-screen-2xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">ZoomGuru Analytics</h1>
            <p className="text-sm text-muted-foreground mt-0.5">zoomguru-admin.vercel.app</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Tabs value={String(days)} onValueChange={(v) => setDays(Number(v) as DaysOption)}>
              <TabsList>
                {DAYS_OPTIONS.map((d) => (
                  <TabsTrigger key={d} value={String(d)}>{d}d</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { void load(days); }}
              disabled={refreshing}
            >
              {refreshing ? 'Loading…' : 'Refresh'}
            </Button>
            <Button variant="ghost" size="sm" onClick={onLogout}>
              Logout
            </Button>
          </div>
        </div>

        <Separator />

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {!data ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-3 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16 mb-2" />
                  <Skeleton className="h-3 w-20" />
                </CardContent>
              </Card>
            ))
          ) : (
            <>
              <StatCard label="Total Users" value={data.stats.total_users} color={COLORS.blue} />
              <StatCard label="Downloads" value={data.stats.total_downloads} color={COLORS.green} />
              <StatCard label="Active Subs" value={data.stats.active_subscriptions} color={COLORS.purple} sub="₦50k/mo each" />
              <StatCard label="Lifetime Subs" value={data.stats.lifetime_subscriptions} color={COLORS.orange} sub="₦1M one-time" />
              <StatCard label="AI Sessions" value={data.stats.total_ai_sessions} color={COLORS.red} />
            </>
          )}
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Signups — last {days} days
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!data ? <Skeleton className="h-[200px] w-full" /> : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={data.signups.map((d) => ({ ...d, date: shortDate(d.date) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                    <XAxis dataKey="date" tick={axisStyle} />
                    <YAxis tick={axisStyle} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabel} />
                    <Line type="monotone" dataKey="count" stroke={COLORS.blue} strokeWidth={2} dot={false} name="Signups" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Payments — last {days} days
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!data ? <Skeleton className="h-[200px] w-full" /> : (
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
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                AI Usage — last {days} days
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!data ? <Skeleton className="h-[200px] w-full" /> : (
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
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Downloads — last {days} days
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!data ? <Skeleton className="h-[200px] w-full" /> : (
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
              )}
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">
              Recent Users{' '}
              <span className="font-normal text-muted-foreground">(last 50)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!data ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 5 }).map((_, j) => (
                          <TableCell key={j}>
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    data.users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.email}</TableCell>
                        <TableCell className="text-muted-foreground">{user.name ?? '—'}</TableCell>
                        <TableCell>
                          {user.plan ? (
                            <Badge
                              variant="outline"
                              className={
                                user.plan === 'lifetime'
                                  ? 'border-orange-500/40 bg-orange-500/10 text-orange-400'
                                  : 'border-purple-500/40 bg-purple-500/10 text-purple-400'
                              }
                            >
                              {user.plan}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.status ? (
                            <Badge
                              variant="outline"
                              className={
                                user.status === 'active'
                                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                                  : 'border-red-500/40 bg-red-500/10 text-red-400'
                              }
                            >
                              {user.status}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {user.created_at.slice(0, 10)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  sub,
}: {
  label: string;
  value: number;
  color: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold tabular-nums" style={{ color }}>
          {value.toLocaleString()}
        </p>
        {sub && <p className="text-xs text-muted-foreground mt-1.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}
