import type { Metadata } from 'next';
import Link from 'next/link';
import { Section, Wrap } from '@/components/section';
import { FaqAccordion } from '@/components/faq-accordion';
import { JsonLd } from '@/components/json-ld';
import { SITE } from '@/lib/site';
import { ALL_QA, FAQ } from '@/lib/faq';

const DESCRIPTION =
  'How ZoomGuru works, whether the interviewer can see it, what happens to your data, and how the plans are billed.';

export const metadata: Metadata = {
  title: 'FAQ',
  description: DESCRIPTION,
  alternates: { canonical: '/faq' },
  openGraph: { title: `FAQ — ${SITE.name}`, description: DESCRIPTION },
};

export default function FaqPage() {
  return (
    <>
      <div className="pb-14 pt-16 md:pt-24">
        <Wrap>
          <p className="label">Questions</p>
          <h1 className="mt-6 max-w-[16ch] text-hed">Everything people ask before they install it.</h1>
        </Wrap>
      </div>

      <Section className="border-t border-rule">
        <div className="max-w-[80ch]">
          <FaqAccordion sections={FAQ} />
        </div>

        <div className="mt-20 max-w-[62ch] border-t border-rule pt-10">
          <h2 className="text-sub">Still stuck?</h2>
          <p className="mt-3 text-[0.9375rem] leading-[1.8] text-muted">
            Email {SITE.supportEmail} and a person will read it. We are a small team, so it is
            genuinely a person.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-6">
            <a
              href={`mailto:${SITE.supportEmail}`}
              className="btn btn-secondary"
            >
              Email support
            </a>
            <Link
              href="/download"
              className="btn btn-quiet"
            >
              Or just try it
            </Link>
          </div>
        </div>
      </Section>

      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: ALL_QA.map((item) => ({
            '@type': 'Question',
            name: item.q,
            acceptedAnswer: { '@type': 'Answer', text: item.a.join(' ') },
          })),
        }}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: SITE.url },
            { '@type': 'ListItem', position: 2, name: 'FAQ', item: `${SITE.url}/faq` },
          ],
        }}
      />
    </>
  );
}
