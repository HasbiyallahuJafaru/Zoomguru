'use client';

import Link from 'next/link';
import { useRef, type MouseEvent, type ReactNode } from 'react';
import { DOWNLOAD, SITE } from '@/lib/site';

/**
 * Every download on the site goes through DownloadGate, so there is exactly one
 * place the terms are shown and no button can quietly skip them.
 *
 * The href stays a plain link. It points at the backend's /analytics/download,
 * which records the hit and then 302s to the R2 binary — so it must never
 * become a fetch. The gate only intercepts a plain left click: modified clicks
 * (new tab, copy link) pass through, and if the JS never runs the click just
 * downloads. Failing open is right for the primary call to action; the terms
 * are linked in the footer of every page regardless.
 */
function DownloadGate({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  function intercept(e: MouseEvent<HTMLAnchorElement>) {
    // Let "open in new tab", "save link as" and middle-click behave normally.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    dialog.current?.showModal();
  }

  return (
    <>
      <a href={href} onClick={intercept} className={className}>
        {children}
      </a>

      {/* Native <dialog>: Esc, focus trap, top layer and backdrop for free. */}
      <dialog
        ref={dialog}
        className="gate"
        aria-labelledby="gate-title"
        // A click that lands on the element itself is a click on the backdrop,
        // since the padding belongs to the inner div.
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current?.close();
        }}
      >
        <div className="p-7 sm:p-8">
          <p className="label">Before you download</p>
          <h2 id="gate-title" className="mt-2 text-2xl">
            Use it wisely
          </h2>

          <p className="mt-4 text-[0.9375rem] leading-relaxed text-muted">
            {SITE.name} is a preparation and practice tool. You are solely responsible for how you
            use it — including whether the organisation interviewing you allows outside assistance.
            Some employers and universities forbid it, and that judgement is yours to make.
          </p>
          <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted">
            Downloading means you agree to the{' '}
            <Link href="/terms" className="text-overlay underline underline-offset-4">
              Terms
            </Link>
            .
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a
              href={href}
              className="btn btn-primary"
              onClick={() => dialog.current?.close()}
            >
              Agree and download
            </a>
            <button
              type="button"
              className="btn btn-quiet text-muted"
              onClick={() => dialog.current?.close()}
            >
              Not now
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}

/**
 * The Windows download.
 */
export function DownloadButton({
  variant = 'primary',
  className = '',
  children = 'Download for Windows',
}: {
  variant?: 'primary' | 'secondary';
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <DownloadGate
      href={DOWNLOAD.windows}
      className={`btn ${variant === 'primary' ? 'btn-primary' : 'btn-secondary'} ${className}`}
    >
      <WindowsGlyph />
      {children}
    </DownloadGate>
  );
}

/** Disabled until the build ships. Says when, rather than just being dead. */
export function MacButton({ className = '' }: { className?: string }) {
  if (DOWNLOAD.mac.available) {
    return (
      <DownloadGate href={DOWNLOAD.mac.href} className={`btn btn-secondary ${className}`}>
        Download for macOS
      </DownloadGate>
    );
  }

  return (
    <span
      aria-disabled="true"
      className={`btn cursor-not-allowed text-muted ring-1 ring-inset ring-rule/60 ${className}`}
    >
      macOS — not yet
    </span>
  );
}

function WindowsGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M0 2.25 6.5 1.36v6.14H0Zm7.3-1L16 0v7.5H7.3ZM0 8.5h6.5v6.14L0 13.75Zm7.3 0H16V16l-8.7-1.24Z" />
    </svg>
  );
}
