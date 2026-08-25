// Source of truth — keep in sync with apps/backend/src/admin/admin.service.ts
export interface StatsResult {
  total_users: number;
  total_downloads: number;
  active_subscriptions: number;
  yearly_subscriptions: number;
  total_ai_sessions: number;
}

export interface DailyCount {
  date: string;
  count: number;
}

export interface DailyPayments {
  date: string;
  monthly: number;
  yearly: number;
}

export interface DailyUsage {
  date: string;
  stream: number;
  screenshot: number;
  transcribe: number;
}

export interface DailyApiUsage {
  date: string;
  gemini: number;
  deepseek: number;
  groq: number;
  openai: number;
  lemonfox: number;
  other: number;
}

export interface ApiHealthRow {
  provider: string;
  calls30d: number;
  callsToday: number;
  billingFailures30d: number;
  billingFailuresToday: number;
  balanceUsd: string | null;
  balanceNote: string;
}

export interface DailyDownloads {
  date: string;
  windows: number;
  mac: number;
}

export interface UserRow {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
  plan: string | null;
  status: string | null;
}

export interface ReferralCommissionRow {
  referrer_email: string;
  referrer_name: string | null;
  referral_count: number;
  total_naira: number;
  pending_naira: number;
  account_name: string | null;
  account_number: string | null;
  bank_name: string | null;
  bank_code: string | null;
}

export interface DashboardData {
  stats: StatsResult;
  signups: DailyCount[];
  payments: DailyPayments[];
  usage: DailyUsage[];
  apiUsage: DailyApiUsage[];
  apiHealth: ApiHealthRow[];
  downloads: DailyDownloads[];
  users: UserRow[];
  referrals: ReferralCommissionRow[];
}

export type BroadcastStatus = 'scheduled' | 'sending' | 'sent' | 'failed' | 'cancelled';

export interface TargetFilter {
  plans?: Array<'weekly' | 'monthly' | 'yearly'>;
}

export interface BroadcastRow {
  id: string;
  subject: string;
  body: string;
  target_filter: TargetFilter;
  status: BroadcastStatus;
  scheduled_at: string;
  sent_at: string | null;
  recipient_count: number | null;
  open_count: number;
  created_at: string;
}

export interface CreateBroadcastPayload {
  subject: string;
  body: string;
  targetFilter?: TargetFilter;
  scheduledAt?: string;
}

export interface BroadcastCreatedRow extends BroadcastRow {
  estimatedMinutes: number;
}
