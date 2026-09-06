import Link from 'next/link';
import { Hero } from '@/components/hero';
import { Section, SectionHead, Wrap } from '@/components/section';
import { Reveal } from '@/components/reveal';
import { DownloadButton } from '@/components/download-button';
import { ComparisonTable } from '@/components/comparison-table';
import { Walkthrough } from '@/components/walkthrough';
import { FeatureMarquee } from '@/components/feature-marquee';
import { FAQ } from '@/lib/faq';
import { FEATURES } from '@/lib/site';

// A real sequence, so it is numbered. Nothing else on this page is.
const STEPS = [
  {
    title: 'Give it the role',
    body: 'Upload your CV and paste the job description. Two minutes, once per role. Every answer it writes is grounded in both.',
  },
  {
    title: 'Join the interview',
    body: 'Open Zoom, Meet, Teams, whatever they sent you. The overlay is already running on your screen and already excluded from screen capture.',
  },
  {
    title: 'Answer',
    body: 'Press once when a question lands, or leave auto mode on and never touch the keyboard. The answer writes itself out while they are still finishing the question.',
  },
];

const PROOF = [
  {
    title: 'It is not in the screen share',
    body: 'The overlay is marked as protected content at the operating-system level, so capture software skips it. Zoom, Meet, Teams and screen recorders all show whatever is behind it — not the window.',
  },
  {
    title: 'The interview is not kept',
    body: 'No audio, no screenshots, no questions, no answers are written to our database. We store that a request happened and when, which is how usage is counted, and nothing about what was said.',
  },
];

export default function HomePage() {
  return (
    <>
      <Hero />

      {/* A thin index of what follows, running edge to edge. */}
      <FeatureMarquee />

      <Section id="setup">
        <SectionHead
          eyebrow="What it does"
          title="One tool. Four ways to use it."
          lede="There is no suite here and no second product to learn. It answers the question in front of you, and these are the ways you can ask it to."
        />

        <div id="features" className="mt-14 grid gap-5 sm:grid-cols-2">
          {FEATURES.map((feature, i) => (
            <Link
              key={feature.slug}
              href={`/features/${feature.slug}`}
              className="card card-hover group p-8 md:p-10"
            >
              <Reveal delay={i * 70}>
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="text-2xl transition-colors group-hover:text-overlay">
                    {feature.name}
                  </h3>
                  {feature.hotkey && <kbd className="keycap">{feature.hotkey}</kbd>}
                </div>
                <p className="mt-3 max-w-[42ch] text-[0.9375rem] text-muted">{feature.blurb}</p>
                <span className="mt-6 inline-block text-sm text-overlay">Read more &rarr;</span>
              </Reveal>
            </Link>
          ))}
        </div>
      </Section>

      <Section id="how" className="border-t border-rule">
        <SectionHead
          eyebrow="How it works"
          title="Three things, then you forget it is there."
        />

        <ol className="mt-14 grid gap-5 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="card p-8 md:p-10">
              <Reveal delay={i * 90}>
                <span className="font-mono text-xs text-overlay">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-5 text-2xl">{step.title}</h3>
                <p className="mt-3 text-[0.9375rem] text-muted">{step.body}</p>
              </Reveal>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="walkthrough" className="border-t border-rule">
        <SectionHead
          eyebrow="Every screen"
          title="What it actually looks like."
          lede="The whole app, in the order you meet it. These are the real screens, not illustrations of them."
        />
        <Walkthrough />
      </Section>

      <Section className="border-t border-rule">
        <div className="grid gap-12 md:grid-cols-2 md:gap-20">
          {PROOF.map((item) => (
            <Reveal key={item.title}>
              <h2 className="text-sub">{item.title}</h2>
              <p className="mt-4 text-[0.9375rem] leading-[1.8] text-muted">{item.body}</p>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section id="pricing" className="border-t border-rule">
        <SectionHead
          eyebrow="Price"
          title="The cheap one, on purpose."
          lede="The other interview copilots charge in dollars, and some of them meter you by the hour while you are being interviewed. We do neither."
        />

        <Reveal className="mt-12">
          <ComparisonTable centeredNote />
        </Reveal>

        <div className="mt-10 text-center">
          <Link href="/pricing" className="btn btn-secondary">
            All three plans →
          </Link>
        </div>
      </Section>

      <Section id="faq" className="border-t border-rule">
        <div className="grid gap-12 md:grid-cols-[0.8fr_1.2fr] md:gap-20">
          <SectionHead eyebrow="Questions" title="The ones people actually ask." />

          <div className="border-t border-rule/60">
            {FAQ[0].items.slice(0, 3).map((item) => (
              <details key={item.q} className="group border-b border-rule/60">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-lg marker:hidden">
                  <span className="font-display">{item.q}</span>
                  <span className="font-mono text-overlay transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="pb-6 pr-10 text-[0.9375rem] text-muted">{item.a[0]}</p>
              </details>
            ))}
            <Link
              href="/faq"
              className="btn btn-quiet mt-8 !inline-flex"
            >
              All questions →
            </Link>
          </div>
        </div>
      </Section>

      <section className="border-t border-rule py-24 md:py-32">
        <Wrap className="text-center">
          <h2 className="mx-auto max-w-[18ch] text-hed">
            The next question is coming either way.
          </h2>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <DownloadButton />
          </div>
          <p className="mt-6 font-mono text-xs text-muted">
            Free for 30 minutes. No card.
          </p>
        </Wrap>
      </section>
    </>
  );
}
