import type { ReactNode } from 'react';

export function Wrap({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1240px] px-6 md:px-10 ${className}`}>{children}</div>;
}

export function Section({
  children,
  id,
  className = '',
}: {
  children: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    /* Two adjacent sections stack their padding, so this is half the gap you
       see between them, not all of it. At py-20/28 that came to 160-224px and
       the page read as a series of unrelated pages. */
    <section id={id} className={`py-12 md:py-16 ${className}`}>
      <Wrap>{children}</Wrap>
    </section>
  );
}

/** Eyebrow + heading, the standard opening of every section below the hero. */
export function SectionHead({
  eyebrow,
  title,
  lede,
  className = '',
}: {
  eyebrow: string;
  title: ReactNode;
  lede?: string;
  className?: string;
}) {
  return (
    <div className={`max-w-[52ch] ${className}`}>
      <p className="label">{eyebrow}</p>
      <h2 className="mt-4 text-hed">{title}</h2>
      {lede && <p className="mt-5 text-lede text-muted">{lede}</p>}
    </div>
  );
}
