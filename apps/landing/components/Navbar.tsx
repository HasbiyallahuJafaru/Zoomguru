'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: session } = useSession();
  const user = session?.user as any;

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const navLinks = [
    { label: 'How it works', href: '/how-it-works' },
    { label: 'Features', href: '/features' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'FAQ', href: '/faq' },
  ];

  return (
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
      background: scrolled ? 'rgba(250,250,248,0.92)' : 'transparent',
      backdropFilter: scrolled ? 'blur(16px)' : 'none',
      borderBottom: scrolled ? '1px solid #e5e5e5' : '1px solid transparent',
      transition: 'background 0.2s, border-color 0.2s',
    }}>
      <div style={{ maxWidth: 1152, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

        {/* Logo */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontWeight: 900, fontSize: 14 }}>Z</span>
          </div>
          <span style={{ color: '#111', fontWeight: 700, fontSize: 17, letterSpacing: '-0.3px' }}>
            Zoom<span style={{ color: '#555' }}>Guru</span>
          </span>
        </Link>

        {/* Nav links */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 2 }} className="hidden-mobile">
          {navLinks.map((link) => (
            <a key={link.label} href={link.href} style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 14, fontWeight: 500,
              color: '#444', textDecoration: 'none', transition: 'background 0.12s, color 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f0f0f0'; e.currentTarget.style.color = '#111'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#444'; }}
            >{link.label}</a>
          ))}
        </nav>

        {/* Right actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }} className="hidden-mobile">
          {user ? (
            <>
              <Link href="/dashboard" style={{ fontSize: 14, fontWeight: 500, color: '#444', textDecoration: 'none', padding: '8px 14px', borderRadius: 8, transition: 'color 0.12s' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#111')}
                onMouseLeave={e => (e.currentTarget.style.color = '#444')}
              >Dashboard</Link>
              {user.isAdmin && (
                <Link href="/admin" style={{ fontSize: 14, fontWeight: 500, color: '#444', textDecoration: 'none', padding: '8px 14px', borderRadius: 8 }}>Admin</Link>
              )}
            </>
          ) : (
            <Link href="/login" style={{ fontSize: 14, fontWeight: 500, color: '#444', textDecoration: 'none', padding: '8px 14px' }}>Sign in</Link>
          )}
          <a href="/pricing" style={{
            background: '#111', color: '#fff', fontSize: 14, fontWeight: 600,
            padding: '9px 20px', borderRadius: 10, textDecoration: 'none',
            transition: 'background 0.12s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#333')}
          onMouseLeave={e => (e.currentTarget.style.background = '#111')}
          >Get started free</a>
        </div>

        {/* Mobile toggle */}
        <button onClick={() => setMenuOpen(!menuOpen)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#111', padding: 8 }} className="mobile-only" aria-label="Menu">
          {menuOpen
            ? <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            : <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/></svg>
          }
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{ background: '#fafaf8', borderBottom: '1px solid #e5e5e5', padding: '8px 16px 16px' }} className="mobile-only">
          {[...navLinks, { label: 'Download', href: '/download' }].map((link) => (
            <a key={link.label} href={link.href} onClick={() => setMenuOpen(false)} style={{
              display: 'block', padding: '12px 16px', fontSize: 14, color: '#444',
              textDecoration: 'none', borderRadius: 8,
            }}>{link.label}</a>
          ))}
          {user && (
            <Link href="/dashboard" onClick={() => setMenuOpen(false)} style={{ display: 'block', padding: '12px 16px', fontSize: 14, color: '#444', textDecoration: 'none', borderRadius: 8 }}>Dashboard</Link>
          )}
          <a href="/pricing" style={{
            display: 'block', marginTop: 8, background: '#111', color: '#fff',
            fontSize: 14, fontWeight: 600, padding: '12px 16px', borderRadius: 10, textDecoration: 'none', textAlign: 'center',
          }}>Get started free</a>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .hidden-mobile { display: none !important; }
        }
        @media (min-width: 769px) {
          .mobile-only { display: none !important; }
        }
      `}</style>
    </header>
  );
}
