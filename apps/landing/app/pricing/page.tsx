import type { Metadata } from 'next';
import Link from 'next/link';
import { Section, Wrap } from '@/components/section';
import { PricingCards } from '@/components/pricing-cards';
import { ComparisonTable } from '@/components/comparison-table';
import { DownloadButton } from '@/components/download-button';
import { JsonLd } from '@/components/json-ld';
import { SITE } from '@/lib/site';
import { PLANS } from '@/lib/pricing';

const DESCRIPTION =
  'Weekly, monthly or yearly, all unlimited. Cheaper than Parakeet AI and LockedIn AI, billed in naira, with a free 30-minute trial.';

export const metadata: Metadata = {
  title: 'Pricing',
  description: DESCRIPTION,
  alternates: { canonical: '/pricing' },
  openGraph: { title: `Pricing — ${SITE.name}`, description: DESCRIPTION },
};

const BILLING = [
  {
    q: 'How do I pay?',
    a: 'Through Paystack, from inside the app. Card, bank transfer, USSD and Opay all work. You are charged in naira.',
  },
  {
    q: 'What happens when it renews?',
    a: 'It renews automatically at the same price. Cancel any time and you keep access until the period you already paid for runs out.',
  },
  {
    q: 'What counts as unlimited?',
    a: 'Every plan answers as many questions as you ask it. There is no credit balance, no per-hour meter, and no cap that stops you mid-interview.',
  },
];

export default function PricingPage() {
  return (
    <>
      <div className="pb-14 pt-16 md:pt-24">
        <Wrap>
          <p className="label">Pricing</p>
          <h1 className="mt-6 max-w-[16ch] text-hed">Pick how long you need it.</h1>
          <p className="mt-6 max-w-[54ch] text-lede text-muted">
            Every plan is unlimited. The only things that change are how long it runs and how many
            computers can be signed in at once.
          </p>
        </Wrap>
      </div>

      <Wrap>
        <PricingCards />
        <p className="mt-6 font-mono text-xs text-muted">
          Prices in naira. You start with a free 30-minute trial — no card.
        </p>
      </Wrap>

      <Section className="border-t border-rule mt-24">
        <div className="max-w-[52ch]">
          <p className="label">Against the alternatives</p>
          <h2 className="mt-4 text-hed">Cheaper, and not by a little.</h2>
          <p className="mt-5 text-lede text-muted">
            Parakeet AI and LockedIn AI both sell an unlimited monthly plan in dollars. Some of
            their tiers meter you by the hour while you are being interviewed. Ours does not.
          </p>
        </div>

        <div className="mt-12">
          <ComparisonTable />
        </div>
      </Section>

      <Section className="border-t border-rule">
        <div className="grid gap-12 md:grid-cols-[0.8fr_1.2fr] md:gap-20">
          <div>
            <p className="label">Billing</p>
            <h2 className="mt-4 text-sub">The boring details.</h2>
          </div>

          <dl className="border-t border-rule/60">
            {BILLING.map((item) => (
              <div key={item.q} className="border-b border-rule/60 py-6">
                <dt className="font-display text-lg">{item.q}</dt>
                <dd className="mt-2 max-w-[58ch] text-[0.9375rem] leading-[1.8] text-muted">
                  {item.a}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-14 flex flex-wrap items-center gap-6">
          <DownloadButton />
          <Link
            href="/refund"
            className="btn btn-quiet"
          >
            Refund policy
          </Link>
        </div>
      </Section>

      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: SITE.url },
            { '@type': 'ListItem', position: 2, name: 'Pricing', item: `${SITE.url}/pricing` },
          ],
        }}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: SITE.name,
          description: SITE.description,
          offers: PLANS.map((plan) => ({
            '@type': 'Offer',
            name: `${plan.name} plan`,
            price: plan.price,
            priceCurrency: 'NGN',
            availability: 'https://schema.org/InStock',
            url: `${SITE.url}/pricing`,
          })),
        }}
      />
    </>
  );
}
