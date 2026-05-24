'use client';
import { useSession } from 'next-auth/react';
import { useEffect, useState, useCallback } from 'react';

interface ReferralData {
  referralCode: string;
  totalReferred: number;
  converted: number;
  totalEarned: number;
  pendingBalance: number;
  currency: string;
  referrals: {
    id: string;
    referred_email: string;
    plan: string;
    commission_amount: number;
    status: string;
    created_at: string;
  }[];
  payoutHistory: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    requested_at: string;
    processed_at: string | null;
  }[];
}

const MIN_PAYOUT = 1000;

export default function ReferralsPage() {
  const { data: session } = useSession();
  const user = session?.user as any;

  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [banks, setBanks] = useState<{ id: number; name: string; code: string }[]>([]);
  const [payoutForm, setPayoutForm] = useState({ bankCode: '', bankName: '', accountNumber: '', accountName: '', amount: '' });
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutMsg, setPayoutMsg] = useState('');

  const referralLink = data ? `https://zoomguru.xyz?ref=${data.referralCode}` : '';

  const fetchData = useCallback(async () => {
    if (!session) return;
    const res = await fetch('/api/proxy/referral/stats');
    if (res.ok) {
      const raw = await res.json();
      // Normalize backend shape { referralCode, balance: {...}, referrals: [...] }
      // into the flat shape this page expects
      setData({
        referralCode: raw.referralCode ?? '',
        totalReferred: raw.referrals?.length ?? 0,
        converted: raw.referrals?.filter((r: any) => r.status === 'earned' || r.status === 'paid').length ?? 0,
        totalEarned: raw.balance?.total_earned ?? 0,
        pendingBalance: raw.balance?.pending_balance ?? 0,
        currency: raw.balance?.currency ?? 'NGN',
        referrals: (raw.referrals ?? []).map((r: any, i: number) => ({
          id: String(i),
          referred_email: r.referred_email,
          plan: r.currency ?? 'NGN',
          commission_amount: r.commission_amount,
          status: r.status,
          created_at: r.created_at,
        })),
        payoutHistory: [],
      });
    }
    setLoading(false);
  }, [session]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!session) return;
    fetch('/api/proxy/referral/banks')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setBanks(d); });
  }, [session]);

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  function shareTwitter() {
    const text = encodeURIComponent(`I use ZoomGuru to nail my interviews — AI that's invisible to screen share. Try it: ${referralLink}`);
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
  }

  function shareWhatsApp() {
    const text = encodeURIComponent(`Check out ZoomGuru — invisible AI interview copilot: ${referralLink}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  }

  async function verifyAccount() {
    if (!session || !payoutForm.bankCode || payoutForm.accountNumber.length !== 10) return;
    setVerifying(true);
    setVerifyError('');
    setVerified(false);
    setPayoutForm(f => ({ ...f, accountName: '' }));

    const res = await fetch('/api/proxy/referral/verify-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountNumber: payoutForm.accountNumber, bankCode: payoutForm.bankCode }),
    });
    const result = await res.json();
    setVerifying(false);

    if (res.ok) {
      setPayoutForm(f => ({ ...f, accountName: result.accountName }));
      setVerified(true);
    } else {
      setVerifyError(result.message || 'Account could not be verified.');
    }
  }

  async function requestPayout(e: React.FormEvent) {
    e.preventDefault();
    if (!session || !verified) return;
    setPayoutLoading(true);
    setPayoutMsg('');
    const res = await fetch('/api/proxy/referral/payout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bankName: payoutForm.bankName,
        bankCode: payoutForm.bankCode,
        accountNumber: payoutForm.accountNumber,
        accountName: payoutForm.accountName,
        amount: parseFloat(payoutForm.amount),
        currency: data?.currency || 'NGN',
      }),
    });
    const result = await res.json();
    setPayoutLoading(false);
    if (res.ok) {
      setPayoutMsg('Payout request submitted! We\'ll process within 3 business days.');
      setPayoutForm({ bankCode: '', bankName: '', accountNumber: '', accountName: '', amount: '' });
      setVerified(false);
      fetchData();
    } else {
      setPayoutMsg(result.message || 'Failed to submit payout request.');
    }
  }

  function maskEmail(email: string) {
    const [local, domain] = email.split('@');
    return `${local[0]}***@${domain}`;
  }

  function statusStyle(status: string): React.CSSProperties {
    const map: Record<string, { bg: string; color: string }> = {
      pending: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
      earned:  { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
      paid:    { bg: 'rgba(79,110,247,0.12)', color: '#4f6ef7' },
    };
    const s = map[status] || map.pending;
    return { display: 'inline-block', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, background: s.bg, color: s.color };
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111' }}>Referrals</h1>
        <div className="glass" style={{ borderRadius: '12px', height: '120px', opacity: 0.4 }} />
      </div>
    );
  }

  const canPayout = (data?.pendingBalance || 0) >= MIN_PAYOUT;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '820px' }}>

      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111', letterSpacing: '-0.3px' }}>Referrals</h1>
        <p style={{ color: 'rgba(0,0,0,0.35)', fontSize: '14px', marginTop: '4px' }}>Earn 25% of every subscription you refer</p>
      </div>

      {/* ── Section 1: Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px' }}>
        <StatCard label="Total referred"    value={String(data?.totalReferred || 0)} icon="◇" />
        <StatCard label="Converted to paid" value={String(data?.converted || 0)} icon="✓" accent="#10b981" />
        <StatCard label="Total earned"      value={`₦${(data?.totalEarned || 0).toLocaleString()}`} icon="◎" accent="#4f6ef7" />
        <StatCard label="Pending payout"    value={`₦${(data?.pendingBalance || 0).toLocaleString()}`} icon="◈" accent="#f59e0b" />
      </div>

      {/* ── Section 2: Referral link ── */}
      <div style={{
        borderRadius: '16px', padding: '28px 32px',
        background: 'rgba(79,110,247,0.07)',
        border: '1px solid rgba(79,110,247,0.2)',
      }}>
        <p style={{ fontSize: '13px', color: 'rgba(0,0,0,0.45)', marginBottom: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Your Referral Link
        </p>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
          <code style={{
            flex: 1, padding: '10px 14px', borderRadius: '8px', fontSize: '14px',
            background: 'rgba(0,0,0,0.006)', border: '1px solid rgba(0,0,0,0.1)',
            color: '#1a1a1a', fontFamily: 'monospace', wordBreak: 'break-all',
          }}>
            {referralLink || `https://zoomguru.xyz?ref=${data?.referralCode}`}
          </code>
          <button onClick={() => copy(referralLink, 'link')} style={{
            padding: '10px 18px', borderRadius: '8px', border: 'none',
            background: copied === 'link' ? '#10b981' : '#4f6ef7',
            color: '#111', fontSize: '14px', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0,
            transition: 'background 0.2s',
          }}>
            {copied === 'link' ? '✓ Copied!' : 'Copy Link'}
          </button>
        </div>
        <p style={{ fontSize: '13px', color: 'rgba(0,0,0,0.4)', marginBottom: '16px' }}>
          Share this link. Earn 25% of every subscription your referral makes.
        </p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <ShareBtn onClick={shareTwitter} label="Share on X" bg="rgba(0,0,0,0.08)" />
          <ShareBtn onClick={shareWhatsApp} label="WhatsApp" bg="rgba(37,211,102,0.12)" color="#25d366" />
          <ShareBtn onClick={() => copy(referralLink, 'share')} label={copied === 'share' ? 'Copied!' : 'Copy'} bg="rgba(0,0,0,0.06)" />
        </div>
      </div>

      {/* ── Section 3: Earnings table ── */}
      <div>
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1a1a1a', marginBottom: '14px' }}>Earnings Breakdown</h2>
        {!data?.referrals?.length ? (
          <div className="glass" style={{ borderRadius: '10px', padding: '32px', textAlign: 'center', color: 'rgba(0,0,0,0.3)', fontSize: '14px' }}>
            No referrals yet. Share your link to get started.
          </div>
        ) : (
          <div style={{ overflowX: 'auto', borderRadius: '12px' }}>
          <div className="glass" style={{ borderRadius: '12px', overflow: 'hidden', minWidth: '520px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 90px 110px 90px', padding: '12px 20px', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
              {['Date', 'Referred User', 'Plan', 'Commission', 'Status'].map(h => (
                <span key={h} style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(0,0,0,0.35)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</span>
              ))}
            </div>
            {data.referrals.map((r, i) => (
              <div key={r.id} style={{
                display: 'grid', gridTemplateColumns: '110px 1fr 90px 110px 90px',
                padding: '13px 20px', alignItems: 'center',
                borderBottom: i < data.referrals.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)',
              }}>
                <span style={{ fontSize: '13px', color: 'rgba(0,0,0,0.45)' }}>{fmtDate(r.created_at)}</span>
                <span style={{ fontSize: '13px', color: 'rgba(0,0,0,0.6)', fontFamily: 'monospace' }}>{maskEmail(r.referred_email)}</span>
                <span style={{ fontSize: '13px', color: '#1a1a1a', textTransform: 'capitalize' }}>{r.plan}</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#10b981' }}>₦{r.commission_amount.toLocaleString()}</span>
                <span style={statusStyle(r.status)}>{r.status.charAt(0).toUpperCase() + r.status.slice(1)}</span>
              </div>
            ))}
          </div>
          </div>
        )}
      </div>

      {/* ── Section 4: Payout ── */}
      <div>
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1a1a1a', marginBottom: '14px' }}>Request Payout</h2>
        <div className="glass" style={{ borderRadius: '16px', padding: '24px 28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <p style={{ fontSize: '12px', color: 'rgba(0,0,0,0.35)', marginBottom: '4px' }}>Available balance</p>
              <p style={{ fontSize: '28px', fontWeight: 700, color: '#10b981' }}>₦{(data?.pendingBalance || 0).toLocaleString()}</p>
            </div>
            <div style={{ fontSize: '13px', color: 'rgba(0,0,0,0.35)', textAlign: 'right' }}>
              Min. payout: <span style={{ color: '#1a1a1a', fontWeight: 500 }}>₦{MIN_PAYOUT.toLocaleString()}</span>
            </div>
          </div>

          {canPayout ? (
            <form onSubmit={requestPayout} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

              {/* Bank selector */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'rgba(0,0,0,0.45)', marginBottom: '6px', fontWeight: 500 }}>Bank</label>
                <select
                  required
                  value={payoutForm.bankCode}
                  onChange={e => {
                    const bank = banks.find(b => b.code === e.target.value);
                    setPayoutForm(f => ({ ...f, bankCode: e.target.value, bankName: bank?.name || '', accountName: '', accountNumber: '' }));
                    setVerified(false);
                    setVerifyError('');
                  }}
                  style={{
                    width: '100%', padding: '10px 14px', background: 'rgba(0,0,0,0.005)',
                    border: '1px solid rgba(0,0,0,0.1)', borderRadius: '8px',
                    color: payoutForm.bankCode ? '#1a1a1a' : 'rgba(0,0,0,0.35)',
                    fontSize: '14px', outline: 'none', fontFamily: 'inherit', appearance: 'none',
                  }}
                >
                  <option value="">Select bank…</option>
                  {banks.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
                </select>
              </div>

              {/* Account number + verify button */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'rgba(0,0,0,0.45)', marginBottom: '6px', fontWeight: 500 }}>Account Number</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={10}
                    required
                    value={payoutForm.accountNumber}
                    onChange={e => {
                      const v = e.target.value.replace(/\D/g, '');
                      setPayoutForm(f => ({ ...f, accountNumber: v, accountName: '' }));
                      setVerified(false);
                      setVerifyError('');
                    }}
                    placeholder="10-digit account number"
                    style={{
                      flex: 1, padding: '10px 14px', background: 'rgba(0,0,0,0.005)',
                      border: `1px solid ${verified ? 'rgba(16,185,129,0.5)' : verifyError ? 'rgba(239,68,68,0.4)' : 'rgba(0,0,0,0.1)'}`,
                      borderRadius: '8px', color: '#1a1a1a', fontSize: '14px', outline: 'none', fontFamily: 'inherit',
                    }}
                  />
                  <button
                    type="button"
                    disabled={verifying || payoutForm.accountNumber.length !== 10 || !payoutForm.bankCode}
                    onClick={verifyAccount}
                    style={{
                      padding: '10px 18px', borderRadius: '8px', border: 'none', flexShrink: 0,
                      background: verified ? 'rgba(16,185,129,0.12)' : 'rgba(79,110,247,0.12)',
                      color: verified ? '#10b981' : '#4f6ef7',
                      fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      opacity: (payoutForm.accountNumber.length !== 10 || !payoutForm.bankCode) ? 0.4 : 1,
                    }}
                  >
                    {verifying ? 'Checking…' : verified ? '✓ Verified' : 'Verify'}
                  </button>
                </div>
                {verifyError && <p style={{ fontSize: '12px', color: '#f87171', marginTop: '6px' }}>{verifyError}</p>}
              </div>

              {/* Auto-filled account name (read-only after verification) */}
              {payoutForm.accountName && (
                <div style={{
                  padding: '12px 14px', borderRadius: '8px',
                  background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)',
                  display: 'flex', alignItems: 'center', gap: '10px',
                }}>
                  <span style={{ fontSize: '13px', color: 'rgba(0,0,0,0.4)' }}>Account Name</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#10b981', flex: 1 }}>{payoutForm.accountName}</span>
                  <span style={{ fontSize: '11px', color: '#10b981', background: 'rgba(16,185,129,0.15)', padding: '2px 8px', borderRadius: '20px' }}>Verified by Paystack</span>
                </div>
              )}

              {/* Amount */}
              <Field
                label={`Amount (max ₦${(data?.pendingBalance || 0).toLocaleString()})`}
                value={payoutForm.amount}
                onChange={v => setPayoutForm(f => ({ ...f, amount: v }))}
                placeholder={String(data?.pendingBalance || '')}
                type="number"
              />

              {payoutMsg && (
                <div style={{
                  padding: '12px 14px', borderRadius: '8px', fontSize: '14px',
                  background: payoutMsg.includes('submitted') ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                  border: `1px solid ${payoutMsg.includes('submitted') ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
                  color: payoutMsg.includes('submitted') ? '#10b981' : '#f87171',
                }}>{payoutMsg}</div>
              )}

              <button type="submit" disabled={payoutLoading || !verified} style={{
                padding: '12px', borderRadius: '10px', border: 'none',
                background: verified ? '#10b981' : 'rgba(0,0,0,0.08)',
                color: verified ? '#111' : 'rgba(0,0,0,0.3)',
                fontSize: '15px', fontWeight: 600,
                cursor: (payoutLoading || !verified) ? 'not-allowed' : 'pointer',
                opacity: payoutLoading ? 0.7 : 1,
                fontFamily: 'inherit', transition: 'background 0.2s',
              }}>
                {payoutLoading ? 'Submitting…' : !verified ? 'Verify account to continue' : 'Request Payout'}
              </button>
            </form>
          ) : (
            <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(0,0,0,0.004)', border: '1px solid rgba(0,0,0,0.08)', color: 'rgba(0,0,0,0.45)', fontSize: '14px' }}>
              Minimum payout is ₦{MIN_PAYOUT.toLocaleString()}. Keep referring to unlock your balance!
            </div>
          )}
        </div>

        {/* Payout history */}
        {!!data?.payoutHistory?.length && (
          <div style={{ marginTop: '20px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'rgba(0,0,0,0.5)', marginBottom: '10px' }}>Payout History</h3>
            <div className="glass" style={{ borderRadius: '12px', overflow: 'hidden' }}>
              {data.payoutHistory.map((p, i) => (
                <div key={p.id} style={{
                  display: 'grid', gridTemplateColumns: '1fr 130px 100px 130px',
                  padding: '13px 20px', alignItems: 'center',
                  borderBottom: i < data.payoutHistory.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                }}>
                  <span style={{ fontSize: '13px', color: 'rgba(0,0,0,0.45)' }}>{fmtDate(p.requested_at)}</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a' }}>₦{p.amount.toLocaleString()}</span>
                  <span style={statusStyle(p.status)}>{p.status.charAt(0).toUpperCase() + p.status.slice(1)}</span>
                  <span style={{ fontSize: '12px', color: 'rgba(0,0,0,0.3)' }}>
                    {p.processed_at ? `Processed ${fmtDate(p.processed_at)}` : 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, accent }: { label: string; value: string; icon: string; accent?: string }) {
  return (
    <div className="glass" style={{ borderRadius: '12px', padding: '18px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(0,0,0,0.35)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
        <span style={{ fontSize: '16px', opacity: 0.4 }}>{icon}</span>
      </div>
      <p style={{ fontSize: '24px', fontWeight: 700, color: accent || '#e8e8e8' }}>{value}</p>
    </div>
  );
}

function ShareBtn({ onClick, label, bg, color }: { onClick: () => void; label: string; bg: string; color?: string }) {
  return (
    <button onClick={onClick} style={{
      padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)',
      background: bg, color: color || '#e8e8e8', fontSize: '13px', fontWeight: 500,
      cursor: 'pointer', fontFamily: 'inherit',
    }}>{label}</button>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '13px', color: 'rgba(0,0,0,0.45)', marginBottom: '6px', fontWeight: 500 }}>{label}</label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required
        style={{
          width: '100%', padding: '10px 14px', background: 'rgba(0,0,0,0.005)',
          border: '1px solid rgba(0,0,0,0.1)', borderRadius: '8px',
          color: '#1a1a1a', fontSize: '14px', outline: 'none', fontFamily: 'inherit',
        }}
        onFocus={e => (e.currentTarget.style.borderColor = 'rgba(79,110,247,0.5)')}
        onBlur={e => (e.currentTarget.style.borderColor = 'rgba(0,0,0,0.1)')}
      />
    </div>
  );
}
