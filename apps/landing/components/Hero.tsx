'use client';

import { useState, useEffect } from 'react';

const QUESTIONS = [
  'Tell me about a time you led a complex migration.',
  'Walk me through your React experience.',
  'How would you design a high-traffic notification system?',
];

const ANSWERS = [
  'At Acme Corp I led the migration of a 2M-user Node.js monolith to microservices. Deployment time dropped 60% and p99 latency fell from 800ms to 90ms by introducing Redis caching at the API gateway layer.',
  'I have 4 years with React and TypeScript. Built a real-time trading dashboard processing 80k events/sec using React Query, Zustand, and WebSockets with exponential backoff reconnection.',
  'Start with a load balancer across 3 AZs, Postgres with read replicas, a write-through Redis cache for hot data, and async Kafka queues to decouple the notification service.',
];

export default function Hero() {
  const [qi, setQi] = useState(0);
  const [display, setDisplay] = useState('');
  const [charIdx, setCharIdx] = useState(0);
  const [phase, setPhase] = useState<'typing' | 'pause'>('typing');
  const full = ANSWERS[qi];

  useEffect(() => {
    if (phase === 'typing') {
      if (charIdx < full.length) {
        const t = setTimeout(() => { setDisplay(full.slice(0, charIdx + 1)); setCharIdx(i => i + 1); }, 13);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => setPhase('pause'), 3000);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      const next = (qi + 1) % ANSWERS.length;
      setQi(next); setDisplay(''); setCharIdx(0); setPhase('typing');
    }, 700);
    return () => clearTimeout(t);
  }, [charIdx, full, phase, qi]);

  return (
    <section style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '96px 24px 64px', position: 'relative' }}>
      <div style={{ maxWidth: 800, width: '100%', margin: '0 auto', position: 'relative', zIndex: 10 }}>

        {/* Badge */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: '#fff', border: '1.5px solid #e5e5e5',
            borderRadius: 100, padding: '6px 16px',
            fontSize: 12, fontWeight: 600, color: '#555', letterSpacing: '0.04em',
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#111', display: 'inline-block' }} />
            Invisible to all screen share software
          </span>
        </div>

        {/* Headline */}
        <h1 style={{
          fontSize: 'clamp(42px, 8vw, 80px)', fontWeight: 900, color: '#111',
          lineHeight: 1.02, letterSpacing: '-2.5px', textAlign: 'center',
          marginBottom: 24,
        }}>
          Your invisible AI edge<br />
          <span style={{ fontStyle: 'italic', fontWeight: 300, letterSpacing: '-1px' }}>in every interview.</span>
        </h1>

        {/* Sub */}
        <p style={{ fontSize: 18, color: '#555', lineHeight: 1.7, textAlign: 'center', maxWidth: 580, margin: '0 auto 40px', fontWeight: 400 }}>
          ZoomGuru sits on your screen, visible <strong style={{ color: '#111', fontWeight: 600 }}>only to you</strong>.
          It listens to questions, reads your screen, and streams answers in real time —{' '}
          <strong style={{ color: '#111', fontWeight: 600 }}>personalized to your CV</strong>.
        </p>

        {/* CTAs */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 48 }}>
          <a href="/pricing" style={{
            background: '#111', color: '#fff', fontWeight: 700, fontSize: 15,
            padding: '14px 32px', borderRadius: 14, textDecoration: 'none',
            transition: 'background 0.12s, transform 0.1s',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#333'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#111'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >Start free →</a>

          <a href="/how-it-works" style={{
            background: '#fff', color: '#111', fontWeight: 600, fontSize: 15,
            padding: '14px 32px', borderRadius: 14, textDecoration: 'none',
            border: '1.5px solid #ddd', transition: 'border-color 0.12s',
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = '#111')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = '#ddd')}
          >See how it works</a>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#999' }}>
          No credit card required · Mac &amp; Windows · Device-locked license
        </p>

        {/* Live demo card */}
        <div style={{ marginTop: 56, background: '#fff', border: '1.5px solid #e5e5e5', borderRadius: 20, overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.07)' }}>
          {/* Question bar */}
          <div style={{ background: '#f5f5f3', borderBottom: '1px solid #e5e5e5', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Interviewer</span>
            <span style={{ fontSize: 13, color: '#333', fontStyle: 'italic' }}>{QUESTIONS[qi]}</span>
          </div>
          {/* Answer */}
          <div style={{ padding: '20px 24px', minHeight: 90 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                <span style={{ color: '#fff', fontSize: 11, fontWeight: 900 }}>Z</span>
              </div>
              <p style={{ fontSize: 14, color: '#222', lineHeight: 1.65, flex: 1 }}>
                {display}<span style={{ animation: 'blink 1s infinite', opacity: 1, borderRight: '2px solid #111', marginLeft: 1 }} className="animate-blink">&nbsp;</span>
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ marginTop: 48, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, textAlign: 'center' }}>
          {[
            { value: '<500ms', label: 'First AI word' },
            { value: '100%', label: 'Screen share invisible' },
            { value: '2 models', label: 'Auto-routed by question' },
            { value: 'CV-locked', label: 'Personalized answers' },
          ].map((s, i) => (
            <div key={i} style={{ borderTop: '2px solid #111', paddingTop: 16 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#111', letterSpacing: '-0.5px' }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#777', marginTop: 4, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
