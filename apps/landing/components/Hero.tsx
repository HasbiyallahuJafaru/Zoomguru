'use client';

import { useState, useEffect } from 'react';

const MOCK_ANSWERS = [
  'At Acme Corp I led the migration of a 2M-user Node.js monolith to microservices. Deployment time dropped 60% and p99 latency fell from 800ms to 90ms by introducing Redis caching at the API gateway layer.',
  'I have 4 years with React and TypeScript. Built a real-time trading dashboard processing 80k events per second using React Query for server state, Zustand for local state, and WebSockets with exponential backoff reconnection.',
  'For this system I would start with a load balancer across 3 AZs, Postgres with read replicas for strong consistency, a write-through Redis cache for hot data, and async Kafka queues to decouple the notification service.',
];

const QUESTIONS = [
  'Tell me about a time you led a complex migration.',
  'Walk me through your React experience.',
  'How would you design a high-traffic notification system?',
];

export default function Hero() {
  const [qi, setQi] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [charIdx, setCharIdx] = useState(0);
  const [phase, setPhase] = useState<'typing' | 'pause'>('typing');

  const fullText = MOCK_ANSWERS[qi];

  useEffect(() => {
    if (phase === 'typing') {
      if (charIdx < fullText.length) {
        const t = setTimeout(() => { setDisplayText(fullText.slice(0, charIdx + 1)); setCharIdx(i => i + 1); }, 14);
        return () => clearTimeout(t);
      } else {
        const t = setTimeout(() => setPhase('pause'), 3200);
        return () => clearTimeout(t);
      }
    } else {
      const t = setTimeout(() => {
        const next = (qi + 1) % MOCK_ANSWERS.length;
        setQi(next); setDisplayText(''); setCharIdx(0); setPhase('typing');
      }, 800);
      return () => clearTimeout(t);
    }
  }, [charIdx, fullText, phase, qi]);

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-4 pt-24 pb-16 overflow-hidden">
      <div className="relative z-10 max-w-4xl w-full mx-auto text-center">

        <div
          className="inline-flex items-center gap-2 text-white/65 text-xs font-semibold px-4 py-2 rounded-full mb-8 tracking-wide"
          style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
          </svg>
          Invisible to all screen share software
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white leading-[1.05] tracking-tight mb-6">
          Your invisible AI edge
          <br />
          in every interview.
        </h1>

        <p className="text-white/65 text-lg sm:text-xl leading-relaxed mb-10 max-w-2xl mx-auto font-light">
          ZoomGuru sits on your screen, visible <span className="text-white font-medium">only to you</span>.
          It listens to questions, reads your screen, and streams answers in real time,{' '}
          <span className="text-white font-medium">personalized to your CV</span>.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          <a
            href="/pricing"
            className="btn-shimmer font-bold py-4 px-8 rounded-2xl shadow-xl hover:opacity-90 transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] text-center text-base"
          >
            Start free
          </a>
          <a
            href="/how-it-works"
            className="text-white/70 hover:text-white font-semibold py-4 px-8 rounded-2xl transition-all duration-200 text-center text-base inline-flex items-center justify-center gap-2"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            See how it works
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>

        <p className="text-white/50 text-sm">
          No credit card required. Mac and Windows. Device-locked license.
        </p>

        {/* Stats strip */}
        <div className="mt-20">
          <div className="section-divider mb-10" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            {[
              { value: 'Sub 500ms', label: 'First AI word' },
              { value: '100%', label: 'Screen share invisible' },
              { value: '2 AI models', label: 'Auto-routed by question' },
              { value: 'CV locked', label: 'Personalized answers' },
            ].map((s, i) => (
              <div key={i} className="flex flex-col gap-1">
                <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">{s.value}</span>
                <span className="text-white/55 text-xs sm:text-sm font-medium">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
