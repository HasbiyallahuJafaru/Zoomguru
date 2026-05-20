'use client';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';

const NAV = [
  { href: '/',          label: 'Overview',  icon: '📊' },
  { href: '/users',     label: 'Users',     icon: '👥' },
  { href: '/revenue',   label: 'Revenue',   icon: '💰' },
  { href: '/sessions',  label: 'Sessions',  icon: '🎯' },
  { href: '/referrals', label: 'Referrals', icon: '🔗' },
  { href: '/payouts',   label: 'Payouts',   icon: '💸' },
  { href: '/errors',    label: 'Errors',    icon: '⚠️'  },
  { href: '/settings',  label: 'Settings',  icon: '⚙️'  },
];

interface Props {
  title: string;
  children: React.ReactNode;
  onRefresh?: () => void;
}

export function AdminLayout({ title, children, onRefresh }: Props) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [lastUpdated] = useState(() => new Date().toLocaleTimeString());
  const user = session?.user as any;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'var(--font)' }}>

      {/* ── Sidebar ───────────────────────────────────────────────── */}
      <aside style={{
        width: 240,
        flexShrink: 0,
        background: 'var(--bg)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 10,
      }}>

        {/* Logo + badge */}
        <div style={{
          padding: '20px 20px 16px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px' }}>
              ZoomGuru
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 7px',
              background: 'var(--accent)', color: '#fff',
              borderRadius: 4, letterSpacing: '0.5px',
            }}>
              ADMIN
            </span>
          </div>
        </div>

        {/* Admin user */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'var(--accent-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, fontWeight: 700, color: 'var(--accent)', flexShrink: 0,
          }}>
            {user?.name?.[0]?.toUpperCase() || 'A'}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.name || 'Admin'}
            </p>
            <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email || ''}
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
          {NAV.map(({ href, label, icon }) => {
            const isActive = href === '/'
              ? pathname === '/'
              : pathname.startsWith(href);
            return (
              <Link key={href} href={href} style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 20px', margin: '1px 8px', borderRadius: 8,
                  background: isActive ? 'var(--accent)' : 'transparent',
                  color: isActive ? '#fff' : 'var(--text2)',
                  fontSize: 13.5, fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer', transition: 'all 0.12s',
                }}>
                  <span style={{ fontSize: 15 }}>{icon}</span>
                  {label}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Sign out */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            style={{
              width: '100%', padding: '9px 12px',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 8, color: 'var(--text2)',
              fontSize: 13, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
              fontFamily: 'var(--font)',
            }}
          >
            <span>🚪</span> Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main area ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, marginLeft: 240, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

        {/* Top bar */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 9,
          background: 'var(--bg)',
          borderBottom: '1px solid var(--border)',
          padding: '0 32px',
          height: 60,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            {title}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              Last updated: {lastUpdated}
            </span>
            {onRefresh && (
              <button
                onClick={onRefresh}
                style={{
                  padding: '7px 14px', borderRadius: 8,
                  background: 'var(--accent-light)',
                  border: '1px solid rgba(79,110,247,0.2)',
                  color: 'var(--accent)', fontSize: 13, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'var(--font)',
                }}
              >
                ↻ Refresh
              </button>
            )}
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, padding: 32, background: 'var(--surface)' }}>
          {children}
        </main>
      </div>
    </div>
  );
}
