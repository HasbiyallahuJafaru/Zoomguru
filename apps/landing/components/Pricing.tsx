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

const PAYSTACK_PUBLIC_KEY = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || 'pk_live_xxxxxxxxxxxx';

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
      'Deep reasoning (coding / design)',
      'CV-personalized answers',
      'Mac + Windows',
    ],
    cta: 'Start Monthly Pro',
    paystackAmountNGN: 1500000,
    paystackAmountUSD: 1200,
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
      'All future updates, forever',
      'Priority support',
      'Early access to new features',
      'Lifetime access',
      'Mac + Windows',
    ],
    cta: 'Get Lifetime Access',
    paystackAmountNGN: 10000000,
    paystackAmountUSD: 7900,
    plan: 'lifetime',
  },
};

const freeFeatures = [
  '3 interview sessions',
  '10 AI responses per session',
  'No credit card required',
  'Mac + Windows',
];

function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

export default function Pricing() {
  const [currency, setCurrency] = useState<'NGN' | 'USD'>('NGN');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');

  function generateRef() {
    return 'ZG-' + Math.random().toString(36).slice(2, 10).toUpperCase();
  }

  function handlePay(planKey: 'monthly' | 'lifetime') {
    if (!email || !email.includes('@')) {
      setEmailError('Enter a valid email to continue.');
      return;
    }
    setEmailError('');
    const plan = plans[planKey];
    const amount = currency === 'NGN' ? plan.paystackAmountNGN : plan.paystackAmountUSD;
    window.PaystackPop.newTransaction({
      key: PAYSTACK_PUBLIC_KEY,
      email,
      amount,
      currency,
      ref: generateRef(),
      metadata: { plan: plan.plan, currency },
      onSuccess(tx) {
        window.location.href = `/download?ref=${tx.reference}&plan=${plan.plan}`;
      },
      onCancel() {},
    });
  }

  return (
    <section id="pricing" className="py-28 px-4 relative overflow-hidden" style={{ background: '#06060f' }}>
      <Script src="https://js.paystack.co/v2/inline.js" strategy="lazyOnload" />

      {/* Glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(139,92,246,0.06) 0%, transparent 70%)' }} />

      <div className="max-w-5xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-14">
          <p className="text-indigo-400 text-xs font-bold uppercase tracking-[0.2em] mb-4">
            Pricing
          </p>
          <h2 className="text-4xl sm:text-5xl font-black text-white mb-5 tracking-tight">
            One tool.{' '}
            <span className="gradient-text">Every interview.</span>
          </h2>
          <p className="text-zinc-500 text-lg font-light max-w-xl mx-auto">
            Start free. Upgrade when you land the job — or before your next one.
          </p>
        </div>

        {/* Currency toggle */}
        <div className="flex justify-center mb-10">
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            {(['NGN', 'USD'] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  currency === c
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {c === 'NGN' ? '🇳🇬 NGN (₦)' : '🇺🇸 USD ($)'}
              </button>
            ))}
          </div>
        </div>

        {/* Email input */}
        <div className="max-w-sm mx-auto mb-10">
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(''); }}
              className="w-full pl-10 pr-4 py-3 text-sm text-white placeholder-zinc-600 rounded-xl outline-none transition-all"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${emailError ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.08)'}`,
              }}
              onFocus={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = 'rgba(99,102,241,0.5)'; }}
              onBlur={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = emailError ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.08)'; }}
            />
          </div>
          {emailError && <p className="text-red-400 text-xs mt-2 pl-1">{emailError}</p>}
          <p className="text-zinc-700 text-xs mt-2 text-center">
            Enter your email — license is delivered here
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl mx-auto">
          {(Object.entries(plans) as [keyof typeof plans, (typeof plans)[keyof typeof plans]][]).map(([key, plan]) => (
            <div
              key={key}
              className={`relative rounded-2xl overflow-hidden transition-all duration-300 ${
                plan.badge ? 'gradient-border' : ''
              }`}
              style={{
                background: plan.badge
                  ? 'linear-gradient(160deg, rgba(15,12,30,1) 0%, rgba(10,8,20,1) 100%)'
                  : 'rgba(255,255,255,0.025)',
                border: plan.badge ? 'none' : '1px solid rgba(255,255,255,0.07)',
              }}
            >
              {/* Lifetime glow */}
              {plan.badge && (
                <div className="absolute top-0 left-0 right-0 h-px"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.6), rgba(196,181,253,0.4), transparent)' }} />
              )}

              {/* Best value badge */}
              {plan.badge && (
                <div className="flex items-center justify-center gap-2 py-2.5"
                  style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))' }}>
                  <svg className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="text-amber-400 text-xs font-bold tracking-wide">{plan.badge}</span>
                </div>
              )}

              <div className="p-7">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="text-white font-bold text-xl mb-1 tracking-tight">{plan.name}</h3>
                    <div className="flex items-end gap-1">
                      <span className="text-4xl font-black text-white tracking-tight">
                        {currency === 'NGN' ? `₦${plan.ngn.toLocaleString()}` : `$${plan.usd}`}
                      </span>
                      <span className="text-zinc-500 text-sm mb-1 font-light">{plan.period}</span>
                    </div>
                  </div>
                </div>

                <ul className="space-y-2.5 mb-8">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <CheckIcon />
                      <span className="text-zinc-400 text-sm font-light">{f}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handlePay(key)}
                  className={`w-full font-bold py-3.5 px-6 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.97] text-sm ${
                    plan.badge
                      ? 'btn-shimmer text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40'
                      : 'text-zinc-200 hover:text-white hover:bg-white/8'
                  }`}
                  style={plan.badge ? {} : {
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  {plan.cta}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Free tier */}
        <div className="mt-6 max-w-3xl mx-auto rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-5"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex-1">
            <p className="text-white text-sm font-semibold mb-2">Free tier — no card required</p>
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              {freeFeatures.map((f, i) => (
                <span key={i} className="text-zinc-500 text-xs flex items-center gap-1.5 font-light">
                  <span className="text-zinc-700">·</span> {f}
                </span>
              ))}
            </div>
          </div>
          <a
            href="/download"
            className="flex-shrink-0 text-zinc-400 hover:text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors hover:bg-white/5"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}
          >
            Download free
          </a>
        </div>

        {/* Trust badges */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-zinc-700 text-xs">
          {[
            { icon: '🔒', text: 'Secured by Paystack' },
            { icon: '🔐', text: 'Device-locked license' },
            { icon: '✉️', text: 'License sent to email' },
            { icon: '💳', text: 'Card · Bank transfer · USSD' },
          ].map((b, i) => (
            <span key={i} className="flex items-center gap-1.5 hover:text-zinc-500 transition-colors">
              <span>{b.icon}</span> {b.text}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
