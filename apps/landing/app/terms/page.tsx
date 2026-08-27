import type { Metadata } from 'next';
import { Callout, H2, LI, LegalPage, P, UL } from '@/components/prose';
import { JsonLd } from '@/components/json-ld';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: `The agreement between you and ${SITE.name}: what you may use it for, how billing works, and where the limits are.`,
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <>
      <LegalPage title="Terms of Service" updated="27 August 2026">
        <P>
          These terms cover your use of {SITE.name}, a desktop application that listens to your
          interview and shows AI-generated answers on your screen. By creating an account you
          agree to them.
        </P>

        <H2>Who can use it</H2>
        <P>
          You must be 18 or older and able to enter a contract. One account belongs to one person.
          Sharing your login is a breach of these terms, and the concurrent-computer limit on your
          plan is not a licence for two people to share one subscription.
        </P>

        <H2>Your account</H2>
        <P>
          You are responsible for keeping your password private and for everything done through
          your account. Tell us at {SITE.supportEmail} if you think someone else has access, and we
          will sign every device out.
        </P>

        <H2>What you may use it for</H2>
        <P>
          {SITE.name} is a preparation and assistance tool. You are responsible for how you use it,
          including whether using it is permitted by the organisation interviewing you.
        </P>
        <Callout>
          Some employers, universities and certification bodies forbid outside assistance during an
          assessment. Using {SITE.name} in those situations may breach their rules and cost you the
          offer. That judgement is yours to make, and the consequences are yours to carry.
        </Callout>
        <P>You may not use it to:</P>
        <UL>
          <LI>Sit an interview or examination in someone else&rsquo;s name.</LI>
          <LI>Break the law, or infringe anyone&rsquo;s rights.</LI>
          <LI>Resell, rent out, or share access to your account.</LI>
          <LI>Reverse-engineer the app, or work around its limits.</LI>
          <LI>Attack, overload, or probe our systems.</LI>
        </UL>

        <H2>Subscriptions and payment</H2>
        <P>
          Plans are weekly, monthly or yearly, billed in naira through Paystack. Subscriptions
          renew automatically until you cancel. Prices can change, but never for a period you have
          already paid for, and we will tell you before a change takes effect.
        </P>
        <P>
          Weekly covers one computer signed in at a time. Monthly and yearly cover two. This is a
          limit on simultaneous sessions, not on how many machines you may install it on.
        </P>

        <H2>Cancelling and refunds</H2>
        <P>
          Cancel any time from inside the app. Access continues to the end of the period you have
          paid for. Refunds are governed by our Refund Policy, which forms part of these terms.
        </P>

        <H2>Free trial</H2>
        <P>
          New accounts get 30 minutes free, tied to the computer that claims it, so the same
          machine cannot claim it repeatedly. No payment details are required.
        </P>

        <H2>What we own</H2>
        <P>
          The app, the site, and everything in them belong to us. Your subscription is a personal,
          non-transferable licence to use the app. It does not transfer ownership of anything.
        </P>
        <P>
          What you put in — your CV, the job description — stays yours. Answers generated for you
          are yours to use.
        </P>

        <H2>Privacy</H2>
        <P>
          Our Privacy Policy explains what we collect and what we do not. We do not store your
          audio, screenshots, questions or answers.
        </P>

        <H2>No warranty</H2>
        <P>
          {SITE.name} is provided as it is. AI-generated answers can be wrong, incomplete or
          unsuitable, and you should treat them as suggestions rather than fact. We do not promise
          the service will be uninterrupted or error-free, and we do not promise you will get the
          job.
        </P>

        <H2>Limits on our liability</H2>
        <P>
          To the extent the law allows, we are not liable for indirect or consequential loss,
          including lost opportunities, lost offers, or reputational harm. Our total liability for
          any claim is capped at what you paid us in the 12 months before it arose.
        </P>

        <H2>Ending your access</H2>
        <P>
          We may suspend or close an account that breaches these terms, without a refund where the
          breach is serious. You may close your account at any time by emailing us.
        </P>

        <H2>Changes</H2>
        <P>
          We may update these terms. Material changes will be announced by email or in the app
          before they take effect. Continuing to use {SITE.name} after that means you accept them.
        </P>

        <H2>Governing law</H2>
        <P>
          These terms are governed by the laws of the Federal Republic of Nigeria, and disputes
          fall to the Nigerian courts.
        </P>

        <H2>Contact</H2>
        <P>Questions about these terms go to {SITE.supportEmail}.</P>
      </LegalPage>

      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: SITE.url },
            { '@type': 'ListItem', position: 2, name: 'Terms of Service', item: `${SITE.url}/terms` },
          ],
        }}
      />
    </>
  );
}
