import { useState, useEffect, type CSSProperties } from 'react';

type ElectronStyle = CSSProperties & { WebkitAppRegion?: 'drag' | 'no-drag' };

interface ReferralProps {
  onBack: () => void;
}

interface Bank {
  code: string;
  name: string;
}

interface DashboardData {
  referralCode: string | null;
  thisMonthCount: number;
  allTimeCount: number;
  pendingCommissionKobo: number;
  bank: { accountNumber: string; bankName: string; accountName: string } | null;
}

type View = 'dashboard' | 'add-bank';

const API_URL = import.meta.env.VITE_API_URL || 'https://zoomguru.onrender.com';
const SANS  = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
const SERIF = "'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif";

function koboToNaira(kobo: number): string {
  return '₦' + (kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 0 });
}

async function authFetch(path: string, token: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });
}

export default function Referral({ onBack }: ReferralProps) {
  const [view, setView] = useState<View>('dashboard');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loadingDash, setLoadingDash] = useState(true);
  const [copied, setCopied] = useState(false);
  const [payoutMsg, setPayoutMsg] = useState('');
  const [payoutLoading, setPayoutLoading] = useState(false);

  // bank form
  const [banks, setBanks] = useState<Bank[]>([]);
  const [selectedBankCode, setSelectedBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [verifiedName, setVerifiedName] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function loadDashboard(): Promise<void> {
    setLoadingDash(true);
    try {
      const token = await window.zoomguru.getToken();
      const res = await authFetch('/referral/dashboard', token);
      if (res.ok) {
        const data = (await res.json()) as DashboardData;
        setDashboard(data);
      }
    } finally {
      setLoadingDash(false);
    }
  }

  async function loadBanks(): Promise<void> {
    if (banks.length > 0) return;
    try {
      const token = await window.zoomguru.getToken();
      const res = await authFetch('/referral/banks', token);
      if (res.ok) {
        const data = (await res.json()) as { code: string; name: string }[];
        setBanks(data);
      }
    } catch {
      // non-fatal
    }
  }

  function handleOpenAddBank(): void {
    setVerifiedName('');
    setVerifyError('');
    setAccountNumber('');
    setSelectedBankCode('');
    setView('add-bank');
    void loadBanks();
  }

  async function handleVerify(): Promise<void> {
    if (!/^\d{10}$/.test(accountNumber)) {
      setVerifyError('Account number must be exactly 10 digits');
      return;
    }
    if (!selectedBankCode) {
      setVerifyError('Please select a bank');
      return;
    }
    setVerifyError('');
    setVerifiedName('');
    setVerifying(true);
    try {
      const token = await window.zoomguru.getToken();
      const res = await authFetch('/referral/bank/verify', token, {
        method: 'POST',
        body: JSON.stringify({ accountNumber, bankCode: selectedBankCode }),
      });
      const data = (await res.json()) as { accountName?: string; message?: string };
      if (!res.ok) {
        setVerifyError(data.message ?? 'Could not verify account');
      } else {
        setVerifiedName(data.accountName ?? '');
      }
    } catch {
      setVerifyError('Network error. Please try again.');
    } finally {
      setVerifying(false);
    }
  }

  async function handleSaveBank(): Promise<void> {
    if (!verifiedName || !selectedBankCode) return;
    const bankName = banks.find((b) => b.code === selectedBankCode)?.name ?? selectedBankCode;
    setSaving(true);
    try {
      const token = await window.zoomguru.getToken();
      const res = await authFetch('/referral/bank/save', token, {
        method: 'POST',
        body: JSON.stringify({
          accountNumber,
          bankCode: selectedBankCode,
          bankName,
          accountName: verifiedName,
        }),
      });
      if (res.ok) {
        await loadDashboard();
        setView('dashboard');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleRequestPayout(): Promise<void> {
    setPayoutMsg('');
    setPayoutLoading(true);
    try {
      const token = await window.zoomguru.getToken();
      const res = await authFetch('/referral/payout/request', token, { method: 'POST' });
      const data = (await res.json()) as { message?: string };
      setPayoutMsg(data.message ?? (res.ok ? 'Request submitted.' : 'Something went wrong.'));
      if (res.ok) await loadDashboard();
    } finally {
      setPayoutLoading(false);
    }
  }

  function handleCopy(): void {
    if (!dashboard?.referralCode) return;
    void navigator.clipboard.writeText(dashboard.referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loadingDash) {
    return (
      <div style={s.root}>
        <div style={s.loading}>Loading…</div>
      </div>
    );
  }

  if (view === 'add-bank') {
    return (
      <div style={s.root}>
        <div style={s.header}>
          <button style={s.backBtn} onClick={() => setView('dashboard')}>← Back</button>
          <span style={s.headerTitle}>Bank Account</span>
        </div>
        <div style={s.body}>
          <p style={s.sectionLabel}>Add your bank account to receive payouts</p>

          <div style={s.field}>
            <label style={s.label}>Bank</label>
            <select
              style={s.select}
              value={selectedBankCode}
              onChange={(e) => { setSelectedBankCode(e.target.value); setVerifiedName(''); setVerifyError(''); }}
            >
              <option value="" style={{ background: '#1a1a2e', color: '#ffffff' }}>Select a bank…</option>
              {banks.map((b) => (
                <option key={b.code} value={b.code} style={{ background: '#1a1a2e', color: '#ffffff' }}>{b.name}</option>
              ))}
            </select>
          </div>

          <div style={s.field}>
            <label style={s.label}>Account Number</label>
            <input
              style={s.input}
              type="text"
              inputMode="numeric"
              maxLength={10}
              placeholder="10-digit account number"
              value={accountNumber}
              onChange={(e) => { setAccountNumber(e.target.value.replace(/\D/g, '')); setVerifiedName(''); setVerifyError(''); }}
            />
          </div>

          {verifyError && <p style={s.errorText}>{verifyError}</p>}

          {verifiedName ? (
            <>
              <div style={s.verifiedBox}>
                <span style={s.verifiedCheck}>✓</span>
                <span style={s.verifiedName}>{verifiedName}</span>
              </div>
              <button
                style={s.primaryBtn}
                onClick={() => { void handleSaveBank(); }}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save Bank Account'}
              </button>
            </>
          ) : (
            <button
              style={s.primaryBtn}
              onClick={() => { void handleVerify(); }}
              disabled={verifying || !accountNumber || !selectedBankCode}
            >
              {verifying ? 'Verifying…' : 'Verify Account'}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={s.root}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={onBack}>← Back</button>
        <span style={s.headerTitle}>Refer & Earn</span>
      </div>

      <div style={s.body}>
        {/* Referral code */}
        <div style={s.codeCard}>
          <p style={s.codeLabel}>Your referral code</p>
          <div style={s.codeRow}>
            <span style={s.code}>{dashboard?.referralCode ?? '—'}</span>
            {dashboard?.referralCode && (
              <button style={s.copyBtn} onClick={handleCopy}>
                {copied ? 'Copied!' : 'Copy'}
              </button>
            )}
          </div>
          <p style={s.codeHint}>Share this code. Earn 10% of each referred user's first payment.</p>
        </div>

        {/* Stats */}
        <div style={s.statsRow}>
          <div style={s.statBox}>
            <span style={s.statNum}>{dashboard?.thisMonthCount ?? 0}</span>
            <span style={s.statLbl}>This month</span>
          </div>
          <div style={s.statBox}>
            <span style={s.statNum}>{dashboard?.allTimeCount ?? 0}</span>
            <span style={s.statLbl}>All time</span>
          </div>
          <div style={s.statBox}>
            <span style={s.statNum}>{koboToNaira(dashboard?.pendingCommissionKobo ?? 0)}</span>
            <span style={s.statLbl}>Pending</span>
          </div>
        </div>

        {/* Bank account */}
        <div style={s.bankSection}>
          <p style={s.sectionLabel}>Payout account</p>
          {dashboard?.bank ? (
            <div style={s.bankCard}>
              <p style={s.bankName}>{dashboard.bank.bankName}</p>
              <p style={s.bankDetail}>{dashboard.bank.accountName}</p>
              <p style={s.bankDetail}>{dashboard.bank.accountNumber}</p>
              <button style={s.ghostBtn} onClick={handleOpenAddBank}>Change</button>
            </div>
          ) : (
            <button style={s.primaryBtn} onClick={handleOpenAddBank}>Add Bank Account</button>
          )}
        </div>

        {/* Payout request */}
        {(dashboard?.pendingCommissionKobo ?? 0) > 0 && dashboard?.bank && (
          <div style={s.payoutSection}>
            {payoutMsg ? (
              <p style={s.payoutMsg}>{payoutMsg}</p>
            ) : (
              <button
                style={s.primaryBtn}
                onClick={() => { void handleRequestPayout(); }}
                disabled={payoutLoading}
              >
                {payoutLoading ? 'Requesting…' : `Request Payout — ${koboToNaira(dashboard.pendingCommissionKobo)}`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const s: Record<string, ElectronStyle> = {
  root: {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: 'rgba(7, 7, 11, 0.97)',
    borderRadius: '16px',
    fontFamily: SANS,
    overflow: 'hidden',
  },
  loading: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgba(255,255,255,0.28)',
    fontSize: '13px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '14px 16px 12px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    WebkitAppRegion: 'drag',
  },
  headerTitle: {
    fontSize: '13px',
    fontWeight: 500,
    fontFamily: SERIF,
    fontStyle: 'italic',
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: '0.1px',
  },
  backBtn: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.35)',
    fontSize: '11px',
    cursor: 'pointer',
    padding: '2px 0',
    fontFamily: SANS,
    WebkitAppRegion: 'no-drag',
    transition: 'color 120ms',
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    WebkitAppRegion: 'no-drag',
  },
  codeCard: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    padding: '14px',
  },
  codeLabel: {
    margin: '0 0 8px',
    fontSize: '10px',
    color: 'rgba(255,255,255,0.30)',
    textTransform: 'uppercase',
    letterSpacing: '0.10em',
  },
  codeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '8px',
  },
  code: {
    fontSize: '20px',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.90)',
    letterSpacing: '0.18em',
    fontFamily: "'DM Mono', monospace",
  },
  copyBtn: {
    background: 'rgba(255,255,255,0.08)',
    border: 'none',
    borderRadius: '4px',
    color: 'rgba(255,255,255,0.55)',
    fontSize: '11px',
    cursor: 'pointer',
    padding: '4px 10px',
    fontFamily: SANS,
    transition: 'background 120ms',
  },
  codeHint: {
    margin: 0,
    fontSize: '11px',
    color: 'rgba(255,255,255,0.25)',
    lineHeight: 1.5,
  },
  statsRow: {
    display: 'flex',
    gap: '10px',
  },
  statBox: {
    flex: 1,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '7px',
    padding: '12px 10px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  statNum: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.88)',
  },
  statLbl: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.28)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  bankSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  sectionLabel: {
    margin: 0,
    fontSize: '10px',
    color: 'rgba(255,255,255,0.30)',
    textTransform: 'uppercase',
    letterSpacing: '0.10em',
  },
  bankCard: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '7px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  bankName: {
    margin: 0,
    fontSize: '12px',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.80)',
  },
  bankDetail: {
    margin: 0,
    fontSize: '11px',
    color: 'rgba(255,255,255,0.40)',
  },
  primaryBtn: {
    width: '100%',
    padding: '11px',
    background: 'rgba(255,255,255,0.92)',
    border: 'none',
    borderRadius: '6px',
    color: '#07070b',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: SANS,
    transition: 'opacity 120ms',
  },
  ghostBtn: {
    alignSelf: 'flex-start',
    marginTop: '4px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '4px',
    color: 'rgba(255,255,255,0.40)',
    fontSize: '11px',
    cursor: 'pointer',
    padding: '4px 10px',
    fontFamily: SANS,
  },
  payoutSection: {
    marginTop: '4px',
  },
  payoutMsg: {
    margin: 0,
    fontSize: '12px',
    color: 'rgba(109,255,159,0.85)',
    textAlign: 'center',
    padding: '10px',
  },
  errorText: {
    margin: 0,
    fontSize: '11px',
    color: '#f43f5e',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.30)',
    textTransform: 'uppercase',
    letterSpacing: '0.10em',
  },
  input: {
    width: '100%',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '6px',
    color: 'rgba(255,255,255,0.88)',
    fontSize: '14px',
    padding: '10px 12px',
    outline: 'none',
    fontFamily: SANS,
    boxSizing: 'border-box' as const,
  },
  select: {
    width: '100%',
    background: '#1a1a2e',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '6px',
    color: '#ffffff',
    fontSize: '13px',
    padding: '10px 12px',
    outline: 'none',
    fontFamily: SANS,
    boxSizing: 'border-box' as const,
  },
  verifiedBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(109,255,159,0.08)',
    border: '1px solid rgba(109,255,159,0.20)',
    borderRadius: '6px',
    padding: '10px 12px',
  },
  verifiedCheck: {
    fontSize: '14px',
    color: 'rgba(109,255,159,0.85)',
  },
  verifiedName: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.85)',
  },
};
