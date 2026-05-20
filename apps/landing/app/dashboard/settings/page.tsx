'use client';
export const dynamic = 'force-dynamic';
import { useSession } from 'next-auth/react';
import { useEffect, useState, useCallback } from 'react';
import { signOut } from 'next-auth/react';

interface DeviceInfo {
  deviceFingerprint: string | null;
  lockedSince: string | null;
  plan: string;
}

export default function SettingsPage() {
  const { data: session, update: updateSession } = useSession();
  const user = session?.user as any;

  const [profile, setProfile] = useState({ name: '', username: '' });
  const [profileMsg, setProfileMsg] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);

  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'taken' | 'available'>('idle');

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const isGoogle = !!(user as any)?.image && !(user as any)?.accessToken?.startsWith?.('ey');

  useEffect(() => {
    if (user) setProfile({ name: user.name || '', username: user.username || '' });
  }, [user]);

  useEffect(() => {
    if (!user?.accessToken) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/user/device`, {
      headers: { Authorization: `Bearer ${user.accessToken}` },
    }).then(r => r.ok ? r.json() : null).then(d => d && setDevice(d));
  }, [user?.accessToken]);

  const checkUsername = useCallback(async (username: string) => {
    if (username === user?.username || username.length < 3) { setUsernameStatus('idle'); return; }
    setUsernameStatus('checking');
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/check-username?username=${encodeURIComponent(username)}`);
    const d = await res.json();
    setUsernameStatus(d.available ? 'available' : 'taken');
  }, [user?.username]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.accessToken) return;
    if (usernameStatus === 'taken') { setProfileMsg('Username is already taken.'); return; }
    setProfileLoading(true);
    setProfileMsg('');
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/user/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.accessToken}` },
      body: JSON.stringify({ name: profile.name, username: profile.username }),
    });
    const data = await res.json();
    setProfileLoading(false);
    if (res.ok) {
      setProfileMsg('Profile updated successfully.');
      await updateSession({ name: profile.name, username: profile.username });
    } else {
      setProfileMsg(data.message || 'Failed to update profile.');
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (passwords.next !== passwords.confirm) { setPwMsg('Passwords do not match.'); return; }
    if (passwords.next.length < 8) { setPwMsg('Password must be at least 8 characters.'); return; }
    if (!user?.accessToken) return;
    setPwLoading(true);
    setPwMsg('');
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/user/password`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.accessToken}` },
      body: JSON.stringify({ currentPassword: passwords.current, newPassword: passwords.next }),
    });
    const data = await res.json();
    setPwLoading(false);
    if (res.ok) {
      setPwMsg('Password changed successfully.');
      setPasswords({ current: '', next: '', confirm: '' });
    } else {
      setPwMsg(data.message || 'Failed to change password.');
    }
  }

  async function deleteAccount() {
    if (!user?.accessToken || deleteConfirm !== 'DELETE') return;
    setDeleteLoading(true);
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/user/account`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${user.accessToken}` },
    });
    if (res.ok) await signOut({ callbackUrl: '/' });
    else { setDeleteLoading(false); setShowDeleteModal(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '600px' }}>

      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#fff', letterSpacing: '-0.3px' }}>Settings</h1>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '14px', marginTop: '4px' }}>Manage your profile and account</p>
      </div>

      {/* ── Section 1: Profile ── */}
      <Section title="Profile">
        <form onSubmit={saveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
            <div style={{
              width: '60px', height: '60px', borderRadius: '50%',
              background: user?.image ? 'transparent' : 'rgba(79,110,247,0.2)',
              border: '2px solid rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', flexShrink: 0,
            }}>
              {user?.image
                ? <img src={user.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: '24px', color: '#4f6ef7', fontWeight: 700 }}>
                    {(user?.name || user?.username || 'U')[0].toUpperCase()}
                  </span>
              }
            </div>
            <div>
              <p style={{ fontSize: '14px', fontWeight: 600, color: '#e8e8e8' }}>{user?.name}</p>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)' }}>{user?.email}</p>
            </div>
          </div>

          <SettingField label="Full Name" value={profile.name} onChange={v => setProfile(f => ({ ...f, name: v }))} placeholder="Your full name" />

          {/* Username with availability */}
          <div>
            <label style={labelStyle}>Username</label>
            <div style={{ position: 'relative' }}>
              <input
                value={profile.username}
                onChange={e => {
                  setProfile(f => ({ ...f, username: e.target.value }));
                  setUsernameStatus('idle');
                  clearTimeout((window as any)._uTimer);
                  (window as any)._uTimer = setTimeout(() => checkUsername(e.target.value), 500);
                }}
                placeholder="yourname"
                style={{
                  ...inputStyle,
                  borderColor: usernameStatus === 'taken' ? 'rgba(239,68,68,0.5)'
                    : usernameStatus === 'available' ? 'rgba(16,185,129,0.5)'
                    : 'rgba(255,255,255,0.1)',
                  paddingRight: '36px',
                }}
                onFocus={e => { if (usernameStatus === 'idle') e.currentTarget.style.borderColor = 'rgba(79,110,247,0.5)'; }}
                onBlur={e => { if (usernameStatus === 'idle') e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
              />
              <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px' }}>
                {usernameStatus === 'checking' && <span style={{ color: 'rgba(255,255,255,0.3)' }}>…</span>}
                {usernameStatus === 'available' && <span style={{ color: '#10b981' }}>✓</span>}
                {usernameStatus === 'taken' && <span style={{ color: '#ef4444' }}>✗</span>}
              </span>
            </div>
          </div>

          <SettingField label="Email" value={user?.email || ''} onChange={() => {}} placeholder="" readOnly />

          <Msg text={profileMsg} />
          <SubmitBtn label="Save Profile" loading={profileLoading} />
        </form>
      </Section>

      {/* ── Section 2: Security ── */}
      <Section title="Security">
        {isGoogle ? (
          <div style={{ padding: '14px 16px', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)', fontSize: '14px' }}>
            You signed in with Google — no password to manage.
          </div>
        ) : (
          <form onSubmit={changePassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <SettingField label="Current Password" value={passwords.current} onChange={v => setPasswords(f => ({ ...f, current: v }))} type="password" placeholder="••••••••" />
            <SettingField label="New Password" value={passwords.next} onChange={v => setPasswords(f => ({ ...f, next: v }))} type="password" placeholder="Min. 8 characters" />
            <SettingField label="Confirm New Password" value={passwords.confirm} onChange={v => setPasswords(f => ({ ...f, confirm: v }))} type="password" placeholder="••••••••" />
            <Msg text={pwMsg} />
            <SubmitBtn label="Change Password" loading={pwLoading} />
          </form>
        )}
      </Section>

      {/* ── Section 3: Device ── */}
      <Section title="Device License">
        {device?.deviceFingerprint ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <InfoRow label="Device fingerprint">
              <code style={{ fontFamily: 'monospace', fontSize: '13px', color: 'rgba(255,255,255,0.55)', background: 'rgba(255,255,255,0.05)', padding: '3px 10px', borderRadius: '6px' }}>
                …{device.deviceFingerprint.slice(-8)}
              </code>
            </InfoRow>
            <InfoRow label="Plan">
              <span style={{ fontSize: '14px', color: '#e8e8e8', textTransform: 'capitalize' }}>{device.plan}</span>
            </InfoRow>
            {device.lockedSince && (
              <InfoRow label="Locked since">
                <span style={{ fontSize: '14px', color: '#e8e8e8' }}>
                  {new Date(device.lockedSince).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              </InfoRow>
            )}
            <div style={{ marginTop: '4px', padding: '12px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', fontSize: '13px', color: 'rgba(255,255,255,0.35)' }}>
              To transfer your license to a new device, contact{' '}
              <a href="mailto:support@zoomguru.com" style={{ color: '#4f6ef7', textDecoration: 'none' }}>support@zoomguru.com</a>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.35)' }}>
            No device bound yet. Download the app and sign in to bind your license.
          </div>
        )}
      </Section>

      {/* ── Section 4: Danger Zone ── */}
      <Section title="Danger Zone" danger>
        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.45)', marginBottom: '16px' }}>
          This permanently deletes all your data and cancels your subscription. This cannot be undone.
        </p>
        <button
          onClick={() => setShowDeleteModal(true)}
          style={{
            padding: '10px 20px', borderRadius: '10px',
            border: '1px solid rgba(239,68,68,0.35)',
            background: 'rgba(239,68,68,0.08)',
            color: '#f87171', fontSize: '14px', fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Delete Account
        </button>
      </Section>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: '20px',
        }}>
          <div className="glass-dark" style={{ borderRadius: '16px', padding: '32px', maxWidth: '400px', width: '100%' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f87171', marginBottom: '12px' }}>Delete Account</h3>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.55)', marginBottom: '20px' }}>
              Type <strong style={{ color: '#fff' }}>DELETE</strong> to confirm. This is irreversible.
            </p>
            <input
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder="DELETE"
              style={{ ...inputStyle, marginBottom: '16px' }}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => { setShowDeleteModal(false); setDeleteConfirm(''); }} style={{
                flex: 1, padding: '11px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)',
                background: 'transparent', color: '#e8e8e8', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit',
              }}>Cancel</button>
              <button
                onClick={deleteAccount}
                disabled={deleteConfirm !== 'DELETE' || deleteLoading}
                style={{
                  flex: 1, padding: '11px', borderRadius: '10px', border: 'none',
                  background: deleteConfirm === 'DELETE' ? '#ef4444' : 'rgba(239,68,68,0.3)',
                  color: '#fff', fontSize: '14px', fontWeight: 600,
                  cursor: deleteConfirm === 'DELETE' ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit', opacity: deleteLoading ? 0.7 : 1,
                }}
              >{deleteLoading ? 'Deleting…' : 'Delete Forever'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children, danger }: { title: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <div>
      <h2 style={{
        fontSize: '14px', fontWeight: 600, marginBottom: '14px',
        color: danger ? 'rgba(239,68,68,0.7)' : 'rgba(255,255,255,0.5)',
        textTransform: 'uppercase', letterSpacing: '0.5px',
      }}>{title}</h2>
      <div className="glass" style={{
        borderRadius: '14px', padding: '24px',
        border: danger ? '1px solid rgba(239,68,68,0.15)' : undefined,
      }}>
        {children}
      </div>
    </div>
  );
}

function SettingField({ label, value, onChange, placeholder, type = 'text', readOnly }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; readOnly?: boolean;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        type={type} value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        style={{ ...inputStyle, opacity: readOnly ? 0.5 : 1, cursor: readOnly ? 'not-allowed' : 'text' }}
        onFocus={e => { if (!readOnly) e.currentTarget.style.borderColor = 'rgba(79,110,247,0.5)'; }}
        onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
      />
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
      <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>{label}</span>
      {children}
    </div>
  );
}

function Msg({ text }: { text: string }) {
  if (!text) return null;
  const ok = text.toLowerCase().includes('success');
  return (
    <div style={{
      padding: '10px 14px', borderRadius: '8px', fontSize: '13px',
      background: ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
      border: `1px solid ${ok ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
      color: ok ? '#10b981' : '#f87171',
    }}>{text}</div>
  );
}

function SubmitBtn({ label, loading }: { label: string; loading: boolean }) {
  return (
    <button type="submit" disabled={loading} className="btn-shimmer" style={{
      padding: '11px 24px', borderRadius: '10px', border: 'none',
      fontSize: '14px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
      opacity: loading ? 0.7 : 1, fontFamily: 'inherit', alignSelf: 'flex-start',
    }}>
      {loading ? 'Saving…' : label}
    </button>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '13px', color: 'rgba(255,255,255,0.45)',
  marginBottom: '6px', fontWeight: 500,
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: '9px',
  color: '#e8e8e8', fontSize: '14px', outline: 'none',
  fontFamily: 'inherit', transition: 'border-color 0.2s',
};
