import type { Metadata } from 'next';
import Link from 'next/link';
import { Section, Wrap } from '@/components/section';
import { DownloadButton } from '@/components/download-button';
import { JsonLd } from '@/components/json-ld';
import { Reveal } from '@/components/reveal';
import { FEATURES, SITE } from '@/lib/site';
import { FEATURE_DETAIL } from '@/lib/feature-content';

const DESCRIPTION =
  'One app that answers interview questions on your screen. Live copilot, hands-free auto mode, screenshot answers, and an overlay the screen share cannot see.';

export const metadata: Metadata = {
  title: 'Features',
  description: DESCRIPTION,
  alternates: { canonical: '/features' },
  openGraph: { title: `Features — ${SITE.name}`, description: DESCRIPTION },
};

export default function FeaturesIndex() {
  return (
    <>
      <div className="pb-14 pt-16 md:pt-24">
        <Wrap>
          <p className="label">Features</p>
          <h1 className="mt-6 max-w-[18ch] text-hed">One app, and four ways to lean on it.</h1>
          <p className="mt-6 max-w-[56ch] text-lede text-muted">
            ZoomGuru does one thing: it answers the question in front of you. These are the ways
            you can ask, and the trade-off each one makes.
          </p>
        </Wrap>
      </div>

      <Section className="border-t border-rule !pt-0 md:!pt-0">
        <div className="mt-16 grid gap-5 sm:grid-cols-2">
          {FEATURES.map((feature, i) => {
            const detail = FEATURE_DETAIL[feature.slug];

            return (
              <Link
                key={feature.slug}
                href={`/features/${feature.slug}`}
                className="card card-hover group p-8 md:p-10"
              >
                <Reveal delay={i * 70}>
                  <div className="flex items-baseline justify-between gap-4">
                    <h2 className="text-2xl transition-colors group-hover:text-overlay">
                      {feature.name}
                    </h2>
                    {feature.hotkey && <kbd className="keycap">{feature.hotkey}</kbd>}
                  </div>

                  <p className="mt-4 max-w-[46ch] text-[0.9375rem] leading-[1.75] text-muted">
                    {detail.lede}
                  </p>

                  <p className="mt-6 max-w-[46ch] border-t border-rule/60 pt-4 text-sm text-muted">
                    <span className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-ink">
                      Limit ·{' '}
                    </span>
                    {detail.limit}
                  </p>

                  <span className="mt-6 inline-block text-sm text-overlay">
                    Read more →
                  </span>
                </Reveal>
              </Link>
            );
          })}
        </div>

        <div className="mt-14">
          <DownloadButton />
          <p className="mt-5 font-mono text-xs text-muted">
            Free for 30 minutes. No card. Windows 10 and later.
          </p>
        </div>
      </Section>

      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: SITE.url },
            { '@type': 'ListItem', position: 2, name: 'Features', item: `${SITE.url}/features` },
          ],
        }}
      />
    </>
  );
}
