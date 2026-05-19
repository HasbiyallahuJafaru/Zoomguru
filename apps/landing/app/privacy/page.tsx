import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy — ZoomGuru',
  description: 'How ZoomGuru collects, uses, and protects your data.',
};

const LAST_UPDATED = 'May 19, 2025';

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-24">
      <div className="mb-12">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-white/40 mb-3">Legal</p>
        <h1 className="text-4xl font-black text-white tracking-tight mb-4">Privacy Policy</h1>
        <p className="text-white/50 text-sm">Last updated: {LAST_UPDATED}</p>
      </div>

      <div className="space-y-10 text-white/70 text-sm leading-relaxed">

        <section>
          <h2 className="text-white font-bold text-lg mb-3">1. Introduction</h2>
          <p>
            ZoomGuru ("we", "our", "us") is committed to protecting your privacy. This Privacy Policy
            explains what information we collect, how we use it, and your rights regarding your data when
            you use the ZoomGuru desktop application and website (collectively, "the Service").
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">2. Information We Collect</h2>

          <h3 className="text-white/90 font-semibold mt-4 mb-2">2.1 Account Information</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>Email address and hashed password (for authentication)</li>
            <li>Name (as provided during registration)</li>
            <li>Device fingerprint (SHA-256 hash of hardware identifiers — used for license locking)</li>
            <li>Referral code (if applicable)</li>
          </ul>

          <h3 className="text-white/90 font-semibold mt-4 mb-2">2.2 CV and Interview Data</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>The CV or resume you upload (stored as extracted text and a parsed JSON profile)</li>
            <li>Job descriptions you optionally provide for a session</li>
            <li>Transcripts from your interview sessions (stored in your session history)</li>
            <li>AI-generated answers from your sessions</li>
          </ul>

          <h3 className="text-white/90 font-semibold mt-4 mb-2">2.3 Payment Information</h3>
          <p>
            Payments are processed by Paystack. ZoomGuru does not store your card details. We retain
            only the Paystack payment reference, plan type, amount, and transaction status for
            license management and accounting.
          </p>

          <h3 className="text-white/90 font-semibold mt-4 mb-2">2.4 Usage Data</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>Number of sessions and AI responses used (for free-tier enforcement)</li>
            <li>Session timestamps and duration</li>
            <li>Error logs (anonymised where possible)</li>
          </ul>

          <h3 className="text-white/90 font-semibold mt-4 mb-2">2.5 What We Do NOT Collect</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>We do not record, store, or transmit your microphone audio. Speech-to-text (Whisper) runs entirely on your device.</li>
            <li>We do not store screenshots. Images are processed in memory, sent to our AI backend, and immediately discarded.</li>
            <li>We do not sell your data to third parties.</li>
            <li>We do not use tracking pixels, third-party analytics, or advertising networks.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">3. How We Use Your Information</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>To create and manage your account and license</li>
            <li>To personalise AI responses to your CV and interview context</li>
            <li>To enforce free-tier usage limits</li>
            <li>To process payments and send receipts</li>
            <li>To provide customer support</li>
            <li>To improve the Service (using aggregated, anonymised usage patterns)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">4. Third-Party Services</h2>
          <p>We use the following third-party services to operate ZoomGuru:</p>
          <ul className="list-disc pl-6 mt-3 space-y-2">
            <li><span className="text-white/90 font-medium">DeepSeek</span> — AI model provider. Your CV profile and interview transcripts are sent to DeepSeek's API to generate responses. DeepSeek's privacy policy governs their handling of this data.</li>
            <li><span className="text-white/90 font-medium">Paystack</span> — Payment processor. Handles all card and bank transfer transactions. Paystack's privacy policy governs their handling of payment data.</li>
            <li><span className="text-white/90 font-medium">Neon (PostgreSQL)</span> — Database hosting for user accounts, sessions, and license data. Data is stored on servers in the United States.</li>
            <li><span className="text-white/90 font-medium">Render</span> — Backend API hosting. Located in the United States.</li>
            <li><span className="text-white/90 font-medium">Vercel</span> — Landing page hosting. Located in the United States.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">5. Data Retention</h2>
          <p>
            We retain your account data for as long as your account is active. If you delete your
            account, your personal data, CV profile, and session history will be deleted within 30 days.
            Payment records are retained for 7 years as required by financial regulations.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">6. Data Security</h2>
          <p>
            We take reasonable technical and organisational measures to protect your data, including:
          </p>
          <ul className="list-disc pl-6 mt-3 space-y-1">
            <li>Passwords are hashed using bcrypt (cost factor 12)</li>
            <li>API keys are stored server-side only — never in the Electron binary</li>
            <li>All communications use HTTPS/TLS</li>
            <li>JWT tokens expire after 15 minutes; refresh tokens after 30 days</li>
            <li>Local data in the Electron app is encrypted using your device fingerprint</li>
          </ul>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">7. Your Rights</h2>
          <p>You have the right to:</p>
          <ul className="list-disc pl-6 mt-3 space-y-2">
            <li>Access the personal data we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your account and associated data</li>
            <li>Export your session history and CV profile</li>
          </ul>
          <p className="mt-3">
            To exercise any of these rights, email{' '}
            <a href="mailto:support@zoomguru.com" className="text-white underline underline-offset-2 hover:text-white/80">
              support@zoomguru.com
            </a>.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">8. Children's Privacy</h2>
          <p>
            ZoomGuru is not directed at children under 18. We do not knowingly collect personal data
            from anyone under 18 years of age.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">9. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of significant
            changes by updating the "Last updated" date at the top of this page. Continued use of the
            Service after changes are posted constitutes acceptance of the revised policy.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">10. Contact</h2>
          <p>
            For privacy-related questions or requests, contact us at{' '}
            <a href="mailto:support@zoomguru.com" className="text-white underline underline-offset-2 hover:text-white/80">
              support@zoomguru.com
            </a>.
          </p>
        </section>

      </div>

      <div className="mt-16 pt-8 border-t border-white/10 flex flex-wrap gap-6 text-xs text-white/40">
        <Link href="/terms" className="hover:text-white/70 transition-colors">Terms and Conditions</Link>
        <Link href="/refund-policy" className="hover:text-white/70 transition-colors">Refund Policy</Link>
        <Link href="/faq" className="hover:text-white/70 transition-colors">FAQ</Link>
      </div>
    </div>
  );
}
