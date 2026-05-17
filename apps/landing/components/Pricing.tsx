'use client';

import { useState } from 'react';
import Script from 'next/script';

declare global {
  interface Window {
    PaystackPop: {
      newTransaction: (config: {
        key: string;
        email: string;
        amount: number;
        currency: string;
        ref: string;
        metadata?: Record<string, unknown>;
        onSuccess: (transaction: { reference: string }) => void;
        onCancel: () => void;
      }) => void;
    };
  }
}

const PAYSTACK_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || 'pk_live_xxxxxxxxxxxx';

const plans = {
  monthly: {
    name: 'Monthly Pro',
    ngn: 15000,
    usd: 12,
    period: '/month',
    badge: null,
    features: [
      'Unlimited interview sessions',
      'Unlimited AI responses',
      'Screenshot + vision mode',
      'Wake word: "Hey ZoomGuru"',
      'Session transcript export',
      'Deep reasoning (coding/design)',
      'CV-personalized answers',
      'Mac + Windows',
    ],
    cta: 'Start Monthly Pro',
    paystackAmountNGN: 1500000, // kobo
    paystackAmountUSD: 1200, // cents
    plan: 'monthly',
  },
  lifetime: {
    name: 'Lifetime Pro',
    ngn: 100000,
    usd: 79,
    period: ' one-time',
    badge: 'Best Value',
    features: [
      'Everything in Monthly',
      'One-time payment — no recurring',
      'Device-locked license',
      'All future updates included',
      'Priority support',
      'Early access to new features',
      'Lifetime access',
      'Mac + Windows',
    ],
    cta: 'Get Lifetime Access',
    paystackAmountNGN: 10000000, // kobo
    paystackAmountUSD: 7900, // cents
    plan: 'lifetime',
  },
};

const freeFeatures = [
  '3 interview sessions total',
  '10 AI responses per session',
  'No credit card required',
  'Mac + Windows',
];

export default function Pricing() {
  const [currency, setCurrency] = useState<'NGN' | 'USD'>('NGN');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');

  function generateRef() {
    return 'ZG-' + Math.random().toString(36).slice(2, 10).toUpperCase();
  }

  function handlePay(planKey: 'monthly' | 'lifetime') {
    if (!email || !email.includes('@')) {
      setEmailError('Please enter a valid email address to continue.');
      return;
    }
    setEmailError('');

    const plan = plans[planKey];
    const amount =
      currency === 'NGN' ? plan.paystackAmountNGN : plan.paystackAmountUSD;
    const ref = generateRef();

    window.PaystackPop.newTransaction({
      key: PAYSTACK_PUBLIC_KEY,
      email,
      amount,
      currency,
      ref,
      metadata: { plan: plan.plan, currency },
      onSuccess(tx) {
        window.location.href = `/download?ref=${tx.reference}&plan=${plan.plan}`;
      },
      onCancel() {
        // User closed modal — no action needed
      },
    });
  }

  return (
    <section id="pricing" className="py-24 px-4 bg-zinc-950 relative overflow-hidden">
      <Script
        src="https://js.paystack.co/v2/inline.js"
        strategy="lazyOnload"
      />

      {/* Background */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-violet-600/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-5xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-blue-400 text-sm font-semibold uppercase tracking-widest mb-3">
            Pricing
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            One tool. Every interview.
          </h2>
          <p className="text-zinc-400 text-lg max-w-xl mx-auto">
            Start free. Upgrade when you land the job — or before your next one.
          </p>
        </div>

        {/* Currency toggle */}
        <div className="flex justify-center mb-10">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-1 flex gap-1">
            {(['NGN', 'USD'] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  currency === c
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {c === 'NGN' ? '🇳🇬 NGN (₦)' : '🇺🇸 USD ($)'}
              </button>
            ))}
          </div>
        </div>

        {/* Email input */}
        <div className="max-w-sm mx-auto mb-8">
          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) setEmailError('');
            }}
            className="w-full bg-zinc-900 border border-zinc-700 focus:border-blue-500 text-white placeholder-zinc-500 rounded-xl px-4 py-3 text-sm outline-none transition-colors"
          />
          {emailError && (
            <p className="text-red-400 text-xs mt-2">{emailError}</p>
          )}
          <p className="text-zinc-600 text-xs mt-2 text-center">
            Enter your email to pay — license is sent here
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {(Object.entries(plans) as [keyof typeof plans, typeof plans[keyof typeof plans]][]).map(
            ([key, plan]) => (
              <div
                key={key}
                className={`relative bg-zinc-900 rounded-2xl border transition-all duration-300 overflow-hidden ${
                  plan.badge
                    ? 'border-blue-500/60 shadow-lg shadow-blue-500/10'
                    : 'border-zinc-800 hover:border-zinc-700'
                }`}
              >
                {/* Best value badge */}
                {plan.badge && (
                  <div className="bg-blue-600 text-white text-xs font-bold px-3 py-1.5 text-center">
                    ⭐ {plan.badge}
                  </div>
                )}

                <div className="p-6">
                  <h3 className="text-white font-bold text-xl mb-1">
                    {plan.name}
                  </h3>

                  {/* Price */}
                  <div className="flex items-end gap-1 mb-6">
                    <span className="text-4xl font-bold text-white">
                      {currency === 'NGN'
                        ? `₦${plan.ngn.toLocaleString()}`
                        : `$${plan.usd}`}
                    </span>
                    <span className="text-zinc-500 text-sm mb-1">
                      {plan.period}
                    </span>
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <svg
                          className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        <span className="text-zinc-300 text-sm">{f}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Pay button */}
                  <button
                    onClick={() => handlePay(key)}
                    className={`w-full font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
                      plan.badge
                        ? 'bg-blue-600 hover:bg-blue-500 text-white'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700'
                    }`}
                  >
                    {plan.cta}
                  </button>
                </div>
              </div>
            )
          )}
        </div>

        {/* Free tier note */}
        <div className="mt-10 max-w-3xl mx-auto">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-1">
                <h4 className="text-white font-semibold mb-1">
                  Free tier — no card required
                </h4>
                <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2">
                  {freeFeatures.map((f, i) => (
                    <span key={i} className="text-zinc-400 text-sm flex items-center gap-1.5">
                      <span className="text-zinc-600">·</span> {f}
                    </span>
                  ))}
                </div>
              </div>
              <a
                href="/download"
                className="flex-shrink-0 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white font-medium py-2.5 px-5 rounded-xl transition-colors text-sm"
              >
                Download free
              </a>
            </div>
          </div>
        </div>

        {/* Trust badges */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-zinc-600 text-xs">
          <span className="flex items-center gap-1.5">
            <span>🔒</span> Secured by Paystack
          </span>
          <span className="flex items-center gap-1.5">
            <span>🔐</span> Device-locked license
          </span>
          <span className="flex items-center gap-1.5">
            <span>✉️</span> License sent to your email
          </span>
          <span className="flex items-center gap-1.5">
            <span>💳</span> Card, bank transfer, USSD
          </span>
        </div>
      </div>
    </section>
  );
}
