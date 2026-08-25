import type {
  StatsResult,
  DailyCount,
  DailyPayments,
  DailyUsage,
  DailyApiUsage,
  ApiHealthRow,
  DailyDownloads,
  UserRow,
  ReferralCommissionRow,
  BroadcastRow,
  BroadcastCreatedRow,
  CreateBroadcastPayload,
  TargetFilter,
} from './types';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'https://zoomguru-backend-production.up.railway.app';
const adminKey = (import.meta.env.VITE_ADMIN_KEY as string | undefined) ?? '';
if (!adminKey?.trim()) {
  console.error('[ZoomGuru Admin] VITE_ADMIN_KEY is not set. All API requests will fail.');
}

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

export function fetchApiUsage(key: string, days: number): Promise<DailyApiUsage[]> {
  return get<DailyApiUsage[]>(`/admin/api-usage?days=${days}`, key);
}

export function fetchApiHealth(key: string): Promise<ApiHealthRow[]> {
  return get<ApiHealthRow[]>('/admin/api-health', key);
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

// ── Broadcast ──────────────────────────────────────────────────────────

async function post<T>(path: string, adminKey: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'x-admin-key': adminKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(data.message ?? String(res.status));
  }
  return res.json() as Promise<T>;
}

async function del<T>(path: string, adminKey: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'DELETE',
    headers: { 'x-admin-key': adminKey },
  });
  if (!res.ok) throw new Error(String(res.status));
  return res.json() as Promise<T>;
}

export function fetchBroadcasts(key: string): Promise<BroadcastRow[]> {
  return get<BroadcastRow[]>('/admin/broadcast', key);
}

export function fetchRecipientCount(
  key: string,
  targetFilter: TargetFilter,
): Promise<{ count: number; estimatedMinutes: number }> {
  return post('/admin/broadcast/recipients', key, { targetFilter });
}

export function fetchBroadcastPreview(key: string, body: string): Promise<{ html: string }> {
  return post('/admin/broadcast/preview', key, { body });
}

export function createBroadcast(
  key: string,
  payload: CreateBroadcastPayload,
): Promise<BroadcastCreatedRow> {
  return post('/admin/broadcast', key, payload);
}

export function cancelBroadcast(key: string, id: string): Promise<{ ok: true }> {
  return del(`/admin/broadcast/${id}`, key);
}

export function retryBroadcast(key: string, id: string): Promise<BroadcastRow> {
  return post(`/admin/broadcast/${id}/retry`, key, {});
}
