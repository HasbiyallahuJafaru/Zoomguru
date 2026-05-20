'use client';
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { AdminLayout } from '@/components/AdminLayout';

const API = process.env.NEXT_PUBLIC_API_URL!;

function fmtNGN(n: number | string) {
  return '₦' + Number(n).toLocaleString('en-NG', { maximumFractionDigits: 0 });
}
function timeAgo(iso: string | null) {
  if (!iso) return '—';
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return secs + 's ago';
  if (secs < 3600) return Math.floor(secs / 60) + 'm ago';
  if (secs < 86400) return Math.floor(secs / 3600) + 'h ago';
  return Math.floor(secs / 86400) + 'd ago';
}
function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function maskAccount(n: string | null) {
  if (!n) return '—';
  return n.slice(0, 4) + 'x'.repeat(Math.max(0, n.length - 4));
}

interface PayoutStats {
  pending_total: number;
  pending_count: number;
  paid_total: number;
  avg_payout: number;
}
interface PayoutRow {
  id: string;
  amount: number;
  currency: string;
  bank_name: string | null;
  account_number: string | null;
  account_name: string | null;
  status: string;
  requested_at: string;
  processed_at: string | null;
  email: string;
  name: string;
  username: string;
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }} onClick={onClose}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: '28px 32px',
        minWidth: 380, maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: '0 0 16px' }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}

function ConfirmPayModal({
  payout,
  onConfirm,
  onClose,
  busy,
}: { payout: PayoutRow; onConfirm: () => void; onClose: () => void; busy: boolean }) {
  return (
    <Modal title="Confirm Payment" onClose={onClose}>
      <p style={{ fontSize: 13, color: '#475569', margin: '0 0 20px', lineHeight: 1.6 }}>
        Mark <strong>{fmtNGN(payout.amount)}</strong> payout to <strong>@{payout.username}</strong> as paid?
        This will update their referral balance and cannot be undone.
      </p>
      <div style={{ background: '#f8fafc', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: '#374151', marginBottom: 20 }}>
        <div><strong>Bank:</strong> {payout.bank_name ?? '—'}</div>
        <div><strong>Account:</strong> {payout.account_number} — {payout.account_name}</div>
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onClose} disabled={busy} style={{ padding: '8px 18px', borderRadius: 7, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: 13, cursor: 'pointer' }}>
          Cancel
        </button>
        <button onClick={onConfirm} disabled={busy} style={{ padding: '8px 18px', borderRadius: 7, border: 'none', background: '#10b981', color: '#fff', fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1 }}>
          {busy ? 'Processing…' : '✓ Confirm Paid'}
        </button>
      </div>
    </Modal>
  );
}

function RejectModal({
  payout,
  onConfirm,
  onClose,
  busy,
}: { payout: PayoutRow; onConfirm: (note: string) => void; onClose: () => void; busy: boolean }) {
  const [note, setNote] = useState('');
  return (
    <Modal title="Reject Payout" onClose={onClose}>
      <p style={{ fontSize: 13, color: '#475569', margin: '0 0 16px' }}>
        Reject payout of <strong>{fmtNGN(payout.amount)}</strong> to <strong>@{payout.username}</strong>?
      </p>
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Reason for rejection (shown to user)…"
        rows={3}
        style={{
          width: '100%', borderRadius: 7, border: '1px solid #e2e8f0',
          padding: '10px 12px', fontSize: 13, resize: 'vertical',
          boxSizing: 'border-box', marginBottom: 16, outline: 'none',
        }}
      />
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onClose} disabled={busy} style={{ padding: '8px 18px', borderRadius: 7, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: 13, cursor: 'pointer' }}>
          Cancel
        </button>
        <button onClick={() => onConfirm(note)} disabled={busy} style={{ padding: '8px 18px', borderRadius: 7, border: 'none', background: '#ef4444', color: '#fff', fontSize: 13, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1 }}>
          {busy ? 'Rejecting…' : '✗ Reject'}
        </button>
      </div>
    </Modal>
  );
}

// ─── Pending Payout Card ──────────────────────────────────────────────────────

function PendingCard({
  payout,
  onPay,
  onReject,
}: { payout: PayoutRow; onPay: (p: PayoutRow) => void; onReject: (p: PayoutRow) => void }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
      padding: '18px 22px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>@{payout.username}</span>
          <span style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>{fmtNGN(payout.amount)}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 20px', fontSize: 13, color: '#475569' }}>
          <div><span style={{ color: '#94a3b8' }}>Bank:</span> {payout.bank_name ?? '—'}</div>
          <div><span style={{ color: '#94a3b8' }}>Requested:</span> {timeAgo(payout.requested_at)}</div>
          <div><span style={{ color: '#94a3b8' }}>Account:</span> {maskAccount(payout.account_number)}</div>
          <div><span style={{ color: '#94a3b8' }}>Name:</span> {payout.account_name ?? '—'}</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
        <button
          onClick={() => onPay(payout)}
          style={{
            padding: '8px 16px', borderRadius: 7, border: 'none',
            background: '#10b981', color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          ✓ Mark as Paid
        </button>
        <button
          onClick={() => onReject(payout)}
          style={{
            padding: '8px 16px', borderRadius: 7,
            border: '1px solid #fca5a5', background: '#fff',
            color: '#dc2626', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          ✗ Reject
        </button>
      </div>
    </div>
  );
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  pending:  { bg: '#fef9c3', color: '#854d0e' },
  paid:     { bg: '#dcfce7', color: '#166534' },
  rejected: { bg: '#fee2e2', color: '#dc2626' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { bg: '#f1f5f9', color: '#475569' };
  return (
    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color }}>
      {status}
    </span>
  );
}

function KPICard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
      padding: '18px 22px', flex: 1, minWidth: 160,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function PayoutsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [stats, setStats] = useState<PayoutStats | null>(null);
  const [pending, setPending] = useState<PayoutRow[]>([]);
  const [history, setHistory] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [confirmPay, setConfirmPay] = useState<PayoutRow | null>(null);
  const [confirmReject, setConfirmReject] = useState<PayoutRow | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  const load = useCallback(() => {
    if (status !== 'authenticated') return;
    const headers = { Authorization: `Bearer ${(session as any)?.accessToken}` };
    Promise.all([
      fetch(`${API}/admin/payouts?status=pending`, { headers }).then(r => r.json()),
      fetch(`${API}/admin/payouts?status=all`, { headers }).then(r => r.json()),
    ])
      .then(([pRes, aRes]) => {
        setStats(pRes.stats ?? aRes.stats ?? null);
        setPending(pRes.payouts ?? []);
        setHistory(aRes.payouts ?? []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [status, session]);

  useEffect(() => { load(); }, [load]);

  async function processPayout(id: string, payStatus: 'paid' | 'rejected', note?: string) {
    setBusy(true);
    try {
      const r = await fetch(`${API}/admin/payouts/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(session as any)?.accessToken}`,
        },
        body: JSON.stringify({ status: payStatus, note }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setConfirmPay(null);
      setConfirmReject(null);
      load();
    } catch (e: any) {
      alert('Action failed: ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  if (status === 'loading' || loading) {
    return <AdminLayout><div style={{ padding: 40, color: '#64748b', fontSize: 14 }}>Loading payouts…</div></AdminLayout>;
  }
  if (error) {
    return <AdminLayout><div style={{ padding: 40, color: '#dc2626', fontSize: 14 }}>Error: {error}</div></AdminLayout>;
  }

  return (
    <AdminLayout>
      <div style={{ padding: '32px 40px', maxWidth: 1400, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', margin: 0 }}>Referral Payouts</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Manage and process referral commission payouts</p>
        </div>

        {/* Summary KPIs */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 32 }}>
          <KPICard label="Pending Total" value={fmtNGN(stats?.pending_total ?? 0)} sub="Awaiting payment" />
          <KPICard label="Pending Requests" value={String(stats?.pending_count ?? 0)} sub="Users to pay" />
          <KPICard label="Total Paid Out" value={fmtNGN(stats?.paid_total ?? 0)} sub="All time" />
          <KPICard label="Avg Payout" value={fmtNGN(stats?.avg_payout ?? 0)} sub="Per transaction" />
        </div>

        {/* Pending payouts */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 }}>Pending Payouts</h2>
            {pending.length > 0 && (
              <span style={{ background: '#fef9c3', color: '#854d0e', borderRadius: 99, padding: '2px 9px', fontSize: 12, fontWeight: 700 }}>
                {pending.length}
              </span>
            )}
          </div>
          {pending.length === 0 ? (
            <div style={{
              background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10,
              padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: 13,
            }}>
              No pending payouts — all caught up!
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(440px, 1fr))', gap: 14 }}>
              {pending.map(p => (
                <PendingCard
                  key={p.id}
                  payout={p}
                  onPay={setConfirmPay}
                  onReject={setConfirmReject}
                />
              ))}
            </div>
          )}
        </div>

        {/* Payout history */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '24px 28px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 16px' }}>Payout History</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Username', 'Amount', 'Bank', 'Account', 'Requested', 'Processed', 'Status'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: '#64748b', fontWeight: 600, fontSize: 12, borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>No payout records</td></tr>
              ) : history.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 500, color: '#0f172a' }}>
                    <div>@{p.username}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{p.email}</div>
                  </td>
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>{fmtNGN(p.amount)}</td>
                  <td style={{ padding: '10px 14px', color: '#475569' }}>{p.bank_name ?? '—'}</td>
                  <td style={{ padding: '10px 14px', color: '#64748b', fontFamily: 'monospace', fontSize: 12 }}>{maskAccount(p.account_number)}</td>
                  <td style={{ padding: '10px 14px', color: '#64748b', whiteSpace: 'nowrap' }}>{fmtDate(p.requested_at)}</td>
                  <td style={{ padding: '10px 14px', color: '#64748b', whiteSpace: 'nowrap' }}>{fmtDate(p.processed_at)}</td>
                  <td style={{ padding: '10px 14px' }}><StatusBadge status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>

      {/* Modals */}
      {confirmPay && (
        <ConfirmPayModal
          payout={confirmPay}
          onConfirm={() => processPayout(confirmPay.id, 'paid')}
          onClose={() => setConfirmPay(null)}
          busy={busy}
        />
      )}
      {confirmReject && (
        <RejectModal
          payout={confirmReject}
          onConfirm={(note) => processPayout(confirmReject.id, 'rejected', note)}
          onClose={() => setConfirmReject(null)}
          busy={busy}
        />
      )}
    </AdminLayout>
  );
}
