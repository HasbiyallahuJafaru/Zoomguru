import type { Metadata } from 'next';
import { Callout, H2, LI, LegalPage, P, UL } from '@/components/prose';
import { JsonLd } from '@/components/json-ld';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Refund Policy',
  description:
    'When ZoomGuru issues a refund, when it does not, and how to ask for one.',
  alternates: { canonical: '/refund' },
};

export default function RefundPage() {
  return (
    <>
      <LegalPage title="Refund Policy" updated="27 August 2026">
        <P>
          This sets out exactly when you can expect a refund, so you can decide before you pay
          rather than argue afterwards.
        </P>

        <Callout>
          If {SITE.name} does not work as described and we cannot fix it within 48 hours of you
          reporting it, you get a full refund — within the first 7 days of the charge.
        </Callout>

        <H2>Try it before you pay</H2>
        <P>
          Every new account gets 30 minutes free, with no card required. Use it. A refund request
          that amounts to &ldquo;I did not like it&rdquo; is weighed against whether you tried the
          trial first.
        </P>

        <H2>When we refund</H2>
        <UL>
          <LI>
            <strong>It did not work.</strong> The overlay fails to load, answers do not stream,
            transcription is broken — and we cannot resolve it within 48 hours of your report.
          </LI>
          <LI>
            <strong>You were charged twice</strong> for the same period.
          </LI>
          <LI>
            <strong>You did not authorise the payment</strong> and can show us that.
          </LI>
          <LI>
            <strong>We were down</strong> for more than 24 hours straight during your paid period,
            through our own fault.
          </LI>
        </UL>

        <H2>When we do not</H2>
        <UL>
          <LI>You changed your mind after subscribing, having used the service.</LI>
          <LI>You forgot to cancel before it renewed.</LI>
          <LI>Your own device, microphone, or internet connection stopped it working.</LI>
          <LI>It worked as described but did not meet an expectation we never set.</LI>
          <LI>More than 7 days have passed since the charge.</LI>
        </UL>

        <H2>Weekly plans</H2>
        <P>
          A weekly plan is short enough that the 7-day window covers most of it. If the app failed
          and we could not fix it, we refund in full. We do not pro-rate unused days.
        </P>

        <H2>Monthly plans</H2>
        <P>
          Cancel and access continues to the end of the month you paid for, with no further
          charges. We do not pro-rate unused days inside a period.
        </P>

        <H2>Yearly plans</H2>
        <P>
          Cancel within the first 7 days, having not used the service substantially, and you can
          request a refund under the criteria above. After 7 days, cancelling stops future renewals
          but does not refund the current year.
        </P>

        <H2>How to ask</H2>
        <P>Email {SITE.supportEmail} with:</P>
        <UL>
          <LI>The email address on your account.</LI>
          <LI>The date of the charge.</LI>
          <LI>What went wrong.</LI>
        </UL>
        <P>
          We reply within 2 business days. Approved refunds go back to the card or account you paid
          from, and take 5 to 10 business days to arrive depending on your bank.
        </P>

        <H2>Contact</H2>
        <P>
          Questions about this policy go to {SITE.supportEmail}. We are a small team and we would
          rather sort a problem out than keep the money.
        </P>
      </LegalPage>

      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: SITE.url },
            { '@type': 'ListItem', position: 2, name: 'Refund Policy', item: `${SITE.url}/refund` },
          ],
        }}
      />
    </>
  );
}
