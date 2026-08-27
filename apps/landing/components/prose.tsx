import type { ReactNode } from 'react';
import { Wrap } from './section';

/** Shared shell for the three legal pages. */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <article className="py-20 md:py-28">
      <Wrap>
        <div className="max-w-[68ch]">
          <p className="label">Legal</p>
          <h1 className="mt-4 text-hed">{title}</h1>
          <p className="mt-6 border-b border-rule pb-6 font-mono text-xs text-muted">
            Last updated {updated}
          </p>

          <div className="prose-legal mt-10">{children}</div>
        </div>
      </Wrap>
    </article>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return <h2 className="mt-12 text-2xl first:mt-0">{children}</h2>;
}

export function P({ children }: { children: ReactNode }) {
  return <p className="mt-4 text-[0.9375rem] leading-[1.8] text-ink/85">{children}</p>;
}

export function UL({ children }: { children: ReactNode }) {
  return <ul className="mt-4 space-y-2.5">{children}</ul>;
}

export function LI({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-[0.9375rem] leading-[1.8] text-ink/85">
      <span aria-hidden="true" className="mt-[0.7em] block h-px w-4 shrink-0 bg-rule" />
      <span>{children}</span>
    </li>
  );
}

/** For the one paragraph on a legal page that people actually need to see. */
export function Callout({ children }: { children: ReactNode }) {
  return (
    <div className="mt-8 rounded-[var(--radius-card)] bg-overlay/[0.055] px-7 py-6">
      <p className="text-[0.9375rem] leading-[1.8]">{children}</p>
    </div>
  );
}
