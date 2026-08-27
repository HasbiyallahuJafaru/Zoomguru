import type { Metadata } from 'next';
import { Callout, H2, LI, LegalPage, P, UL } from '@/components/prose';
import { JsonLd } from '@/components/json-ld';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'What ZoomGuru collects, what it deliberately does not, and where your interview audio actually goes.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <>
      <LegalPage title="Privacy Policy" updated="27 August 2026">
        <P>
          This explains what {SITE.name} collects and what happens to it. The short version is at
          the top because it is the part that matters.
        </P>

        <Callout>
          We do not store your interview. No audio, no screenshots, no questions, no answers are
          written to our database — only a record that a request happened, and when.
        </Callout>

        <H2>What we collect</H2>
        <UL>
          <LI>
            <strong>Account details.</strong> Your email, your name, and a hashed password. We
            never see the password itself.
          </LI>
          <LI>
            <strong>Subscription details.</strong> Your plan, its status and its dates, plus the
            Paystack references for your payments. Card numbers go to Paystack, never to us.
          </LI>
          <LI>
            <strong>Usage records.</strong> One row per request, holding your user ID, the type of
            request, and a timestamp. This is how we count usage and spot outages.
          </LI>
          <LI>
            <strong>Device keys.</strong> A public key for each computer you sign in on, used to
            verify requests really came from your app.
          </LI>
          <LI>
            <strong>Download counts.</strong> Platform, version and IP when the installer is
            fetched, so we know how many people are downloading it.
          </LI>
        </UL>

        <H2>What we do not collect</H2>
        <UL>
          <LI>Recordings of your interviews, in any form.</LI>
          <LI>The questions you were asked, or the answers we produced.</LI>
          <LI>Screenshots you captured.</LI>
          <LI>Your CV or the job description — those stay on your own computer.</LI>
          <LI>Keystrokes, browsing history, or anything outside the app.</LI>
        </UL>

        <H2>Where your audio goes</H2>
        <P>
          To produce an answer, your microphone audio is transcribed and the transcript is sent,
          with your CV and the job description, to the AI model that writes the reply. Screenshots
          follow the same path when you use the screenshot shortcut.
        </P>
        <P>
          That happens over an encrypted connection, for the duration of the request only. We do
          not keep any of it afterwards. The providers we use for transcription and generation
          process it under their own terms and do not receive your name or email.
        </P>

        <H2>How we use what we do collect</H2>
        <UL>
          <LI>To run your account and check your subscription is active.</LI>
          <LI>To count usage against your plan.</LI>
          <LI>To send transactional email — receipts, password resets, expiry reminders.</LI>
          <LI>To find and fix faults.</LI>
        </UL>
        <P>We do not sell your data, and we do not use it to train AI models.</P>

        <H2>Email</H2>
        <P>
          We send account email you cannot opt out of while you hold an account: receipts, password
          resets, and notices about your subscription. Occasional product announcements have an
          unsubscribe link and honour it.
        </P>

        <H2>Third parties</H2>
        <UL>
          <LI>
            <strong>Paystack</strong> — payments. They hold your card details; we hold only a
            reference.
          </LI>
          <LI>
            <strong>AI providers</strong> — transcription and answer generation, per request, with
            no account identifiers attached.
          </LI>
          <LI>
            <strong>Resend</strong> — email delivery.
          </LI>
          <LI>
            <strong>Railway, Supabase and Cloudflare</strong> — hosting, database and downloads.
          </LI>
        </UL>

        <H2>How long we keep things</H2>
        <P>
          Account and subscription records last as long as your account does. Usage rows are kept
          for reporting. Password reset tokens expire after an hour. Ask us to delete your account
          and we remove your personal data within 30 days, except where we must keep payment
          records for tax or legal reasons.
        </P>

        <H2>Your rights</H2>
        <P>
          You can ask for a copy of your data, ask us to correct it, or ask us to delete it. Email
          {' '}{SITE.supportEmail} and we will respond within 30 days.
        </P>

        <H2>Security</H2>
        <P>
          Passwords are hashed with bcrypt. Traffic is encrypted in transit. Every AI request must
          be signed by a registered device key. Sessions expire after three hours, and completing a
          password reset signs every device out.
        </P>
        <P>
          No system is perfectly secure. If we ever suffer a breach affecting your data, we will
          tell you.
        </P>

        <H2>Children</H2>
        <P>
          {SITE.name} is not for anyone under 18, and we do not knowingly collect their data.
        </P>

        <H2>Changes</H2>
        <P>
          If this policy changes materially we will tell you by email or in the app before it takes
          effect.
        </P>

        <H2>Contact</H2>
        <P>Privacy questions go to {SITE.supportEmail}.</P>
      </LegalPage>

      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: SITE.url },
            { '@type': 'ListItem', position: 2, name: 'Privacy Policy', item: `${SITE.url}/privacy` },
          ],
        }}
      />
    </>
  );
}
