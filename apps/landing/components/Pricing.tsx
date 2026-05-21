'use client';

import { useState } from 'react';
import Script from 'next/script';

declare global {
  interface Window {
    PaystackPop: new () => {
      newTransaction: (config: {
        key: string; email: string; amount: number; currency: string;
        ref: string; metadata?: Record<string, unknown>;
        onSuccess: (transaction: { reference: string }) => void;
        onCancel: () => void;
      }) => void;
    };
  }
}

const PAYSTACK_PUBLIC_KEY = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || '';

const plans = {
  monthly: {
    name: 'Monthly Pro',
    price: '₦15,000',
    period: '/month',
    badge: null,
    features: ['Unlimited interview sessions', 'Unlimited AI responses', 'Screenshot and vision mode', 'Wake word: Hey ZoomGuru', 'Session transcript export', 'Deep reasoning for coding & design', 'CV-personalized answers', 'Mac and Windows'],
    cta: 'Start Monthly Pro',
    paystackAmount: 1500000,
    plan: 'monthly',
    dark: false,
  },
  lifetime: {
    name: 'Lifetime Pro',
    price: '₦100,000',
    period: ' one-time',
    badge: 'Best Value',
    features: ['Everything in Monthly', 'One-time payment, no recurring charges', 'Device-locked license', 'All future updates, forever', 'Priority support', 'Early access to new features', 'Mac and Windows'],
    cta: 'Get Lifetime Access',
    paystackAmount: 10000000,
    plan: 'lifetime',
    dark: true,
  },
};

const freeFeatures = ['3 interview sessions', '10 AI responses per session', 'No credit card required', 'Mac and Windows'];

export default function Pricing() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');

  function handlePay(planKey: 'monthly' | 'lifetime') {
    if (!email || !email.includes('@')) {
      setEmailError('Enter a valid email to continue.');
      return;
    }
    if (!window.PaystackPop) {
      setEmailError('Payment is loading, please try again in a moment.');
      return;
    }
    setEmailError('');
    const plan = plans[planKey];
    let refCode: string | null = null;
    try { refCode = localStorage.getItem('zg_ref'); } catch {}
    const popup = new window.PaystackPop();
    popup.newTransaction({
      key: PAYSTACK_PUBLIC_KEY,
      email,
      amount: plan.paystackAmount,
      currency: 'NGN',
      ref: 'ZG-' + Math.random().toString(36).slice(2, 10).toUpperCase(),
      metadata: { plan: plan.plan, ref_code: refCode || undefined },
      onSuccess(tx) { window.location.href = `/download?ref=${tx.reference}&plan=${plan.plan}`; },
      onCancel() {},
    });
  }

  return (
    <section id="pricing" style={{ padding: '96px 24px', borderTop: '1px solid #e5e5e5' }}>
      <Script src="https://js.paystack.co/v2/inline.js" strategy="afterInteractive" />

      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        <div style={{ marginBottom: 48 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>Pricing</p>
          <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 900, color: '#111', letterSpacing: '-1.5px', lineHeight: 1.05 }}>
            One tool.<br />
            <span style={{ fontStyle: 'italic', fontWeight: 300 }}>Every interview.</span>
          </h2>
        </div>

        {/* Email */}
        <div style={{ maxWidth: 360, marginBottom: 32, width: '100%' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 8 }}>Your email — required to pay</label>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => { setEmail(e.target.value); if (emailError) setEmailError(''); }}
            style={{
              width: '100%', padding: '11px 14px', borderRadius: 10, fontSize: 14,
              border: `1.5px solid ${emailError ? '#e53e3e' : '#ddd'}`,
              background: '#fff', color: '#111', outline: 'none', fontFamily: 'inherit',
            }}
          />
          {emailError && <p style={{ marginTop: 6, fontSize: 12, color: '#e53e3e' }}>{emailError}</p>}
        </div>

        {/* Plans grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 16 }}>

          {/* Free */}
          <div style={{ background: '#fafaf8', border: '1.5px solid #e5e5e5', borderRadius: 16, padding: 28 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Free</p>
            <div style={{ marginBottom: 20 }}>
              <span style={{ fontSize: 36, fontWeight: 900, color: '#111', letterSpacing: '-1px' }}>₦0</span>
            </div>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {freeFeatures.map(f => (
                <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#555' }}>
                  <span style={{ color: '#22c55e', fontWeight: 700, flexShrink: 0 }}>✓</span>{f}
                </li>
              ))}
            </ul>
            <a href="/download" style={{ display: 'block', textAlign: 'center', padding: '11px', borderRadius: 10, border: '1.5px solid #ddd', color: '#555', fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
              Download free
            </a>
          </div>

          {/* Monthly */}
          <div style={{ background: '#fff', border: '1.5px solid #e5e5e5', borderRadius: 16, padding: 28 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Monthly Pro</p>
            <div style={{ marginBottom: 20 }}>
              <span style={{ fontSize: 36, fontWeight: 900, color: '#111', letterSpacing: '-1px' }}>₦15,000</span>
              <span style={{ fontSize: 13, color: '#888', marginLeft: 4 }}>/month</span>
            </div>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {plans.monthly.features.map(f => (
                <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#444' }}>
                  <span style={{ color: '#22c55e', fontWeight: 700, flexShrink: 0 }}>✓</span>{f}
                </li>
              ))}
            </ul>
            <button onClick={() => handlePay('monthly')} style={{
              display: 'block', width: '100%', padding: '11px', borderRadius: 10,
              border: '1.5px solid #111', background: 'transparent',
              color: '#111', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
            }}>Start Monthly Pro</button>
          </div>

          {/* Lifetime */}
          <div style={{ background: '#111', border: '1.5px solid #111', borderRadius: 16, padding: 28, position: 'relative' }}>
            <span style={{ position: 'absolute', top: -10, right: 16, background: '#fff', color: '#111', fontSize: 11, fontWeight: 800, padding: '3px 12px', borderRadius: 100, letterSpacing: '0.05em' }}>BEST VALUE</span>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Lifetime Pro</p>
            <div style={{ marginBottom: 20 }}>
              <span style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: '-1px' }}>₦100,000</span>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginLeft: 4 }}>one-time</span>
            </div>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {plans.lifetime.features.map(f => (
                <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
                  <span style={{ color: '#4ade80', fontWeight: 700, flexShrink: 0 }}>✓</span>{f}
                </li>
              ))}
            </ul>
            <button onClick={() => handlePay('lifetime')} style={{
              display: 'block', width: '100%', padding: '11px', borderRadius: 10,
              border: 'none', background: '#fff',
              color: '#111', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
            }}>Get Lifetime Access</button>
          </div>
        </div>

        <p style={{ fontSize: 12, color: '#999', textAlign: 'center' }}>All prices in NGN · Payments via Paystack · No auto-renewal · Device-locked license</p>
      </div>
    </section>
  );
}
