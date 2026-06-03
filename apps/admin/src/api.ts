import type {
  StatsResult,
  DailyCount,
  DailyPayments,
  DailyUsage,
  DailyDownloads,
  UserRow,
  ReferralCommissionRow,
} from './types';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'https://zoomguru.onrender.com';

async function get<T>(path: string, adminKey: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'x-admin-key': adminKey },
  });
  if (!res.ok) {
    throw new Error(`${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function fetchStats(key: string): Promise<StatsResult> {
  return get<StatsResult>('/admin/stats', key);
}

export function fetchSignups(key: string, days: number): Promise<DailyCount[]> {
  return get<DailyCount[]>(`/admin/signups?days=${days}`, key);
}

export function fetchPayments(key: string, days: number): Promise<DailyPayments[]> {
  return get<DailyPayments[]>(`/admin/payments?days=${days}`, key);
}

export function fetchUsage(key: string, days: number): Promise<DailyUsage[]> {
  return get<DailyUsage[]>(`/admin/usage?days=${days}`, key);
}

export function fetchDownloads(key: string, days: number): Promise<DailyDownloads[]> {
  return get<DailyDownloads[]>(`/admin/downloads?days=${days}`, key);
}

export function fetchUsers(key: string): Promise<UserRow[]> {
  return get<UserRow[]>('/admin/users', key);
}

export function fetchReferrals(key: string): Promise<ReferralCommissionRow[]> {
  return get<ReferralCommissionRow[]>('/admin/referrals', key);
}
