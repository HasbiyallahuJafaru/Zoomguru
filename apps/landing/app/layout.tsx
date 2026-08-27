import type { Metadata } from 'next';
import { DM_Mono, Fraunces, Instrument_Sans } from 'next/font/google';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { SiteBackdrop } from '@/components/site-backdrop';
import ClickSpark from '@/components/ClickSpark';
import { JsonLd } from '@/components/json-ld';
import { SITE } from '@/lib/site';
import { PLANS } from '@/lib/pricing';
import './globals.css';

// WONK and SOFT are what stop Fraunces reading as a stock serif; they are set
// per-element in globals.css via font-variation-settings.
const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  axes: ['SOFT', 'WONK', 'opsz'],
  variable: '--font-fraunces',
});

const instrument = Instrument_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-instrument',
});

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-dm-mono',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s — ${SITE.name}`,
  },
  description: SITE.description,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: SITE.name,
    url: SITE.url,
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${instrument.variable} ${dmMono.variable}`}>
      <head>
        {/* Scroll reveals start transparent and are shown by JS. Without this,
            a reader with scripts off would get blank sections. */}
        <noscript>
          <style>{`.reveal{opacity:1!important;transform:none!important}`}</style>
        </noscript>
      </head>
      <body className="min-h-screen antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:bg-ink focus:px-4 focus:py-2 focus:font-mono focus:text-xs focus:uppercase focus:text-paper"
        >
          Skip to content
        </a>

        {/* Sparks fire on buttons and links only — see the guard in ClickSpark. */}
        <ClickSpark sparkColor="#1b2ed6" sparkSize={9} sparkRadius={17} sparkCount={8} duration={420}>
          {/* Sits above the paper, below everything else. */}
          <SiteBackdrop />

          <SiteHeader />
          <div className="relative z-10">
            <main id="main" className="pt-16">
              {children}
            </main>
            <SiteFooter />
          </div>
        </ClickSpark>

        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: SITE.name,
            applicationCategory: 'BusinessApplication',
            operatingSystem: 'Windows 10, Windows 11',
            url: SITE.url,
            description: SITE.description,
            offers: PLANS.map((plan) => ({
              '@type': 'Offer',
              name: `${plan.name} plan`,
              price: plan.price,
              priceCurrency: 'NGN',
              url: `${SITE.url}/pricing`,
            })),
          }}
        />
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: SITE.name,
            url: SITE.url,
            email: SITE.supportEmail,
          }}
        />
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: SITE.name,
            url: SITE.url,
          }}
        />
      </body>
    </html>
  );
}
