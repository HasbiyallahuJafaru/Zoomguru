'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { NAV } from '@/lib/site';
import { Wordmark } from './wordmark';

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Navigating with the menu open would otherwise leave it covering the page.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // The header itself is only a positioner — the pill inside it is the surface,
  // so the page scrolls visibly under it instead of meeting a hard edge.
  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-3 md:px-6 md:pt-4">
      <div className="mx-auto flex h-14 max-w-[1180px] items-center justify-between rounded-full border border-rule/40 bg-paper/45 px-5 shadow-[0_10px_30px_-20px_rgba(14,14,12,0.3)] backdrop-blur-md backdrop-saturate-150 md:px-7">
        <Wordmark />

        <nav className="hidden items-center gap-8 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              // Not text-muted: the pill is transparent enough that these sit on
              // the hero painting, where muted falls to ~1.6:1. Ink holds on both
              // the photograph and the white pages below it.
              className={`font-mono text-[0.6875rem] uppercase tracking-[0.14em] transition-colors hover:text-ink ${
                pathname.startsWith(item.href) ? 'text-ink' : 'text-ink/80'
              }`}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/download"
            className="btn btn-primary !px-5 !py-2.5 !text-[0.875rem]"
          >
            Get it
          </Link>
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? 'Close menu' : 'Open menu'}
          className="flex h-9 w-9 flex-col items-center justify-center gap-[5px] md:hidden"
        >
          <span
            className={`block h-px w-5 bg-ink transition-transform duration-300 ${
              open ? 'translate-y-[3px] rotate-45' : ''
            }`}
          />
          <span
            className={`block h-px w-5 bg-ink transition-transform duration-300 ${
              open ? '-translate-y-[3px] -rotate-45' : ''
            }`}
          />
        </button>
      </div>

      {open && (
        <nav
          id="mobile-nav"
          className="mt-2 rounded-card border border-rule/60 bg-paper/90 px-6 pb-8 pt-2 shadow-[0_18px_44px_-24px_rgba(14,14,12,0.45)] backdrop-blur-xl md:hidden"
        >
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block border-b border-rule/60 py-4 font-display text-2xl text-ink last:border-b-0"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/download"
            className="btn btn-primary mt-6 !flex w-full !py-4"
          >
            Download for Windows
          </Link>
        </nav>
      )}
    </header>
  );
}
