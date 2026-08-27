import type { Metadata } from 'next';
import Link from 'next/link';
import { Section, Wrap } from '@/components/section';
import { DownloadButton, MacButton } from '@/components/download-button';
import { JsonLd } from '@/components/json-ld';
import { REQUIREMENTS, SITE } from '@/lib/site';

const DESCRIPTION =
  'Download ZoomGuru for Windows 10 and later. Free for 30 minutes, no card. The macOS build is not out yet.';

export const metadata: Metadata = {
  title: 'Download',
  description: DESCRIPTION,
  alternates: { canonical: '/download' },
  openGraph: { title: `Download — ${SITE.name}`, description: DESCRIPTION },
};

const SETUP = [
  {
    title: 'Run the installer',
    body: 'Windows may warn that it does not recognise the app. That is SmartScreen reacting to a new installer, not a problem with the file — choose More info, then Run anyway.',
  },
  {
    title: 'Create an account',
    body: 'Email, name, password. Your free 30 minutes start when you first use it, not when you sign up, so there is no rush.',
  },
  {
    title: 'Load the role',
    body: 'Upload your CV and paste the job description. This is what makes the answers about you rather than about the topic.',
  },
];

export default function DownloadPage() {
  return (
    <>
      <div className="pb-14 pt-16 md:pt-24">
        <Wrap>
          <div className="grid items-start gap-12 md:grid-cols-12">
            <div className="md:col-span-7">
              <p className="label">Download</p>
              <h1 className="mt-6 max-w-[14ch] text-hed">Get it running in two minutes.</h1>
              <p className="mt-6 max-w-[48ch] text-lede text-muted">
                One installer. No plugins, no browser extension, and nothing to add to your
                meeting software.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-4">
                <DownloadButton />
                <MacButton />
              </div>

              <p className="mt-6 font-mono text-xs text-muted">
                Free for 30 minutes. No card.
              </p>
            </div>

            <div className="md:col-span-5 md:pl-8">
              <dl className="border-t border-rule/60">
                {[
                  ['Operating system', REQUIREMENTS.os],
                  ['Download size', REQUIREMENTS.size],
                  ['Memory', REQUIREMENTS.ram],
                  ['Meeting apps', 'Zoom, Meet, Teams, any other'],
                ].map(([term, value]) => (
                  <div key={term} className="flex justify-between gap-6 border-b border-rule/60 py-3.5">
                    <dt className="label">{term}</dt>
                    <dd className="text-right font-mono text-xs text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </Wrap>
      </div>

      <Section className="border-t border-rule">
        <p className="label">After it downloads</p>
        <ol className="mt-8 grid gap-5 md:grid-cols-3">
          {SETUP.map((step, i) => (
            <li key={step.title} className="card p-8 md:p-10">
              <span className="font-mono text-xs text-overlay">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h2 className="mt-5 text-xl">{step.title}</h2>
              <p className="mt-3 text-[0.9375rem] leading-[1.8] text-muted">{step.body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-16 max-w-[62ch] rounded-[var(--radius-card)] bg-ink/[0.035] px-7 py-6">
          <h2 className="label">No macOS build yet</h2>
          <p className="mt-3 text-[0.9375rem] leading-[1.8] text-ink/80">
            ZoomGuru is Windows-only for now. The screen-capture protection the overlay depends on
            works differently on macOS and we would rather ship it late than ship it visible in
            someone&rsquo;s screen share. This page will offer it the day it is ready.
          </p>
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-6">
          <Link
            href="/pricing"
            className="btn btn-secondary"
          >
            See pricing →
          </Link>
          <Link
            href="/faq"
            className="btn btn-quiet"
          >
            Questions first
          </Link>
        </div>
      </Section>

      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: SITE.url },
            { '@type': 'ListItem', position: 2, name: 'Download', item: `${SITE.url}/download` },
          ],
        }}
      />
    </>
  );
}
