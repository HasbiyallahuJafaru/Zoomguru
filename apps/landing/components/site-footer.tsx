import Link from 'next/link';
import { FEATURES, LEGAL_NAV, NAV, SITE } from '@/lib/site';
import { Wordmark } from './wordmark';

export function SiteFooter() {
  return (
    <footer className="mt-32 border-t border-rule">
      <div className="mx-auto max-w-[1240px] px-6 py-16 md:px-10">
        <div className="grid gap-12 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Wordmark />
            <p className="mt-4 max-w-[26ch] text-sm text-muted">{SITE.tagline}</p>
          </div>

          <FooterColumn title="Product" links={NAV} />
          <FooterColumn
            title="Features"
            links={FEATURES.map((f) => ({ href: `/features/${f.slug}`, label: f.name }))}
          />
          <FooterColumn
            title="Legal"
            links={[...LEGAL_NAV, { href: `mailto:${SITE.supportEmail}`, label: 'Support' }]}
          />
        </div>

        <div className="mt-16 flex flex-col gap-3 border-t border-rule pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="label">© {new Date().getFullYear()} {SITE.domain}</p>
          <p className="label">Windows 10 and later</p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: ReadonlyArray<{ href: string; label: string }>;
}) {
  return (
    <div>
      <h2 className="label">{title}</h2>
      <ul className="mt-4 space-y-2.5">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-sm text-ink/80 transition-colors hover:text-overlay">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
