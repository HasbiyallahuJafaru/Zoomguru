'use client';
export const dynamic = 'force-dynamic';
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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>Loading…</div>
      </div>
    );
  }

  if (!session) return null;

  const user = session.user as any;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>

      {/* ── Sidebar (desktop) ───────────────────────── */}
      <aside style={{
        width: '240px',
        flexShrink: 0,
        background: 'rgba(255,255,255,0.03)',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 0',
        position: 'fixed',
        top: 0,
        left: 0,
        height: '100vh',
        zIndex: 40,
      }} className="dashboard-sidebar">

        {/* Logo + user */}
        <div style={{ padding: '0 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <span style={{ fontSize: '20px', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>
              Zoom<span style={{ color: '#4f6ef7' }}>Guru</span>
            </span>
          </Link>
          <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '34px', height: '34px', borderRadius: '50%',
              background: user.image ? 'transparent' : 'rgba(79,110,247,0.3)',
              border: '1px solid rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', flexShrink: 0,
            }}>
              {user.image
                ? <img src={user.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: '14px', color: '#4f6ef7', fontWeight: 600 }}>
                    {(user.name || user.username || 'U')[0].toUpperCase()}
                  </span>
              }
            </div>
            <div style={{ overflow: 'hidden' }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#e8e8e8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.name || user.username}
              </p>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: '1px' }}>
                {user.isPro ? '✦ Pro' : 'Free plan'}
              </p>
            </div>
          </div>
        </div>

        {/* Nav links */}
        <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {NAV.map(({ label, href, icon }) => {
            const active = pathname === href;
            return (
              <Link key={href} href={href} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '9px 10px',
                borderRadius: '8px',
                textDecoration: 'none',
                color: active ? '#fff' : 'rgba(255,255,255,0.45)',
                background: active ? 'rgba(79,110,247,0.15)' : 'transparent',
                fontSize: '14px',
                fontWeight: active ? 600 : 400,
                transition: 'background 0.15s, color 0.15s',
                borderLeft: active ? '2px solid #4f6ef7' : '2px solid transparent',
              }}>
                <span style={{ fontSize: '16px', opacity: 0.8 }}>{icon}</span>
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Sign out */}
        <div style={{ padding: '16px 12px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
              padding: '9px 10px', borderRadius: '8px',
              background: 'transparent', border: 'none',
              color: 'rgba(255,255,255,0.35)', fontSize: '14px',
              cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
              transition: 'color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = '#f87171';
              e.currentTarget.style.background = 'rgba(239,68,68,0.08)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'rgba(255,255,255,0.35)';
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <span style={{ fontSize: '16px' }}>⎋</span>
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main content ────────────────────────────── */}
      <main style={{
        flex: 1,
        marginLeft: '240px',
        padding: '32px 32px',
        minHeight: '100vh',
      }} className="dashboard-main">
        {children}
      </main>

      {/* ── Bottom nav (mobile) ─────────────────────── */}
      <nav className="dashboard-bottom-nav" style={{
        display: 'none',
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'rgba(8,8,8,0.95)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        padding: '8px 0 12px',
        zIndex: 40,
        justifyContent: 'space-around',
      }}>
        {NAV.map(({ label, href, icon }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
              textDecoration: 'none',
              color: active ? '#4f6ef7' : 'rgba(255,255,255,0.35)',
              fontSize: '10px', fontWeight: active ? 600 : 400,
              padding: '4px 8px',
            }}>
              <span style={{ fontSize: '20px' }}>{icon}</span>
              {label}
            </Link>
          );
        })}
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
