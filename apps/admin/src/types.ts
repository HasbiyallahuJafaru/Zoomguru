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

export interface DashboardData {
  stats: StatsResult;
  signups: DailyCount[];
  payments: DailyPayments[];
  usage: DailyUsage[];
  downloads: DailyDownloads[];
  users: UserRow[];
}
