'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'border-b border-white/5' : ''
      }`}
      style={scrolled ? { background: 'rgba(8,8,8,0.75)', backdropFilter: 'blur(20px)' } : {}}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}
          >
            <span className="text-white font-black text-sm tracking-tight">Z</span>
          </div>
          <span className="text-white font-bold text-lg tracking-tight">
            Zoom<span className="text-white/75">Guru</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {[
            { label: 'How it works', href: '/how-it-works' },
            { label: 'Features', href: '/features' },
            { label: 'Pricing', href: '/pricing' },
            { label: 'FAQ', href: '/faq' },
          ].map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="px-4 py-2 text-sm text-white/75 hover:text-white rounded-lg hover:bg-white/5 transition-all duration-150"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <a href="/download" className="text-sm text-white/65 hover:text-white transition-colors px-3 py-2">
            Download
          </a>
          <a
            href="/#pricing"
            className="btn-shimmer text-sm font-semibold px-5 py-2.5 rounded-xl"
          >
            Get started free
          </a>
        </div>

        <button
          className="md:hidden p-2 text-white/75 hover:text-white"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          {menuOpen ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {menuOpen && (
        <div
          className="md:hidden border-b border-white/5 px-4 pb-4 space-y-1"
          style={{ background: 'rgba(8,8,8,0.9)', backdropFilter: 'blur(20px)' }}
        >
          {[
            { label: 'How it works', href: '/how-it-works' },
            { label: 'Features', href: '/features' },
            { label: 'Pricing', href: '/pricing' },
            { label: 'FAQ', href: '/faq' },
            { label: 'Download', href: '/download' },
          ].map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="block px-4 py-3 text-sm text-white/60 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
            >
              {link.label}
            </a>
          ))}
          <a href="/#pricing" className="block btn-shimmer text-sm font-semibold px-4 py-3 rounded-xl text-center mt-2">
            Get started free
          </a>
        </div>
      )}
    </header>
  );
}

