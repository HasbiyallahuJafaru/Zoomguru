import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Refund Policy — ZoomGuru',
  description: 'ZoomGuru refund policy. All sales are final.',
};

const LAST_UPDATED = 'May 19, 2025';

export default function RefundPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-24">
      <div className="mb-12">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-white/40 mb-3">Legal</p>
        <h1 className="text-4xl font-black text-white tracking-tight mb-4">Refund Policy</h1>
        <p className="text-white/50 text-sm">Last updated: {LAST_UPDATED}</p>
      </div>

      <div className="space-y-10 text-white/70 text-sm leading-relaxed">

        <section>
          <div
            className="rounded-xl p-5 mb-8"
            style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            <p className="text-white font-bold text-base mb-1">All sales are final.</p>
            <p className="text-white/65">
              ZoomGuru does not offer refunds under any circumstances once a purchase has been completed
              and a license has been issued.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">1. No-Refund Policy</h2>
          <p>
            Due to the digital nature of ZoomGuru and the immediate delivery of a license upon payment,
            all purchases are non-refundable. This applies to both Monthly (&#8358;15,000) and Lifetime
            (&#8358;100,000) plans.
          </p>
          <p className="mt-3">
            By completing your purchase, you acknowledge and agree that you will not be entitled to a
            refund under any circumstances, including but not limited to:
          </p>
          <ul className="list-disc pl-6 mt-3 space-y-2">
            <li>Change of mind after purchase.</li>
            <li>Failure to read or understand the product description before buying.</li>
            <li>Technical issues on your own device or operating system.</li>
            <li>Incompatibility with a specific version of screen sharing software.</li>
            <li>Being disqualified or dismissed from an interview.</li>
            <li>Failure to use the product within a subscription period.</li>
            <li>Purchasing the wrong plan.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">2. Free Trial</h2>
          <p>
            ZoomGuru offers a free tier that includes 3 interview sessions with 10 AI responses each.
            This free tier is provided specifically so you can evaluate the product before committing to
            a paid plan. We strongly encourage you to use the free tier to test compatibility and
            functionality on your device before purchasing.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">3. Chargebacks and Disputes</h2>
          <p>
            Initiating a chargeback or payment dispute after receiving and using a ZoomGuru license
            constitutes fraud. We reserve the right to permanently ban any account associated with a
            fraudulent chargeback and to pursue recovery through available legal and financial channels.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">4. Billing Errors</h2>
          <p>
            If you believe you were charged incorrectly (e.g. charged twice for the same plan), please
            contact us at{' '}
            <a href="mailto:support@zoomguru.xyz" className="text-white underline underline-offset-2 hover:text-white/80">
              support@zoomguru.xyz
            </a>{' '}
            within 7 days of the charge with your payment reference. Verified billing errors will be
            corrected promptly. This is the only circumstance under which a payment may be reversed.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">5. Service Availability</h2>
          <p>
            We strive to maintain 99%+ uptime for our backend services. Scheduled or unscheduled
            downtime does not entitle users to refunds or account credits. If you experience persistent
            technical issues unrelated to your own device, please reach out to our support team and we
            will work to resolve the issue.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">6. Contact</h2>
          <p>
            If you have a billing question or believe there has been an error, contact us at{' '}
            <a href="mailto:support@zoomguru.xyz" className="text-white underline underline-offset-2 hover:text-white/80">
              support@zoomguru.xyz
            </a>. Please include your payment reference number and the email address used at checkout.
          </p>
        </section>

      </div>

      <div className="mt-16 pt-8 border-t border-white/10 flex flex-wrap gap-6 text-xs text-white/40">
        <Link href="/terms" className="hover:text-white/70 transition-colors">Terms and Conditions</Link>
        <Link href="/privacy" className="hover:text-white/70 transition-colors">Privacy Policy</Link>
        <Link href="/faq" className="hover:text-white/70 transition-colors">FAQ</Link>
      </div>
    </div>
  );
}
