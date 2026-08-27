import { DOWNLOAD } from '@/lib/site';

/**
 * The Windows download. It points at the backend's /analytics/download, which
 * records the hit and then redirects to the R2 binary — so this must stay a
 * plain link, never a fetch.
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
    <a
      href={DOWNLOAD.windows}
      className={`btn ${variant === 'primary' ? 'btn-primary' : 'btn-secondary'} ${className}`}
    >
      <WindowsGlyph />
      {children}
    </a>
  );
}

/** Disabled until the build ships. Says when, rather than just being dead. */
export function MacButton({ className = '' }: { className?: string }) {
  if (DOWNLOAD.mac.available) {
    return (
      <a href={DOWNLOAD.mac.href} className={`btn btn-secondary ${className}`}>
        Download for macOS
      </a>
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
