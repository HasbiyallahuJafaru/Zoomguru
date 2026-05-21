'use client';
export const dynamic = 'force-dynamic';
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
  const [payoutForm, setPayoutForm] = useState({ bankName: '', accountNumber: '', accountName: '', amount: '' });
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutMsg, setPayoutMsg] = useState('');

  const referralLink = data ? `https://zoomguru.com?ref=${data.referralCode}` : '';

  const fetchData = useCallback(async () => {
    if (!user?.accessToken) return;
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/referral/stats`, {
      headers: { Authorization: `Bearer ${user.accessToken}` },
    });
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
  }, [user?.accessToken]);

  useEffect(() => { fetchData(); }, [fetchData]);

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

  async function requestPayout(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.accessToken) return;
    setPayoutLoading(true);
    setPayoutMsg('');
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/referral/payout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.accessToken}` },
      body: JSON.stringify({
        bankName: payoutForm.bankName,
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
      setPayoutForm({ bankName: '', accountNumber: '', accountName: '', amount: '' });
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
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#fff' }}>Referrals</h1>
        <div className="glass" style={{ borderRadius: '12px', height: '120px', opacity: 0.4 }} />
      </div>
    );
  }

  const canPayout = (data?.pendingBalance || 0) >= MIN_PAYOUT;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '820px' }}>

      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#fff', letterSpacing: '-0.3px' }}>Referrals</h1>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '14px', marginTop: '4px' }}>Earn 25% of every subscription you refer</p>
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
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', marginBottom: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Your Referral Link
        </p>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
          <code style={{
            flex: 1, padding: '10px 14px', borderRadius: '8px', fontSize: '14px',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#e8e8e8', fontFamily: 'monospace', wordBreak: 'break-all',
          }}>
            {referralLink || `https://zoomguru.com?ref=${data?.referralCode}`}
          </code>
          <button onClick={() => copy(referralLink, 'link')} style={{
            padding: '10px 18px', borderRadius: '8px', border: 'none',
            background: copied === 'link' ? '#10b981' : '#4f6ef7',
            color: '#fff', fontSize: '14px', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0,
            transition: 'background 0.2s',
          }}>
            {copied === 'link' ? '✓ Copied!' : 'Copy Link'}
          </button>
        </div>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginBottom: '16px' }}>
          Share this link. Earn 25% of every subscription your referral makes.
        </p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <ShareBtn onClick={shareTwitter} label="Share on X" bg="rgba(255,255,255,0.08)" />
          <ShareBtn onClick={shareWhatsApp} label="WhatsApp" bg="rgba(37,211,102,0.12)" color="#25d366" />
          <ShareBtn onClick={() => copy(referralLink, 'share')} label={copied === 'share' ? 'Copied!' : 'Copy'} bg="rgba(255,255,255,0.06)" />
        </div>
      </div>

      {/* ── Section 3: Earnings table ── */}
      <div>
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#e8e8e8', marginBottom: '14px' }}>Earnings Breakdown</h2>
        {!data?.referrals?.length ? (
          <div className="glass" style={{ borderRadius: '10px', padding: '32px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '14px' }}>
            No referrals yet. Share your link to get started.
          </div>
        ) : (
          <div className="glass" style={{ borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 100px 110px 100px', padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              {['Date', 'Referred User', 'Plan', 'Commission', 'Status'].map(h => (
                <span key={h} style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</span>
              ))}
            </div>
            {data.referrals.map((r, i) => (
              <div key={r.id} style={{
                display: 'grid', gridTemplateColumns: '110px 1fr 100px 110px 100px',
                padding: '13px 20px', alignItems: 'center',
                borderBottom: i < data.referrals.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
              }}>
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)' }}>{fmtDate(r.created_at)}</span>
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', fontFamily: 'monospace' }}>{maskEmail(r.referred_email)}</span>
                <span style={{ fontSize: '13px', color: '#e8e8e8', textTransform: 'capitalize' }}>{r.plan}</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#10b981' }}>₦{r.commission_amount.toLocaleString()}</span>
                <span style={statusStyle(r.status)}>{r.status.charAt(0).toUpperCase() + r.status.slice(1)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Section 4: Payout ── */}
      <div>
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#e8e8e8', marginBottom: '14px' }}>Request Payout</h2>
        <div className="glass" style={{ borderRadius: '16px', padding: '24px 28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', marginBottom: '4px' }}>Available balance</p>
              <p style={{ fontSize: '28px', fontWeight: 700, color: '#10b981' }}>₦{(data?.pendingBalance || 0).toLocaleString()}</p>
            </div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', textAlign: 'right' }}>
              Min. payout: <span style={{ color: '#e8e8e8', fontWeight: 500 }}>₦{MIN_PAYOUT.toLocaleString()}</span>
            </div>
          </div>

          {canPayout ? (
            <form onSubmit={requestPayout} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <Field label="Bank Name" value={payoutForm.bankName} onChange={v => setPayoutForm(f => ({ ...f, bankName: v }))} placeholder="e.g. GTBank" />
                <Field label="Account Number" value={payoutForm.accountNumber} onChange={v => setPayoutForm(f => ({ ...f, accountNumber: v }))} placeholder="0123456789" />
              </div>
              <Field label="Account Name" value={payoutForm.accountName} onChange={v => setPayoutForm(f => ({ ...f, accountName: v }))} placeholder="Full name on account" />
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
              <button type="submit" disabled={payoutLoading} style={{
                padding: '12px', borderRadius: '10px', border: 'none',
                background: '#10b981', color: '#fff', fontSize: '15px', fontWeight: 600,
                cursor: payoutLoading ? 'not-allowed' : 'pointer', opacity: payoutLoading ? 0.7 : 1,
                fontFamily: 'inherit',
              }}>
                {payoutLoading ? 'Submitting…' : 'Request Payout'}
              </button>
            </form>
          ) : (
            <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)', fontSize: '14px' }}>
              Minimum payout is ₦{MIN_PAYOUT.toLocaleString()}. Keep referring to unlock your balance!
            </div>
          )}
        </div>

        {/* Payout history */}
        {!!data?.payoutHistory?.length && (
          <div style={{ marginTop: '20px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: '10px' }}>Payout History</h3>
            <div className="glass" style={{ borderRadius: '12px', overflow: 'hidden' }}>
              {data.payoutHistory.map((p, i) => (
                <div key={p.id} style={{
                  display: 'grid', gridTemplateColumns: '1fr 130px 100px 130px',
                  padding: '13px 20px', alignItems: 'center',
                  borderBottom: i < data.payoutHistory.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                }}>
                  <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)' }}>{fmtDate(p.requested_at)}</span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#e8e8e8' }}>₦{p.amount.toLocaleString()}</span>
                  <span style={statusStyle(p.status)}>{p.status.charAt(0).toUpperCase() + p.status.slice(1)}</span>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>
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
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
        <span style={{ fontSize: '16px', opacity: 0.4 }}>{icon}</span>
      </div>
      <p style={{ fontSize: '24px', fontWeight: 700, color: accent || '#e8e8e8' }}>{value}</p>
    </div>
  );
}

function ShareBtn({ onClick, label, bg, color }: { onClick: () => void; label: string; bg: string; color?: string }) {
  return (
    <button onClick={onClick} style={{
      padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)',
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
      <label style={{ display: 'block', fontSize: '13px', color: 'rgba(255,255,255,0.45)', marginBottom: '6px', fontWeight: 500 }}>{label}</label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required
        style={{
          width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
          color: '#e8e8e8', fontSize: '14px', outline: 'none', fontFamily: 'inherit',
        }}
        onFocus={e => (e.currentTarget.style.borderColor = 'rgba(79,110,247,0.5)')}
        onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
      />
    </div>
  );
}
