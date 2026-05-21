'use client';

import { useState } from 'react';

const faqs = [
  { category: 'Product', question: 'Is it really invisible to Zoom, Meet, Teams, and Chrome screen share?', answer: 'Yes. ZoomGuru uses OS-level window exclusion APIs: SetWindowDisplayAffinity (WDA_EXCLUDEFROMCAPTURE) on Windows and setContentProtection on macOS. These operate below the application layer, so Zoom, Google Meet, Teams, Webex, OBS, and browser-based screen sharing cannot capture the overlay.' },
  { category: 'Product', question: 'How fast are the answers?', answer: 'The first word appears in under 500ms. Full answers stream word by word over 2–4 seconds so you can start reading and speaking almost immediately, using Server-Sent Events (SSE).' },
  { category: 'Product', question: 'What question types does ZoomGuru handle?', answer: 'ZoomGuru auto-routes: behavioral (STAR method), technical definitions, coding (approach + code + complexity), system design (requirements, architecture, bottlenecks), and math. Screenshot mode reads LeetCode problems, whiteboard diagrams, and code on screen.' },
  { category: 'Product', question: 'Does it work offline?', answer: 'AI responses require internet. Wake word detection and speech transcription via the local Whisper tiny model work offline.' },
  { category: 'Product', question: 'What operating systems?', answer: 'Windows 10/11 (64-bit) and macOS 12 Monterey or later (Intel and Apple Silicon). Screen share protection requires Windows 10 v2004+.' },
  { category: 'Plans & Billing', question: 'What do I get on the free plan?', answer: '3 complete interview sessions with up to 10 AI responses each. Full AI engine, voice listening, answer streaming, and CV personalisation. Screenshot mode and wake word are Pro-only.' },
  { category: 'Plans & Billing', question: 'Monthly vs Lifetime?', answer: 'Monthly (₦15,000) gives full Pro access for 30 days — no auto-renewal. Lifetime (₦100,000) is a one-time payment that never expires. Both are device-locked to one machine.' },
  { category: 'Plans & Billing', question: 'How do I pay?', answer: 'Payments via Paystack: card, bank transfer, or USSD. All prices in NGN. Your card details are never stored by ZoomGuru.' },
  { category: 'Plans & Billing', question: 'Can I get a refund?', answer: 'No — all sales are final due to instant digital license delivery. Use the free tier to test before purchasing. Billing errors? Email support@zoomguru.com within 7 days with your payment reference.' },
  { category: 'Device & Licensing', question: 'Can I use it on multiple devices?', answer: 'Each license is locked to one machine via SHA-256 hardware fingerprint. One license = one machine. Need to transfer? Email support — we allow one transfer every 90 days.' },
  { category: 'Privacy & Security', question: 'Is my CV data safe?', answer: 'CV text is transmitted over HTTPS and stored encrypted, used only to personalise your responses. We never sell or share your CV. You can delete all data from Settings at any time. Audio is never sent to our servers.' },
  { category: 'Privacy & Security', question: 'Does ZoomGuru record my audio?', answer: 'No. Speech-to-text runs entirely on your device using a local Whisper model. Only the final text transcript is sent to our backend for AI processing.' },
  { category: 'Referrals', question: 'How does the referral programme work?', answer: 'Every account gets a unique referral link. When someone purchases using your link, you earn 25% commission. Withdraw once you reach ₦1,000 minimum. Payouts within 2–3 business days.' },
];

const categories = ['All', ...Array.from(new Set(faqs.map(f => f.category)))];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [cat, setCat] = useState('All');

  const filtered = cat === 'All' ? faqs : faqs.filter(f => f.category === cat);

  return (
    <section id="faq" style={{ padding: '96px 24px', borderTop: '1px solid #e5e5e5' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>

        <div style={{ marginBottom: 48 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>FAQ</p>
          <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 900, color: '#111', letterSpacing: '-1.5px', lineHeight: 1.05 }}>
            Common questions.<br />
            <a href="mailto:support@zoomguru.com" style={{ fontStyle: 'italic', fontWeight: 300, color: '#888', textDecoration: 'none', borderBottom: '1px solid #ccc' }}>Anything else, email us.</a>
          </h2>
        </div>

        {/* Category filter */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 32 }}>
          {categories.map(c => (
            <button key={c} onClick={() => { setCat(c); setOpenIndex(null); }} style={{
              padding: '6px 16px', borderRadius: 100, fontSize: 12, fontWeight: 600,
              background: cat === c ? '#111' : 'transparent',
              color: cat === c ? '#fff' : '#666',
              border: `1.5px solid ${cat === c ? '#111' : '#e5e5e5'}`,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s',
            }}>{c}</button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((faq, i) => (
            <div key={i} style={{
              background: openIndex === i ? '#fff' : '#fafaf8',
              border: `1.5px solid ${openIndex === i ? '#e5e5e5' : '#ebebeb'}`,
              borderRadius: 12, overflow: 'hidden',
              transition: 'background 0.12s',
            }}>
              <button onClick={() => setOpenIndex(openIndex === i ? null : i)} style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 16, padding: '16px 20px', background: 'none', border: 'none',
                textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
              }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#111', lineHeight: 1.4 }}>{faq.question}</span>
                <span style={{
                  width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                  background: openIndex === i ? '#111' : 'transparent',
                  border: `1.5px solid ${openIndex === i ? '#111' : '#ddd'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transform: openIndex === i ? 'rotate(45deg)' : 'none',
                  transition: 'transform 0.15s, background 0.15s',
                }}>
                  <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke={openIndex === i ? '#fff' : '#999'} strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
                  </svg>
                </span>
              </button>
              {openIndex === i && (
                <div style={{ padding: '0 20px 18px' }}>
                  <p style={{ fontSize: 14, color: '#555', lineHeight: 1.7 }}>{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ marginTop: 48, background: '#111', borderRadius: 16, padding: 36, textAlign: 'center' }}>
          <h3 style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px', marginBottom: 8 }}>Ready to ace your next interview?</h3>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 24 }}>Start free. No card required. 3 full sessions.</p>
          <a href="/pricing" style={{ display: 'inline-block', background: '#fff', color: '#111', fontWeight: 700, fontSize: 15, padding: '12px 28px', borderRadius: 12, textDecoration: 'none' }}>Start free →</a>
        </div>
      </div>
    </section>
  );
}
