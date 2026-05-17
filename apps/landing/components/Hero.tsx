'use client';

import { useState, useEffect } from 'react';

const MOCK_ANSWERS = [
  'At Acme Corp I led the migration of a 2M-user Node.js monolith to microservices — cut deployment time by 60% and reduced p99 latency from 800ms to 90ms by introducing Redis caching at the API gateway layer.',
  'I have 4 years with React and TypeScript. Built a real-time trading dashboard processing 80k events/second — used React Query for server state, Zustand for local state, and WebSockets with exponential backoff reconnection.',
  'For this system I\'d start with a load balancer across 3 AZs, Postgres with read replicas for strong consistency, a write-through Redis cache for hot data, and async Kafka queues to decouple the notification service.',
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
  const [listening, setListening] = useState(false);
  const [phase, setPhase] = useState<'typing' | 'pause'>('typing');

  const fullText = MOCK_ANSWERS[qi];

  useEffect(() => {
    if (phase === 'typing') {
      if (charIdx < fullText.length) {
        const t = setTimeout(() => {
          setDisplayText(fullText.slice(0, charIdx + 1));
          setCharIdx((i) => i + 1);
        }, 14);
        return () => clearTimeout(t);
      } else {
        const t = setTimeout(() => setPhase('pause'), 3200);
        return () => clearTimeout(t);
      }
    } else {
      const t = setTimeout(() => {
        const next = (qi + 1) % MOCK_ANSWERS.length;
        setQi(next);
        setDisplayText('');
        setCharIdx(0);
        setPhase('typing');
      }, 800);
      return () => clearTimeout(t);
    }
  }, [charIdx, fullText, phase, qi]);

  useEffect(() => {
    const t = setInterval(() => setListening((v) => !v), 2000);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-4 pt-24 pb-16 overflow-hidden mesh-bg">

      {/* Ambient glow orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[30%] w-[700px] h-[700px] bg-indigo-600/8 rounded-full blur-[120px] animate-glow-pulse" />
        <div className="absolute bottom-[-5%] right-[-5%] w-[500px] h-[500px] bg-violet-600/6 rounded-full blur-[100px]" />
        <div className="absolute top-[40%] left-[-10%] w-[400px] h-[400px] bg-blue-600/5 rounded-full blur-[80px]" />
      </div>

      <div className="relative z-10 max-w-6xl w-full mx-auto">
        <div className="flex flex-col lg:flex-row items-center gap-14 lg:gap-20">

          {/* ── Left — Copy ── */}
          <div className="flex-1 text-center lg:text-left stagger-1">

            {/* Badge */}
            <div className="inline-flex items-center gap-2.5 bg-indigo-500/8 border border-indigo-500/20 text-indigo-300 text-xs font-semibold px-4 py-2 rounded-full mb-8 tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              Invisible to all screen share software
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white leading-[1.06] tracking-tight mb-6">
              Your invisible{' '}
              <br className="hidden sm:block" />
              <span className="gradient-text">AI edge</span>
              <br className="hidden sm:block" />
              in every interview.
            </h1>

            <p className="text-zinc-400 text-lg sm:text-xl leading-relaxed mb-10 max-w-lg mx-auto lg:mx-0 font-light">
              ZoomGuru sits on your screen — visible{' '}
              <span className="text-zinc-200 font-medium">only to you</span>. Listens to questions,
              reads your screen, streams answers in real time —{' '}
              <span className="text-zinc-200 font-medium">personalized to your CV</span>.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-8">
              <a
                href="#pricing"
                className="btn-shimmer text-white font-bold py-4 px-8 rounded-2xl shadow-2xl shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all duration-300 hover:scale-[1.03] active:scale-[0.97] text-center text-base"
              >
                Start free — 3 sessions
              </a>
              <a
                href="#how-it-works"
                className="glass border-white/10 hover:border-white/20 text-zinc-300 hover:text-white font-semibold py-4 px-8 rounded-2xl transition-all duration-200 text-center text-base hover:bg-white/5"
              >
                See how it works →
              </a>
            </div>

            <p className="text-zinc-600 text-sm">
              No credit card · Mac &amp; Windows · Device-locked license
            </p>
          </div>

          {/* ── Right — App mockup ── */}
          <div className="flex-1 flex items-center justify-center w-full stagger-2">
            <div className="relative w-full max-w-[500px] animate-float">

              {/* Main window — "Zoom call" */}
              <div className="rounded-2xl overflow-hidden border border-white/8 shadow-2xl shadow-black/60"
                style={{ background: 'linear-gradient(160deg, #0e0e1a 0%, #080810 100%)' }}>

                {/* Titlebar */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5"
                  style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/80" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                    <div className="w-3 h-3 rounded-full bg-green-500/80" />
                  </div>
                  <span className="text-zinc-500 text-xs mx-auto font-medium">
                    Zoom — Senior Engineer Interview
                  </span>
                </div>

                {/* Video grid */}
                <div className="p-4 grid grid-cols-2 gap-3 bg-[#07070e]">
                  <div className="rounded-xl bg-zinc-900/80 border border-white/5 flex flex-col items-center justify-center py-8 gap-3">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center text-2xl">
                      👩‍💼
                    </div>
                    <span className="text-zinc-500 text-xs font-medium">Sarah · Interviewer</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-green-500 text-[10px]">speaking</span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-indigo-500/20 flex flex-col items-center justify-center py-8 gap-3"
                    style={{ background: 'rgba(99,102,241,0.06)' }}>
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-800/60 to-blue-900/60 flex items-center justify-center text-2xl">
                      😊
                    </div>
                    <span className="text-indigo-400 text-xs font-medium">You</span>
                    <span className="text-indigo-500/60 text-[10px]">camera on</span>
                  </div>
                </div>

                {/* Interviewer question */}
                <div className="px-4 py-3 border-t border-white/5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <p className="text-zinc-600 text-[10px] uppercase tracking-widest mb-1.5 font-semibold">
                    Sarah is asking
                  </p>
                  <p className="text-zinc-300 text-sm italic leading-snug">
                    &ldquo;{QUESTIONS[qi]}&rdquo;
                  </p>
                </div>
              </div>

              {/* ZoomGuru overlay — floating panel */}
              <div
                className="absolute -bottom-6 -right-4 w-[290px] rounded-2xl overflow-hidden shadow-2xl shadow-indigo-500/20 glow-blue"
                style={{ background: 'rgba(8,8,18,0.93)', border: '1px solid rgba(99,102,241,0.3)' }}
              >
                {/* Header */}
                <div className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-white/5">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-sm shadow-indigo-500/40">
                    <span className="text-white font-black text-[10px]">Z</span>
                  </div>
                  <span className="text-zinc-200 text-xs font-bold tracking-wide">ZoomGuru</span>
                  <div className="ml-auto flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full transition-colors duration-500 ${listening ? 'bg-emerald-400' : 'bg-zinc-700'}`} />
                    <span className={`text-[10px] transition-colors duration-500 ${listening ? 'text-emerald-400' : 'text-zinc-600'}`}>
                      {listening ? 'listening' : 'ready'}
                    </span>
                  </div>
                </div>

                {/* Answer area */}
                <div className="px-3.5 py-3 min-h-[110px]">
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-1 h-1 rounded-full bg-indigo-400" />
                    <p className="text-indigo-400/70 text-[9px] uppercase tracking-widest font-bold">
                      CV-personalized answer
                    </p>
                  </div>
                  <p className="text-zinc-200 text-[11px] leading-[1.65]">
                    {displayText}
                    {phase === 'typing' && (
                      <span className="inline-block w-px h-3 bg-indigo-400 ml-0.5 animate-blink align-middle" />
                    )}
                  </p>
                </div>

                {/* Footer bar */}
                <div className="px-3.5 py-2 border-t border-white/5 flex items-center justify-between"
                  style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <span className="text-zinc-700 text-[9px] font-mono">⌃⇧A  listen</span>
                  <span className="text-indigo-500 text-[9px] font-semibold">hidden from screen share</span>
                </div>
              </div>

              {/* "Invisible" badge */}
              <div className="absolute -top-4 -left-4 flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs px-3.5 py-2 rounded-full font-semibold shadow-lg shadow-emerald-500/10">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Invisible to Zoom
              </div>
            </div>
          </div>
        </div>

        {/* ── Stats strip ── */}
        <div className="mt-24 stagger-3">
          <div className="section-divider mb-10" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            {[
              { value: '<500ms', label: 'First AI word' },
              { value: '100%', label: 'Screen share invisible' },
              { value: '2 AI models', label: 'Auto-routed by question type' },
              { value: 'CV-locked', label: 'Personalized answers' },
            ].map((s, i) => (
              <div key={i} className="flex flex-col gap-1">
                <span className="text-2xl sm:text-3xl font-black gradient-text-blue tracking-tight">
                  {s.value}
                </span>
                <span className="text-zinc-600 text-xs sm:text-sm font-medium">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
