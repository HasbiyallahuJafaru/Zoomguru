'use client';
import { useSession, signOut } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect } from 'react';

const NAV = [
  { label: 'Overview',     href: '/dashboard',              icon: '⊡' },
  { label: 'Subscription', href: '/dashboard/subscription', icon: '◈' },
  { label: 'Payments',     href: '/dashboard/payments',     icon: '◎' },
  { label: 'Sessions',     href: '/dashboard/sessions',     icon: '▣' },
  { label: 'Referrals',    href: '/dashboard/referrals',    icon: '◇' },
  { label: 'Settings',     href: '/dashboard/settings',     icon: '◉' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafaf8' }}>
        <div style={{ color: '#999', fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  if (!session) return null;

  const user = session.user as any;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#fafaf8', overflow: 'hidden', maxWidth: '100vw' }}>

      {/* Sidebar */}
      <aside style={{
        width: 240, flexShrink: 0,
        background: '#fff',
        borderRight: '1px solid #e5e5e5',
        display: 'flex', flexDirection: 'column',
        padding: '24px 0',
        position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 40,
      }} className="dashboard-sidebar">

        {/* Logo + user */}
        <div style={{ padding: '0 20px 24px', borderBottom: '1px solid #f0f0f0' }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'block', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: '#fff', fontWeight: 900, fontSize: 13 }}>Z</span>
              </div>
              <span style={{ fontWeight: 700, fontSize: 16, color: '#111', letterSpacing: '-0.3px' }}>
                Zoom<span style={{ color: '#888' }}>Guru</span>
              </span>
            </div>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: user.image ? 'transparent' : '#f0f0f0',
              border: '1.5px solid #e5e5e5',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', flexShrink: 0,
            }}>
              {user.image
                ? <img src={user.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: 14, color: '#555', fontWeight: 600 }}>
                    {(user.name || user.username || 'U')[0].toUpperCase()}
                  </span>
              }
            </div>
            <div style={{ overflow: 'hidden' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.name || user.username}
              </p>
              <p style={{ fontSize: 11, color: '#888', marginTop: 1 }}>
                {user.isPro ? '✦ Pro' : 'Free plan'}
              </p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map(({ label, href, icon }) => {
            const active = pathname === href;
            return (
              <Link key={href} href={href} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 10px', borderRadius: 8, textDecoration: 'none',
                color: active ? '#111' : '#666',
                background: active ? '#f5f5f3' : 'transparent',
                fontSize: 14, fontWeight: active ? 600 : 400,
                borderLeft: active ? '2px solid #111' : '2px solid transparent',
                transition: 'background 0.12s, color 0.12s',
              }}>
                <span style={{ fontSize: 15, opacity: 0.7 }}>{icon}</span>
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Sign out */}
        <div style={{ padding: '16px 12px', borderTop: '1px solid #f0f0f0' }}>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 10px', borderRadius: 8,
              background: 'transparent', border: 'none',
              color: '#999', fontSize: 14, cursor: 'pointer',
              textAlign: 'left', fontFamily: 'inherit',
              transition: 'color 0.12s, background 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#e53e3e'; e.currentTarget.style.background = '#fff5f5'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#999'; e.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{ fontSize: 15 }}>⎋</span>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, marginLeft: 240, padding: '32px', minHeight: '100vh', overflowX: 'hidden', maxWidth: '100%', boxSizing: 'border-box' }} className="dashboard-main">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="dashboard-bottom-nav" style={{
        display: 'none', position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid #e5e5e5',
        padding: '8px 0 12px', zIndex: 40,
        justifyContent: 'space-around',
      }}>
        {NAV.map(({ label, href, icon }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              textDecoration: 'none',
              color: active ? '#111' : '#999',
              fontSize: 10, fontWeight: active ? 600 : 400, padding: '4px 6px',
            }}>
              <span style={{ fontSize: 17 }}>{icon}</span>
              {label}
            </Link>
          );
        })}
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            color: '#e53e3e', fontSize: 10, fontWeight: 400, padding: '4px 6px',
          }}
        >
          <span style={{ fontSize: 17 }}>⎋</span>
          Sign Out
        </button>
      </nav>

      <style>{`
        @media (max-width: 768px) {
          .dashboard-sidebar { display: none !important; }
          .dashboard-main { margin-left: 0 !important; padding: 20px 16px 80px !important; }
          .dashboard-bottom-nav { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
