'use client';
import { useSession } from 'next-auth/react';
import { useEffect, useState, useCallback } from 'react';

interface Payment {
  id: string;
  paystack_reference: string;
  amount: number;
  currency: string;
  plan: string;
  status: string;
  created_at: string;
}

interface PaymentsResponse {
  payments: Payment[];
  total: number;
  totalSpentNgn: number;
  totalSpentUsd: number;
}

export default function PaymentsPage() {
  const { data: session } = useSession();
  const user = session?.user as any;

  const [data, setData] = useState<PaymentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterCurrency, setFilterCurrency] = useState('');
  const [filterPlan, setFilterPlan] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const LIMIT = 20;

  const fetchPayments = useCallback(async () => {
    if (!user?.accessToken) return;
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(LIMIT),
      ...(search && { search }),
      ...(filterCurrency && { currency: filterCurrency }),
      ...(filterPlan && { plan: filterPlan }),
    });
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/auth/user/payments?${params}`,
      { headers: { Authorization: `Bearer ${user.accessToken}` } }
    );
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [user?.accessToken, page, search, filterCurrency, filterPlan]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  // Reset to page 1 on filter change
  useEffect(() => { setPage(1); }, [search, filterCurrency, filterPlan]);

  function copyRef(ref: string) {
    navigator.clipboard.writeText(ref);
    setCopied(ref);
    setTimeout(() => setCopied(null), 2000);
  }

  function statusStyle(status: string): React.CSSProperties {
    const map: Record<string, { bg: string; color: string }> = {
      success: { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
      pending: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
      failed:  { bg: 'rgba(239,68,68,0.12)',  color: '#ef4444' },
    };
    const s = map[status] || map.pending;
    return {
      display: 'inline-block', padding: '3px 10px', borderRadius: '20px',
      fontSize: '12px', fontWeight: 600, background: s.bg, color: s.color,
    };
  }

  function formatAmount(amount: number, currency: string) {
    if (currency === 'NGN') return `₦${amount.toLocaleString()}`;
    return `$${amount.toLocaleString()}`;
  }

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', maxWidth: '900px' }}>

      {/* Title + summary */}
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111', letterSpacing: '-0.3px' }}>Payment History</h1>
        {data && (
          <div style={{ display: 'flex', gap: '24px', marginTop: '8px', flexWrap: 'wrap' }}>
            <Stat label="Total transactions" value={String(data.total)} />
            {data.totalSpentNgn > 0 && <Stat label="Total spent (NGN)" value={`₦${data.totalSpentNgn.toLocaleString()}`} />}
            {data.totalSpentUsd > 0 && <Stat label="Total spent (USD)" value={`$${data.totalSpentUsd.toLocaleString()}`} />}
          </div>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search by reference…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: '1 1 200px', padding: '9px 14px',
            background: 'rgba(0,0,0,0.005)',
            border: '1px solid rgba(0,0,0,0.1)', borderRadius: '8px',
            color: '#1a1a1a', fontSize: '14px', outline: 'none', fontFamily: 'inherit',
          }}
        />
        <Select value={filterCurrency} onChange={setFilterCurrency} options={[
          { value: '', label: 'All currencies' },
          { value: 'NGN', label: 'NGN' },
          { value: 'USD', label: 'USD' },
        ]} />
        <Select value={filterPlan} onChange={setFilterPlan} options={[
          { value: '', label: 'All plans' },
          { value: 'monthly', label: 'Monthly' },
          { value: 'lifetime', label: 'Lifetime' },
        ]} />
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[1,2,3].map(i => (
            <div key={i} className="glass" style={{ borderRadius: '10px', height: '52px', opacity: 0.4 }} />
          ))}
        </div>
      ) : !data?.payments.length ? (
        <EmptyState hasFilters={!!(search || filterCurrency || filterPlan)} />
      ) : (
        <div className="glass" style={{ borderRadius: '12px', overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr 100px 80px 1fr 100px', padding: '12px 20px', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
            {['Date', 'Plan', 'Amount', 'Currency', 'Reference', 'Status'].map(h => (
              <span key={h} style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(0,0,0,0.35)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</span>
            ))}
          </div>

          {/* Rows */}
          {data.payments.map((p, i) => (
            <div key={p.id} style={{
              display: 'grid', gridTemplateColumns: '130px 1fr 100px 80px 1fr 100px',
              padding: '14px 20px', alignItems: 'center',
              borderBottom: i < data.payments.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none',
              background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)',
            }}>
              <span style={{ fontSize: '13px', color: 'rgba(0,0,0,0.5)' }}>
                {new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
              <span>
                <span style={{
                  display: 'inline-block', padding: '2px 9px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                  background: p.plan === 'lifetime' ? 'rgba(79,110,247,0.1)' : 'rgba(16,185,129,0.12)',
                  color: p.plan === 'lifetime' ? '#4f6ef7' : '#10b981',
                }}>
                  {p.plan === 'lifetime' ? 'Lifetime' : 'Monthly'}
                </span>
              </span>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a1a' }}>
                {formatAmount(p.amount, p.currency)}
              </span>
              <span style={{ fontSize: '13px', color: 'rgba(0,0,0,0.4)' }}>{p.currency}</span>
              <button
                onClick={() => copyRef(p.paystack_reference)}
                title="Click to copy"
                style={{
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  fontFamily: 'monospace', fontSize: '12px',
                  color: copied === p.paystack_reference ? '#10b981' : 'rgba(0,0,0,0.4)',
                  textAlign: 'left',
                }}
              >
                {copied === p.paystack_reference ? 'Copied!' : `${p.paystack_reference.slice(0, 16)}…`}
              </button>
              <span style={statusStyle(p.status)}>
                {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
          <PageBtn onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} label="← Prev" />
          <span style={{ fontSize: '13px', color: 'rgba(0,0,0,0.4)' }}>
            Page {page} of {totalPages}
          </span>
          <PageBtn onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} label="Next →" />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span style={{ fontSize: '13px', color: 'rgba(0,0,0,0.35)' }}>{label}: </span>
      <span style={{ fontSize: '13px', fontWeight: 600, color: '#1a1a1a' }}>{value}</span>
    </div>
  );
}

function Select({ value, onChange, options }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        padding: '9px 14px', background: 'rgba(0,0,0,0.005)',
        border: '1px solid rgba(0,0,0,0.1)', borderRadius: '8px',
        color: '#1a1a1a', fontSize: '14px', outline: 'none',
        fontFamily: 'inherit', cursor: 'pointer',
      }}
    >
      {options.map(o => <option key={o.value} value={o.value} style={{ background: '#1a1a1a' }}>{o.label}</option>)}
    </select>
  );
}

function PageBtn({ onClick, disabled, label }: { onClick: () => void; disabled: boolean; label: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '7px 16px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)',
        background: 'rgba(0,0,0,0.005)', color: disabled ? 'rgba(0,0,0,0.2)' : '#e8e8e8',
        fontSize: '13px', cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
      }}
    >{label}</button>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="glass" style={{ borderRadius: '12px', padding: '48px 32px', textAlign: 'center' }}>
      <p style={{ fontSize: '32px', marginBottom: '12px' }}>◎</p>
      <p style={{ fontSize: '15px', fontWeight: 600, color: 'rgba(0,0,0,0.6)', marginBottom: '6px' }}>
        {hasFilters ? 'No payments match your filters' : 'No payments yet'}
      </p>
      <p style={{ fontSize: '13px', color: 'rgba(0,0,0,0.3)' }}>
        {hasFilters ? 'Try adjusting your search or filters.' : 'Upgrade to Pro to get started.'}
      </p>
    </div>
  );
}
