import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Section, Wrap } from '@/components/section';
import { OverlayPanel } from '@/components/overlay-panel';
import { StreamingAnswer } from '@/components/streaming-answer';
import { DownloadButton } from '@/components/download-button';
import { JsonLd } from '@/components/json-ld';
import { Reveal } from '@/components/reveal';
import { FEATURES, SITE } from '@/lib/site';
import { FEATURE_DETAIL } from '@/lib/feature-content';

export function generateStaticParams() {
  return FEATURES.map((f) => ({ slug: f.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const detail = FEATURE_DETAIL[slug];
  const feature = FEATURES.find((f) => f.slug === slug);
  if (!detail || !feature) return {};

  return {
    title: feature.name,
    description: detail.lede,
    alternates: { canonical: `/features/${slug}` },
    openGraph: { title: `${feature.name} — ${SITE.name}`, description: detail.lede },
  };
}

export default async function FeaturePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const detail = FEATURE_DETAIL[slug];
  const feature = FEATURES.find((f) => f.slug === slug);
  if (!detail || !feature) notFound();

  const others = FEATURES.filter((f) => f.slug !== slug);

  return (
    <>
      <div className="pb-16 pt-16 md:pt-24">
        <Wrap>
          <p className="label">
            <Link href="/features" className="hover:text-ink">
              Features
            </Link>
            <span aria-hidden="true"> · </span>
            {feature.name}
          </p>

          <div className="mt-8 grid items-start gap-12 md:grid-cols-12 md:gap-8">
            <div className="md:col-span-6">
              <h1 className="max-w-[15ch] text-hed">{detail.title}</h1>
              <p className="mt-6 max-w-[46ch] text-lede text-muted">{detail.lede}</p>

              {feature.hotkey && (
                <p className="mt-8 flex items-center gap-3">
                  <kbd className="keycap">{feature.hotkey}</kbd>
                  <span className="font-mono text-xs text-muted">
                    or {feature.hotkey.replace('Shift', 'Alt')} if that is taken
                  </span>
                </p>
              )}
            </div>

            {/* One panel per page, and this is it. */}
            <div className="md:col-span-6 md:-mt-8 md:pl-6">
              <figure>
                <figcaption className="label mb-4">{detail.demo.live ? 'In the call' : 'On screen'}</figcaption>
                <blockquote
                  className="font-display text-xl italic leading-snug text-ink/85 md:text-2xl"
                  style={{ fontVariationSettings: '"SOFT" 0, "WONK" 1, "opsz" 144' }}
                >
                  {detail.demo.question}
                </blockquote>
                <OverlayPanel live={detail.demo.live} className="mt-5 md:ml-8">
                  <StreamingAnswer text={detail.demo.answer} />
                </OverlayPanel>
              </figure>
            </div>
          </div>
        </Wrap>
      </div>

      <Section className="border-t border-rule">
        <div className="grid gap-12 md:grid-cols-3 md:gap-10">
          {detail.body.map((block, i) => (
            <Reveal key={block.heading} delay={i * 80}>
              <h2 className="text-xl">{block.heading}</h2>
              <p className="mt-3 text-[0.9375rem] leading-[1.8] text-muted">{block.text}</p>
            </Reveal>
          ))}
        </div>

        <div className="mt-16 max-w-[62ch] rounded-[var(--radius-card)] bg-ink/[0.035] px-7 py-6">
          <h2 className="label">What it will not do</h2>
          <p className="mt-3 text-[0.9375rem] leading-[1.8] text-ink/80">{detail.limit}</p>
        </div>
      </Section>

      <Section className="border-t border-rule">
        <h2 className="label">The other three</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-3">
          {others.map((other) => (
            <Link
              key={other.slug}
              href={`/features/${other.slug}`}
              className="card card-hover group p-7"
            >
              <h3 className="text-xl transition-colors group-hover:text-overlay">{other.name}</h3>
              <p className="mt-2 text-sm text-muted">{other.blurb}</p>
            </Link>
          ))}
        </div>

        <div className="mt-14">
          <DownloadButton />
          <p className="mt-5 font-mono text-xs text-muted">Free for 30 minutes. No card.</p>
        </div>
      </Section>

      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: SITE.url },
            { '@type': 'ListItem', position: 2, name: 'Features', item: `${SITE.url}/features` },
            {
              '@type': 'ListItem',
              position: 3,
              name: feature.name,
              item: `${SITE.url}/features/${slug}`,
            },
          ],
        }}
      />
    </>
  );
}
