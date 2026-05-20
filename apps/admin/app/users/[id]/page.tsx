'use client';
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import { AdminLayout } from '@/components/AdminLayout';

const API = process.env.NEXT_PUBLIC_API_URL!;

// ── Helpers ──────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDateTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function timeAgo(iso: string | null) {
  if (!iso) return '—';
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return secs + 's ago';
  if (secs < 3600) return Math.floor(secs / 60) + 'm ago';
  if (secs < 86400) return Math.floor(secs / 3600) + 'h ago';
  return Math.floor(secs / 86400) + 'd ago';
}

function copyText(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

// ── Sub-components ───────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden',
    }}>
      <div style={{
        padding: '16px 24px', borderBottom: '1px solid #f1f5f9',
        background: '#f8fafc',
      }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {title}
        </p>
      </div>
      <div style={{ padding: '20px 24px' }}>{children}</div>
    </div>
  );
}

function Row({ label, value, mono = false, copyable = false }: {
  label: string; value: React.ReactNode; mono?: boolean; copyable?: boolean;
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '10px 0', borderBottom: '1px solid #f8fafc', gap: 16,
    }}>
      <span style={{ fontSize: 13, color: '#94a3b8', flexShrink: 0 }}>{label}</span>
      <span style={{
        fontSize: 13, color: '#0f172a', fontWeight: 500,
        fontFamily: mono ? 'monospace' : 'inherit',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        {value}
        {copyable && typeof value === 'string' && (
          <button
            onClick={() => copyText(value)}
            title="Copy"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#94a3b8', fontSize: 12, padding: '0 2px',
            }}
          >⧉</button>
        )}
      </span>
    </div>
  );
}

function Avatar({ name, avatarUrl, size = 80 }: { name: string; avatarUrl?: string; size?: number }) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: '#eef2ff', color: '#4f6ef7',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 800,
    }}>
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  );
}

function Badge({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span style={{ padding: '3px 10px', borderRadius: 5, fontSize: 12, fontWeight: 600, background: bg, color }}>
      {label}
    </span>
  );
}

function ActionBtn({ label, color, onClick }: { label: string; color: 'red' | 'green' | 'blue' | 'gray'; onClick: () => void }) {
  const MAP = {
    red:   { bg: '#fee2e2', border: '#fecaca', text: '#dc2626' },
    green: { bg: '#d1fae5', border: '#a7f3d0', text: '#059669' },
    blue:  { bg: '#eef2ff', border: '#c7d2fe', text: '#4f6ef7' },
    gray:  { bg: '#f1f5f9', border: '#e2e8f0', text: '#475569' },
  };
  const s = MAP[color];
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 16px', borderRadius: 8,
        background: s.bg, border: `1px solid ${s.border}`,
        color: s.text, fontSize: 13, fontWeight: 600,
        cursor: 'pointer', fontFamily: 'inherit',
      }}
    >{label}</button>
  );
}

// ── Confirm modal ─────────────────────────────────────────────────────────

function ConfirmModal({ message, onConfirm, onCancel, requireType }: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  requireType?: string;
}) {
  const [typed, setTyped] = useState('');
  const ok = !requireType || typed === requireType;
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }}>
      <div style={{
        background: '#fff', borderRadius: 14, padding: 32, width: 400,
        boxShadow: '0 8px 48px rgba(0,0,0,0.15)',
      }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 12px' }}>
          Confirm Action
        </p>
        <p style={{ fontSize: 13, color: '#475569', margin: '0 0 20px', lineHeight: 1.6 }}>
          {message}
        </p>
        {requireType && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 6px' }}>
              Type <strong style={{ color: '#0f172a' }}>{requireType}</strong> to confirm:
            </p>
            <input
              type="text"
              value={typed}
              onChange={e => setTyped(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 8,
                border: '1px solid #e2e8f0', fontSize: 13,
                outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
              }}
              placeholder={requireType}
              autoFocus
            />
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{
            padding: '8px 18px', borderRadius: 8, border: '1px solid #e2e8f0',
            background: '#fff', color: '#475569', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
          }}>Cancel</button>
          <button
            onClick={onConfirm}
            disabled={!ok}
            style={{
              padding: '8px 18px', borderRadius: 8, border: 'none',
              background: ok ? '#ef4444' : '#fca5a5',
              color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: ok ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
            }}
          >Confirm</button>
        </div>
      </div>
    </div>
  );
}

// ── Admin key modal ───────────────────────────────────────────────────────

function AdminKeyModal({ onConfirm, onCancel }: {
  onConfirm: (key: string) => void;
  onCancel: () => void;
}) {
  const [key, setKey] = useState('');
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }}>
      <div style={{
        background: '#fff', borderRadius: 14, padding: 32, width: 380,
        boxShadow: '0 8px 48px rgba(0,0,0,0.15)',
      }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>
          Admin Key Required
        </p>
        <p style={{ fontSize: 13, color: '#475569', margin: '0 0 18px' }}>
          Enter the ADMIN_SECRET_KEY to proceed with this role change.
        </p>
        <input
          type="password"
          value={key}
          onChange={e => setKey(e.target.value)}
          placeholder="Admin secret key"
          autoFocus
          style={{
            width: '100%', padding: '9px 12px', borderRadius: 8,
            border: '1px solid #e2e8f0', fontSize: 13,
            outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
            marginBottom: 18,
          }}
        />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{
            padding: '8px 18px', borderRadius: 8, border: '1px solid #e2e8f0',
            background: '#fff', color: '#475569', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
          }}>Cancel</button>
          <button
            onClick={() => key && onConfirm(key)}
            disabled={!key}
            style={{
              padding: '8px 18px', borderRadius: 8, border: 'none',
              background: key ? '#4f6ef7' : '#a5b4fc',
              color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: key ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
            }}
          >Confirm</button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

type Modal =
  | null
  | 'revoke'
  | 'reactivate'
  | 'grant-admin'
  | 'remove-admin'
  | 'delete';

export default function UserDetailPage() {
  const { data: session } = useSession();
  const token = (session?.user as any)?.accessToken;
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast]     = useState('');
  const [modal, setModal]     = useState<Modal>(null);
  const [busy, setBusy]       = useState(false);

  const fetch$ = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    const res = await fetch(`${API}/admin/users/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [token, id]);

  useEffect(() => { fetch$(); }, [fetch$]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function revokeOrReactivate(active: boolean) {
    setBusy(true);
    const res = await fetch(`${API}/admin/users/${id}/license`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ active }),
    });
    setBusy(false);
    setModal(null);
    if (res.ok) { showToast(active ? 'License reactivated.' : 'License revoked.'); fetch$(); }
    else showToast('Action failed.');
  }

  async function changeRole(newRole: 'user' | 'admin', adminKey: string) {
    setBusy(true);
    const res = await fetch(`${API}/admin/users/${id}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'x-admin-key': adminKey,
      },
      body: JSON.stringify({ role: newRole }),
    });
    setBusy(false);
    setModal(null);
    if (res.ok) { showToast(`Role updated to ${newRole}.`); fetch$(); }
    else showToast('Role update failed. Check admin key.');
  }

  async function deleteAccount() {
    setBusy(true);
    const res = await fetch(`${API}/auth/user/account`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    setBusy(false);
    setModal(null);
    if (res.ok) { showToast('Account deleted.'); router.push('/users'); }
    else showToast('Delete failed.');
  }

  const user = data?.user;
  const activeLicense = data?.licenses?.find((l: any) => l.status === 'active');
  const isRevoked = !user?.is_pro && data?.licenses?.length > 0;

  // Compute favourite interview type from sessions
  const sessionTypes: Record<string, number> = {};
  (data?.sessions ?? []).forEach((s: any) => {
    sessionTypes[s.interview_type] = (sessionTypes[s.interview_type] ?? 0) + 1;
  });
  const favType = Object.entries(sessionTypes).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

  if (loading || !data) {
    return (
      <AdminLayout title="User Detail">
        <div style={{ color: '#94a3b8', fontSize: 14, padding: 48, textAlign: 'center' }}>
          Loading…
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="User Detail" onRefresh={fetch$}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 200,
          background: '#0f172a', color: '#fff', padding: '12px 20px',
          borderRadius: 10, fontSize: 13, fontWeight: 500,
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        }}>{toast}</div>
      )}

      {/* Modals */}
      {modal === 'revoke' && (
        <ConfirmModal
          message="Revoke this user's license? They will lose Pro access immediately."
          onConfirm={() => revokeOrReactivate(false)}
          onCancel={() => setModal(null)}
        />
      )}
      {modal === 'reactivate' && (
        <ConfirmModal
          message="Reactivate this user's license and restore Pro access?"
          onConfirm={() => revokeOrReactivate(true)}
          onCancel={() => setModal(null)}
        />
      )}
      {(modal === 'grant-admin' || modal === 'remove-admin') && (
        <AdminKeyModal
          onConfirm={(key) => changeRole(modal === 'grant-admin' ? 'admin' : 'user', key)}
          onCancel={() => setModal(null)}
        />
      )}
      {modal === 'delete' && (
        <ConfirmModal
          message={`Permanently delete ${user?.name}'s account? This cannot be undone.`}
          onConfirm={deleteAccount}
          onCancel={() => setModal(null)}
          requireType="DELETE"
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 900 }}>

        {/* Back */}
        <button
          onClick={() => router.push('/users')}
          style={{
            alignSelf: 'flex-start', background: 'none', border: 'none',
            color: '#4f6ef7', fontSize: 13, fontWeight: 500, cursor: 'pointer',
            padding: 0, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          ← Back to Users
        </button>

        {/* ── Header card ─────────────────────────────────────────── */}
        <div style={{
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
          padding: '28px 28px', display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap',
        }}>
          <Avatar name={user?.name ?? ''} avatarUrl={user?.avatar_url} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: 0 }}>{user?.name}</h2>
              {user?.username && <span style={{ fontSize: 13, color: '#94a3b8' }}>@{user.username}</span>}
            </div>
            <p style={{ fontSize: 13, color: '#475569', margin: '0 0 12px' }}>{user?.email}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Badge
                label={user?.plan || 'free'}
                bg={user?.plan === 'lifetime' ? '#f5f3ff' : user?.plan === 'monthly' ? '#eef2ff' : '#f1f5f9'}
                color={user?.plan === 'lifetime' ? '#7c3aed' : user?.plan === 'monthly' ? '#4f6ef7' : '#64748b'}
              />
              <Badge
                label={user?.role || 'user'}
                bg={user?.role === 'admin' ? '#fee2e2' : '#f1f5f9'}
                color={user?.role === 'admin' ? '#dc2626' : '#475569'}
              />
              <Badge
                label={user?.is_pro ? 'Active' : 'Inactive'}
                bg={user?.is_pro ? '#d1fae5' : '#f1f5f9'}
                color={user?.is_pro ? '#059669' : '#94a3b8'}
              />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#94a3b8', flexShrink: 0 }}>
            <span>Joined: <strong style={{ color: '#475569' }}>{fmtDate(user?.created_at)}</strong></span>
            <span>Last login: <strong style={{ color: '#475569' }}>{fmtDateTime(user?.last_login_at)}</strong></span>
            <span>Login count: <strong style={{ color: '#475569' }}>{user?.login_count ?? 0}</strong></span>
          </div>
        </div>

        {/* ── Section 1: Subscription ──────────────────────────────── */}
        <SectionCard title="Subscription">
          {activeLicense ? (<>
            <Row label="Plan"         value={activeLicense.plan} />
            <Row label="Currency"     value={activeLicense.currency} />
            <Row label="Amount paid"  value={`${activeLicense.currency} ${Number(activeLicense.amount).toLocaleString()}`} />
            <Row label="Activated"    value={fmtDate(activeLicense.activated_at)} />
            <Row label="Expires"      value={activeLicense.expires_at ? fmtDate(activeLicense.expires_at) : 'Lifetime'} />
            <Row label="Device fingerprint" value={activeLicense.device_fingerprint ? '…' + activeLicense.device_fingerprint.slice(-12) : '—'} mono copyable={false} />
            <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
              <ActionBtn label="Revoke License" color="red" onClick={() => setModal('revoke')} />
            </div>
          </>) : data?.licenses?.length > 0 ? (<>
            <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 12px' }}>
              License is currently <strong style={{ color: '#dc2626' }}>revoked</strong>.
            </p>
            <ActionBtn label="Reactivate License" color="green" onClick={() => setModal('reactivate')} />
          </>) : (
            <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>No license found. Free tier user.</p>
          )}
        </SectionCard>

        {/* ── Section 2: Usage Stats ───────────────────────────────── */}
        <SectionCard title="Usage Stats">
          <Row label="Total sessions"   value={user?.sessions_used ?? '—'} />
          <Row label="Total responses"  value={user?.responses_used ?? '—'} />
          <Row label="Favourite type"   value={favType} />
          <Row label="Last session"     value={timeAgo(data?.sessions?.[0]?.started_at ?? null)} />
          {data?.sessions?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px', margin: '0 0 10px' }}>
                Last 5 Sessions
              </p>
              {data.sessions.slice(0, 5).map((s: any) => (
                <div key={s.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 0', borderBottom: '1px solid #f8fafc', fontSize: 13,
                }}>
                  <span style={{ color: '#0f172a', textTransform: 'capitalize' }}>{s.interview_type}</span>
                  <span style={{ color: '#94a3b8' }}>{s.total_questions} Qs · {fmtDate(s.started_at)}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* ── Section 3: Payment History ───────────────────────────── */}
        <SectionCard title="Payment History">
          {!data?.payments?.length ? (
            <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>No payments found.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    {['Date', 'Amount', 'Plan', 'Reference', 'Status'].map(h => (
                      <th key={h} style={{
                        padding: '8px 12px', textAlign: 'left', fontSize: 11,
                        fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase',
                        letterSpacing: '0.4px', borderBottom: '1px solid #f1f5f9',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.payments.map((p: any, i: number) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                      <td style={{ padding: '10px 12px', color: '#475569', whiteSpace: 'nowrap' }}>{fmtDate(p.created_at)}</td>
                      <td style={{ padding: '10px 12px', color: '#0f172a', fontWeight: 600 }}>
                        {p.currency} {Number(p.amount).toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#475569' }}>{p.plan}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11, color: '#64748b' }}>
                        <span
                          title={p.paystack_reference}
                          style={{ cursor: 'pointer' }}
                          onClick={() => copyText(p.paystack_reference)}
                        >
                          {p.paystack_reference ? p.paystack_reference.slice(0, 16) + '…' : '—'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                          background: p.status === 'success' ? '#d1fae5' : '#fee2e2',
                          color: p.status === 'success' ? '#059669' : '#dc2626',
                        }}>{p.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        {/* ── Section 4: Referrals ─────────────────────────────────── */}
        <SectionCard title="Referrals">
          {user?.referral_code ? (<>
            <Row
              label="Referral code"
              value={
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {user.referral_code}
                  <button onClick={() => copyText(user.referral_code)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 12 }}>⧉</button>
                </span>
              }
            />
            <Row label="People referred"     value={data?.referralStats?.total_referred ?? '—'} />
            <Row label="Total commission"    value={data?.referralStats?.total_earned ? `₦${Number(data.referralStats.total_earned).toLocaleString()}` : '—'} />
            <Row label="Pending balance"     value={data?.referralStats?.pending_balance ? `₦${Number(data.referralStats.pending_balance).toLocaleString()}` : '₦0'} />
          </>) : (
            <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>No referral data.</p>
          )}
        </SectionCard>

        {/* ── Section 5: Admin Actions ─────────────────────────────── */}
        <SectionCard title="Admin Actions">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Role toggle */}
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#475569', margin: '0 0 10px' }}>Role Management</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {user?.role !== 'admin'
                  ? <ActionBtn label="Grant Admin Role" color="blue" onClick={() => setModal('grant-admin')} />
                  : <ActionBtn label="Remove Admin Role" color="gray" onClick={() => setModal('remove-admin')} />
                }
              </div>
            </div>

            <div style={{ height: 1, background: '#f1f5f9' }} />

            {/* Danger zone */}
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', margin: '0 0 6px' }}>Danger Zone</p>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 12px' }}>
                These actions are irreversible. Proceed with caution.
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <ActionBtn label="Send Password Reset" color="gray" onClick={() => showToast('Password reset not yet implemented.')} />
                <ActionBtn label="Delete Account" color="red" onClick={() => setModal('delete')} />
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    </AdminLayout>
  );
}
