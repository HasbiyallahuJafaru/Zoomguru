import type { ReactNode } from 'react';

/**
 * The site's one signature element: a screen layer sitting on top of the page,
 * the way the app sits on top of a call. Used once per page at most — the
 * moment there are two on screen it stops meaning anything.
 */
export function OverlayPanel({
  children,
  label = 'ZoomGuru',
  live = false,
  className = '',
}: {
  children: ReactNode;
  label?: string;
  live?: boolean;
  className?: string;
}) {
  return (
    <div className={`overlay-panel ${className}`}>
      <div className="flex items-center gap-2.5 border-b border-overlay/15 px-4 py-2.5">
        {live ? (
          <>
            <span className="live-dot" aria-hidden="true" />
            <span className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-signal">
              Listening
            </span>
          </>
        ) : (
          <span className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-overlay">
            {label}
          </span>
        )}
        <span className="ml-auto font-mono text-[0.625rem] uppercase tracking-[0.16em] text-muted">
          Hidden from share
        </span>
      </div>
      <div className="px-4 py-4">{children}</div>
    </div>
  );
}
