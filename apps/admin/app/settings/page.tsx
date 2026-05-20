'use client';
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { AdminLayout } from '@/components/AdminLayout';

const API = process.env.NEXT_PUBLIC_API_URL!;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');
}

// ─── Shared primitives ───────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13,
  border: '1px solid #e2e8f0', outline: 'none', background: '#fff',
  color: '#0f172a', boxSizing: 'border-box', fontFamily: 'inherit',
};

const readonlyStyle: React.CSSProperties = {
  ...inputStyle, background: '#f8fafc', color: '#64748b', cursor: 'default',
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 5 }}>
      {children}
    </label>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
      padding: '28px 32px', marginBottom: 24,
    }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>{title}</h2>
      {subtitle && <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 22px' }}>{subtitle}</p>}
      {!subtitle && <div style={{ marginBottom: 20 }} />}
      {children}
    </div>
  );
}

function Btn({
  onClick, disabled, variant = 'primary', children,
}: { onClick?: () => void; disabled?: boolean; variant?: 'primary' | 'danger' | 'ghost'; children: React.ReactNode }) {
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: '#4f6ef7', color: '#fff', border: 'none' },
    danger:  { background: '#fff', color: '#dc2626', border: '1px solid #fca5a5' },
    ghost:   { background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...styles[variant],
        padding: '8px 18px', borderRadius: 7, fontSize: 13, fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  );
}

function Toast({ msg, type }: { msg: string; type: 'ok' | 'err' }) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 999,
      background: type === 'ok' ? '#dcfce7' : '#fee2e2',
      color: type === 'ok' ? '#166534' : '#dc2626',
      border: `1px solid ${type === 'ok' ? '#86efac' : '#fca5a5'}`,
      borderRadius: 8, padding: '12px 18px', fontSize: 13, fontWeight: 500,
      boxShadow: '0 4px 20px rgba(0,0,0,0.1)', maxWidth: 320,
    }}>
      {type === 'ok' ? '✓ ' : '✕ '}{msg}
    </div>
  );
}

// ─── Info rows for read-only sections ────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 12,
      padding: '10px 0', borderBottom: '1px solid #f1f5f9',
    }}>
      <span style={{ fontSize: 13, color: '#64748b', minWidth: 180, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: '#0f172a', fontWeight: 500, fontFamily: 'monospace' }}>{value}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { data: session, status, update: updateSession } = useSession();
  const router = useRouter();

  const me = session?.user as any;
  const token = me?.accessToken;
  const myId = me?.id;

  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  function flash(msg: string, type: 'ok' | 'err' = 'ok') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  // ── Section 1 state ─────────────────────────────────────────────────────────
  const [name, setName] = useState(me?.name ?? '');
  const [savingName, setSavingName] = useState(false);

  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confPw, setConfPw] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => { setName(me?.name ?? ''); }, [me?.name]);

  async function saveName() {
    if (!name.trim()) return;
    setSavingName(true);
    try {
      const r = await fetch(`${API}/auth/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!r.ok) throw new Error((await r.json()).message ?? `HTTP ${r.status}`);
      await updateSession({ name: name.trim() });
      flash('Name updated');
    } catch (e: any) {
      flash(e.message, 'err');
    } finally {
      setSavingName(false);
    }
  }

  async function changePassword() {
    if (newPw !== confPw) { flash('Passwords do not match', 'err'); return; }
    if (newPw.length < 8) { flash('New password must be at least 8 characters', 'err'); return; }
    setSavingPw(true);
    try {
      const r = await fetch(`${API}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: curPw, newPassword: newPw }),
      });
      if (!r.ok) throw new Error((await r.json()).message ?? `HTTP ${r.status}`);
      setCurPw(''); setNewPw(''); setConfPw('');
      flash('Password changed');
    } catch (e: any) {
      flash(e.message, 'err');
    } finally {
      setSavingPw(false);
    }
  }

  // ── Section 2 state ─────────────────────────────────────────────────────────
  const [admins, setAdmins] = useState<any[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const [addSearch, setAddSearch] = useState('');
  const [addResults, setAddResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [grantingId, setGrantingId] = useState<string | null>(null);

  const loadAdmins = useCallback(async () => {
    if (!token) return;
    setAdminsLoading(true);
    try {
      const r = await fetch(`${API}/admin/users?role=admin&limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      setAdmins(json.users ?? []);
    } catch (e: any) {
      flash(e.message, 'err');
    } finally {
      setAdminsLoading(false);
    }
  }, [token]);

  useEffect(() => { loadAdmins(); }, [loadAdmins]);

  async function removeAdmin(id: string) {
    if (!confirm('Remove admin access from this user?')) return;
    setRemovingId(id);
    try {
      const r = await fetch(`${API}/admin/users/${id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role: 'user' }),
      });
      if (!r.ok) throw new Error((await r.json()).message ?? `HTTP ${r.status}`);
      flash('Admin access removed');
      loadAdmins();
    } catch (e: any) {
      flash(e.message, 'err');
    } finally {
      setRemovingId(null);
    }
  }

  async function searchUsers() {
    if (!addSearch.trim()) return;
    setSearching(true);
    try {
      const r = await fetch(`${API}/admin/users?search=${encodeURIComponent(addSearch)}&limit=5`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      setAddResults((json.users ?? []).filter((u: any) => u.role !== 'admin'));
    } catch (e: any) {
      flash(e.message, 'err');
    } finally {
      setSearching(false);
    }
  }

  async function grantAdmin(id: string) {
    setGrantingId(id);
    try {
      const r = await fetch(`${API}/admin/users/${id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role: 'admin' }),
      });
      if (!r.ok) throw new Error((await r.json()).message ?? `HTTP ${r.status}`);
      flash('Admin access granted');
      setAddSearch(''); setAddResults([]);
      loadAdmins();
    } catch (e: any) {
      flash(e.message, 'err');
    } finally {
      setGrantingId(null);
    }
  }

  if (status === 'loading') {
    return <AdminLayout><div style={{ padding: 40, color: '#64748b', fontSize: 14 }}>Loading…</div></AdminLayout>;
  }

  return (
    <AdminLayout>
      <div style={{ padding: '32px 40px', maxWidth: 820, margin: '0 auto' }}>

        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', margin: 0 }}>Settings</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Admin account and system configuration</p>
        </div>

        {/* ── SECTION 1 — Your Admin Account ────────────────────────────── */}
        <SectionCard title="Your Admin Account">

          {/* Avatar + name row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 24 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: '#eef2ff', color: '#4f6ef7',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, fontWeight: 700, flexShrink: 0,
            }}>
              {initials(me?.name ?? me?.email ?? '?')}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{me?.name ?? '—'}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{me?.email}</div>
              <div style={{ fontSize: 11, marginTop: 3 }}>
                <span style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 4, padding: '1px 7px', fontWeight: 600 }}>
                  admin
                </span>
              </div>
            </div>
          </div>

          {/* Editable name */}
          <div style={{ maxWidth: 400 }}>
            <Field label="Display Name">
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  style={inputStyle}
                  onKeyDown={e => e.key === 'Enter' && saveName()}
                />
                <Btn onClick={saveName} disabled={savingName || !name.trim()}>
                  {savingName ? 'Saving…' : 'Save'}
                </Btn>
              </div>
            </Field>

            <Field label="Email">
              <input value={me?.email ?? ''} readOnly style={readonlyStyle} />
            </Field>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid #f1f5f9', margin: '8px 0 22px' }} />

          {/* Change password */}
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: '0 0 16px' }}>Change Password</h3>
          <div style={{ maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 0 }}>
            <Field label="Current Password">
              <input
                type="password" value={curPw}
                onChange={e => setCurPw(e.target.value)}
                style={inputStyle} autoComplete="current-password"
              />
            </Field>
            <Field label="New Password">
              <input
                type="password" value={newPw}
                onChange={e => setNewPw(e.target.value)}
                style={inputStyle} autoComplete="new-password"
              />
            </Field>
            <Field label="Confirm New Password">
              <input
                type="password" value={confPw}
                onChange={e => setConfPw(e.target.value)}
                style={inputStyle} autoComplete="new-password"
                onKeyDown={e => e.key === 'Enter' && changePassword()}
              />
            </Field>
            <div>
              <Btn
                onClick={changePassword}
                disabled={savingPw || !curPw || !newPw || !confPw}
              >
                {savingPw ? 'Updating…' : 'Update Password'}
              </Btn>
            </div>
          </div>
        </SectionCard>

        {/* ── SECTION 2 — Admin Management ─────────────────────────────── */}
        <SectionCard title="Admin Management" subtitle="Users with admin role have full access to all data and financials.">

          {/* Admins table */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', marginBottom: 28 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Username', 'Email', 'Last Login', 'Actions'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: '#64748b', fontWeight: 600, fontSize: 12, borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {adminsLoading ? (
                  <tr><td colSpan={4} style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Loading admins…</td></tr>
                ) : admins.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No admins found</td></tr>
                ) : admins.map(a => {
                  const isMe = a.id === myId;
                  return (
                    <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9', background: isMe ? '#fafbff' : undefined }}>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: '50%',
                            background: '#eef2ff', color: '#4f6ef7',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 700, flexShrink: 0,
                          }}>
                            {initials(a.name ?? a.username ?? '?')}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>@{a.username}</div>
                            {isMe && <div style={{ fontSize: 10, color: '#4f6ef7', fontWeight: 600 }}>you</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '11px 14px', color: '#475569' }}>{a.email}</td>
                      <td style={{ padding: '11px 14px', color: '#64748b' }}>{fmtDate(a.last_login_at)}</td>
                      <td style={{ padding: '11px 14px' }}>
                        {isMe ? (
                          <span style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>Cannot remove yourself</span>
                        ) : (
                          <Btn
                            variant="danger"
                            onClick={() => removeAdmin(a.id)}
                            disabled={removingId === a.id}
                          >
                            {removingId === a.id ? 'Removing…' : 'Remove Admin'}
                          </Btn>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Add admin */}
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: '0 0 12px' }}>Add Admin</h3>
          <div style={{
            background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8,
            padding: '10px 14px', fontSize: 12, color: '#92400e', marginBottom: 16,
            display: 'flex', gap: 8, alignItems: 'flex-start',
          }}>
            <span style={{ fontSize: 15, flexShrink: 0 }}>⚠️</span>
            <span>This gives full access to all user data and financial information. Only grant admin access to trusted team members.</span>
          </div>
          <div style={{ display: 'flex', gap: 8, maxWidth: 480, marginBottom: 12 }}>
            <input
              value={addSearch}
              onChange={e => setAddSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchUsers()}
              placeholder="Search by email or username…"
              style={{ ...inputStyle, flex: 1 }}
            />
            <Btn onClick={searchUsers} disabled={searching || !addSearch.trim()} variant="ghost">
              {searching ? 'Searching…' : 'Search'}
            </Btn>
          </div>
          {addResults.length > 0 && (
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', maxWidth: 480 }}>
              {addResults.map((u, i) => (
                <div key={u.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', borderBottom: i < addResults.length - 1 ? '1px solid #f1f5f9' : undefined,
                  background: '#fff',
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>@{u.username}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{u.email}</div>
                  </div>
                  <Btn
                    onClick={() => grantAdmin(u.id)}
                    disabled={grantingId === u.id}
                  >
                    {grantingId === u.id ? 'Granting…' : 'Grant Admin'}
                  </Btn>
                </div>
              ))}
            </div>
          )}
          {addResults.length === 0 && addSearch && !searching && (
            <p style={{ fontSize: 13, color: '#94a3b8', margin: '8px 0 0' }}>
              No non-admin users found matching "{addSearch}"
            </p>
          )}
        </SectionCard>

        {/* ── SECTION 3 — System Configuration ──────────────────────────── */}
        <SectionCard title="System Configuration" subtitle="Read-only. Modify via environment variables and deployment config.">
          <div style={{ borderTop: '1px solid #f1f5f9' }}>
            <InfoRow label="Backend API" value="api.zoomguru.com" />
            <InfoRow label="Landing page" value="zoomguru.com" />
            <InfoRow label="Admin dashboard" value="admin.zoomguru.com" />
            <InfoRow label="Database" value="Neon PostgreSQL (serverless)" />
            <InfoRow label="AI — conversational" value="DeepSeek V3 (deepseek-chat)" />
            <InfoRow label="AI — reasoning" value="DeepSeek R1 (deepseek-reasoner)" />
            <InfoRow label="AI — vision" value="DeepSeek V3 multimodal" />
            <InfoRow label="Speech-to-text" value="Whisper tiny (local ONNX)" />
            <InfoRow label="Wake word" value="Porcupine (local)" />
            <InfoRow label="Payments" value="Paystack (NGN + USD)" />
            <InfoRow label="Desktop hosting" value="electron-builder (.exe / .dmg)" />
            <InfoRow label="Backend hosting" value="Render" />
            <InfoRow label="Landing hosting" value="Netlify" />
            <InfoRow label="CDN / Protection" value="Cloudflare Free" />
          </div>
        </SectionCard>

        {/* ── SECTION 4 — Pricing Configuration ─────────────────────────── */}
        <SectionCard title="Pricing Configuration" subtitle="Display only. Update pricing in Paystack and your codebase constants.">
          <div style={{ borderTop: '1px solid #f1f5f9', marginBottom: 20 }}>
            <InfoRow label="NGN Monthly" value="₦15,000 / month" />
            <InfoRow label="NGN Lifetime" value="₦100,000 one-time" />
            <InfoRow label="USD Monthly" value="$12 / month" />
            <InfoRow label="USD Lifetime" value="$79 one-time" />
            <InfoRow label="Free tier sessions" value="3 sessions · 10 responses each" />
            <InfoRow label="Free tier features" value="No screenshot · No wake word" />
          </div>
          <div style={{
            background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8,
            padding: '12px 16px', fontSize: 12, color: '#64748b', lineHeight: 1.6,
          }}>
            To update pricing: modify Paystack plans in your Paystack dashboard, then update the{' '}
            <code style={{ background: '#e2e8f0', padding: '1px 5px', borderRadius: 3, fontSize: 11 }}>PRICES</code>{' '}
            constant in{' '}
            <code style={{ background: '#e2e8f0', padding: '1px 5px', borderRadius: 3, fontSize: 11 }}>Pricing.tsx</code>{' '}
            and the backend payment validation logic.
          </div>
        </SectionCard>

      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </AdminLayout>
  );
}
