'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { useSession } from 'next-auth/react';

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const ref = searchParams.get('reference') || searchParams.get('ref');
  const plan = searchParams.get('plan');
  const [countdown, setCountdown] = useState(5);
  const { data: session } = useSession();
  const [activating, setActivating] = useState(false);
  const [activationDone, setActivationDone] = useState(false);
  const [activationError, setActivationError] = useState('');

  useEffect(() => {
    if (!ref || activationDone || !session) return;
    // Use a ref to prevent double-fire if session object identity changes
    setActivating(true);
    fetch('/api/proxy/paystack/verify-transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference: ref }),
    })
      .then(r => r.json())
      .then(() => { setActivationDone(true); setActivating(false); })
      .catch(() => { setActivationError('Could not verify payment automatically. Please contact support.'); setActivating(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4 py-20">
      <div className="max-w-lg w-full text-center">
        {/* Success icon */}
        <div className="flex items-center justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-green-500/10 border-2 border-green-500 flex items-center justify-center">
            <svg
              className="w-10 h-10 text-green-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>

        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">
            Z
          </div>
          <span className="text-white font-semibold text-lg">ZoomGuru</span>
        </div>

        <h1 className="text-3xl font-bold text-white mb-3">
          Payment Successful!
        </h1>
        <p className="text-green-400 font-semibold text-lg mb-2">
          Your Pro license is activated.
        </p>
        <p className="text-zinc-400 mb-6">
          {plan === 'monthly'
            ? 'Monthly Pro plan is now active on your account.'
            : plan === 'lifetime'
            ? 'Lifetime Pro access is locked to your device — no recurring charges ever.'
            : 'Your license is now active on your account.'}
        </p>

        {ref && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-sm text-zinc-400 mb-3">
            Transaction reference:{' '}
            <span className="text-zinc-300 font-mono text-xs">{ref}</span>
          </div>
        )}

        {activating && (
          <div className="text-zinc-400 text-sm mb-4">Activating your license…</div>
        )}
        {activationDone && (
          <div className="text-green-400 text-sm mb-4">✓ License activated on your account.</div>
        )}
        {activationError && (
          <div className="text-red-400 text-sm mb-4">{activationError}</div>
        )}

        {/* CTA */}
        <Link
          href={`/download?ref=${ref ?? ''}&plan=${plan ?? ''}`}
          className="block w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-4 px-8 rounded-xl transition-colors text-lg mb-4"
        >
          ⬇ Download ZoomGuru Now
        </Link>

        <p className="text-zinc-500 text-sm mb-8">
          Or find the download link in your inbox.
        </p>

        {/* Next steps */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-left">
          <h2 className="text-white font-semibold mb-4">What happens next</h2>
          <ul className="space-y-3 text-zinc-400 text-sm">
            <li className="flex items-start gap-3">
              <span className="text-blue-400 mt-0.5">→</span>
              <span>
                Download and install ZoomGuru for your operating system.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-blue-400 mt-0.5">→</span>
              <span>
                Log in with the email address you used to purchase. Your Pro
                license will be automatically applied.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-blue-400 mt-0.5">→</span>
              <span>
                Upload your CV in the app Settings. ZoomGuru uses it to
                personalise every answer to your background.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-blue-400 mt-0.5">→</span>
              <span>
                Start your next interview with confidence. Press{' '}
                <kbd className="bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded text-xs font-mono">
                  Ctrl+Shift+A
                </kbd>{' '}
                or say &quot;Hey ZoomGuru&quot; whenever you need an answer.
              </span>
            </li>
          </ul>
        </div>

        <p className="mt-6 text-zinc-500 text-sm">
          Questions?{' '}
          <a
            href="mailto:support@zoomguru.xyz"
            className="text-blue-400 hover:underline"
          >
            support@zoomguru.xyz
          </a>
        </p>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
          <div className="text-zinc-400">Loading...</div>
        </div>
      }
    >
      <PaymentSuccessContent />
    </Suspense>
  );
}
