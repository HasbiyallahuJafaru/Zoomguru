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

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-rule/60 bg-paper/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-6 md:px-10">
        <Wordmark />

        <nav className="hidden items-center gap-9 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`font-mono text-[0.6875rem] uppercase tracking-[0.14em] transition-colors hover:text-ink ${
                pathname.startsWith(item.href) ? 'text-ink' : 'text-muted'
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
          className="border-t border-rule bg-paper px-6 pb-8 pt-4 md:hidden"
        >
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block border-b border-rule py-4 font-display text-2xl text-ink"
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
