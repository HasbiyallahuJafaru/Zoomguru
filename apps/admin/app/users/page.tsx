'use client';
import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { AdminLayout } from '@/components/AdminLayout';

const API = process.env.NEXT_PUBLIC_API_URL!;
const LIMIT = 50;

const PLAN_STYLE: Record<string, { bg: string; color: string }> = {
  free:     { bg: '#f1f5f9', color: '#64748b' },
  monthly:  { bg: '#eef2ff', color: '#4f6ef7' },
  lifetime: { bg: '#f5f3ff', color: '#7c3aed' },
};

const ROLE_STYLE: Record<string, { bg: string; color: string }> = {
  user:  { bg: '#f1f5f9', color: '#475569' },
  admin: { bg: '#fee2e2', color: '#dc2626' },
};

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function Avatar({ name, avatarUrl, size = 34 }: { name: string; avatarUrl?: string; size?: number }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: '#eef2ff', color: '#4f6ef7',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 700,
    }}>
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  );
}

function Badge({ label, style }: { label: string; style: { bg: string; color: string } }) {
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
      background: style.bg, color: style.color,
    }}>
      {label}
    </span>
  );
}

function FilterSelect({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0',
        background: '#fff', color: '#0f172a', fontSize: 13,
        outline: 'none', cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export default function UsersPage() {
  const { data: session } = useSession();
  const token = (session?.user as any)?.accessToken;
  const router = useRouter();

  const [users, setUsers]     = useState<any[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);

  const [search, setSearch]   = useState('');
  const [plan, setPlan]       = useState('');
  const [role, setRole]       = useState('');

  const fetchUsers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page), limit: String(LIMIT),
      search, plan, role,
    });
    const res = await fetch(`${API}/admin/users?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users ?? []);
      setTotal(data.total ?? 0);
    }
    setLoading(false);
  }, [token, page, search, plan, role]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { setPage(1); }, [search, plan, role]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  function exportCSV() {
    if (!users.length) return;
    const headers = ['Name', 'Username', 'Email', 'Plan', 'Role', 'Joined', 'Last Active'];
    const rows = users.map(u => [
      u.name, u.username || '', u.email, u.plan || 'free', u.role,
      fmtDate(u.created_at), fmtDate(u.last_login_at),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `users-page-${page}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AdminLayout title="Users" onRefresh={fetchUsers}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Top bar ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>All Users</h2>
            {!loading && (
              <span style={{
                padding: '2px 10px', background: '#eef2ff', color: '#4f6ef7',
                borderRadius: 20, fontSize: 12, fontWeight: 700,
              }}>
                {total.toLocaleString()}
              </span>
            )}
          </div>
          <button
            onClick={exportCSV}
            style={{
              padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0',
              background: '#fff', color: '#475569', fontSize: 13, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            ↓ Export CSV
          </button>
        </div>

        {/* ── Filters ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search name, username, email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: '1 1 240px', padding: '8px 14px', borderRadius: 8,
              border: '1px solid #e2e8f0', background: '#fff',
              color: '#0f172a', fontSize: 13, outline: 'none', fontFamily: 'inherit',
            }}
          />
          <FilterSelect
            value={plan}
            onChange={setPlan}
            options={[
              { value: '', label: 'All Plans' },
              { value: 'free', label: 'Free' },
              { value: 'monthly', label: 'Monthly' },
              { value: 'lifetime', label: 'Lifetime' },
            ]}
          />
          <FilterSelect
            value={role}
            onChange={setRole}
            options={[
              { value: '', label: 'All Roles' },
              { value: 'user', label: 'User' },
              { value: 'admin', label: 'Admin' },
            ]}
          />
        </div>

        {/* ── Table ───────────────────────────────────────────────── */}
        <div style={{
          background: '#fff', border: '1px solid #e2e8f0',
          borderRadius: 12, overflow: 'hidden',
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 1 }}>
                  {['User', 'Email', 'Plan', 'Role', 'Joined', 'Last Active', ''].map(h => (
                    <th key={h} style={{
                      padding: '11px 16px', textAlign: 'left', fontSize: 11,
                      fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase',
                      letterSpacing: '0.4px', borderBottom: '1px solid #e2e8f0',
                      whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                        {Array.from({ length: 7 }).map((_, j) => (
                          <td key={j} style={{ padding: '14px 16px' }}>
                            <div style={{
                              height: 14, borderRadius: 4, background: '#f1f5f9',
                              width: j === 0 ? 140 : j === 6 ? 60 : 90,
                            }} />
                          </td>
                        ))}
                      </tr>
                    ))
                  : users.length === 0
                    ? (
                      <tr>
                        <td colSpan={7} style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
                          No users found
                        </td>
                      </tr>
                    )
                    : users.map(u => {
                        const planStyle = PLAN_STYLE[u.plan] || PLAN_STYLE.free;
                        const roleStyle = ROLE_STYLE[u.role] || ROLE_STYLE.user;
                        return (
                          <tr
                            key={u.id}
                            onClick={() => router.push(`/users/${u.id}`)}
                            style={{
                              borderBottom: '1px solid #f8fafc',
                              cursor: 'pointer',
                              transition: 'background 0.1s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            {/* User */}
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <Avatar name={u.name} avatarUrl={u.avatar_url} />
                                <div>
                                  <p style={{ margin: 0, fontWeight: 600, color: '#0f172a' }}>{u.name}</p>
                                  {u.username && (
                                    <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>@{u.username}</p>
                                  )}
                                </div>
                              </div>
                            </td>
                            {/* Email */}
                            <td style={{ padding: '12px 16px', color: '#475569', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {u.email}
                            </td>
                            {/* Plan */}
                            <td style={{ padding: '12px 16px' }}>
                              <Badge label={u.plan || 'free'} style={planStyle} />
                            </td>
                            {/* Role */}
                            <td style={{ padding: '12px 16px' }}>
                              <Badge label={u.role || 'user'} style={roleStyle} />
                            </td>
                            {/* Joined */}
                            <td style={{ padding: '12px 16px', color: '#64748b', whiteSpace: 'nowrap' }}>
                              {fmtDate(u.created_at)}
                            </td>
                            {/* Last active */}
                            <td style={{ padding: '12px 16px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                              {fmtDate(u.last_login_at)}
                            </td>
                            {/* Action */}
                            <td style={{ padding: '12px 16px' }}>
                              <button
                                onClick={e => { e.stopPropagation(); router.push(`/users/${u.id}`); }}
                                style={{
                                  padding: '5px 12px', borderRadius: 6,
                                  border: '1px solid #e2e8f0', background: '#fff',
                                  color: '#4f6ef7', fontSize: 12, fontWeight: 500,
                                  cursor: 'pointer', fontFamily: 'inherit',
                                }}
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        );
                      })
                }
              </tbody>
            </table>
          </div>

          {/* ── Pagination ──────────────────────────────────────── */}
          {totalPages > 1 && (
            <div style={{
              padding: '14px 20px', borderTop: '1px solid #f1f5f9',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 13, color: '#94a3b8' }}>
                Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} of {total}
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <PageBtn label="← Prev" disabled={page === 1} onClick={() => setPage(p => p - 1)} />
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  const p = i + 1;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      style={{
                        width: 32, height: 32, borderRadius: 6,
                        border: '1px solid ' + (page === p ? '#4f6ef7' : '#e2e8f0'),
                        background: page === p ? '#4f6ef7' : '#fff',
                        color: page === p ? '#fff' : '#475569',
                        fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >{p}</button>
                  );
                })}
                <PageBtn label="Next →" disabled={page === totalPages} onClick={() => setPage(p => p + 1)} />
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

function PageBtn({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '5px 12px', borderRadius: 6, border: '1px solid #e2e8f0',
        background: '#fff', color: disabled ? '#cbd5e1' : '#475569',
        fontSize: 13, cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit',
      }}
    >{label}</button>
  );
}
