'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const MOCK_ANSWERS = [
  'Based on my experience at Acme Corp, I led a team of 5 engineers to migrate a monolithic Node.js app to microservices, reducing deployment time by 60%...',
  'I have 3+ years working with React and TypeScript. I built a real-time dashboard that processes 50k events/second using WebSockets and Redis...',
  'For system design, I would use a distributed architecture with load balancing across 3 availability zones, a CDN for static assets, and Postgres with read replicas...',
];

export default function Hero() {
  const [currentAnswer, setCurrentAnswer] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [charIndex, setCharIndex] = useState(0);
  const [isListening, setIsListening] = useState(false);

  const fullText = MOCK_ANSWERS[currentAnswer];

  useEffect(() => {
    if (charIndex < fullText.length) {
      const t = setTimeout(() => {
        setDisplayText(fullText.slice(0, charIndex + 1));
        setCharIndex((i) => i + 1);
      }, 18);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => {
        const next = (currentAnswer + 1) % MOCK_ANSWERS.length;
        setCurrentAnswer(next);
        setDisplayText('');
        setCharIndex(0);
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [charIndex, fullText, currentAnswer]);

  useEffect(() => {
    const t = setInterval(() => setIsListening((v) => !v), 1500);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-4 py-24 overflow-hidden bg-zinc-950">
      {/* Background gradient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-violet-600/8 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-6xl w-full mx-auto">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          {/* Left — copy */}
          <div className="flex-1 text-center lg:text-left">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-blue-600/10 border border-blue-600/30 text-blue-400 text-sm font-medium px-4 py-2 rounded-full mb-6">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              Invisible to screen share
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
              Invisible AI.{' '}
              <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
                Real answers.
              </span>{' '}
              Every interview.
            </h1>

            <p className="text-zinc-400 text-lg sm:text-xl leading-relaxed mb-8 max-w-xl mx-auto lg:mx-0">
              ZoomGuru sits on your screen — visible only to you. Listens to
              questions. Reads your screen. Answers in real time.{' '}
              <span className="text-zinc-300">Personalized to your CV.</span>{' '}
              Hidden from screen share.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <a
                href="#pricing"
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-4 px-8 rounded-xl transition-all duration-200 text-center hover:scale-[1.02] active:scale-[0.98]"
              >
                Start Free — 3 Sessions
              </a>
              <a
                href="#how-it-works"
                className="border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white font-semibold py-4 px-8 rounded-xl transition-all duration-200 text-center"
              >
                See How It Works
              </a>
            </div>

            {/* Trust note */}
            <p className="mt-6 text-zinc-600 text-sm">
              No credit card required · Works on Mac &amp; Windows · Device-locked license
            </p>
          </div>

          {/* Right — overlay mockup */}
          <div className="flex-1 flex items-center justify-center w-full max-w-md lg:max-w-none">
            {/* Simulated desktop with overlay */}
            <div className="relative w-full max-w-[480px]">
              {/* Background: Zoom window simulation */}
              <div className="rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900 shadow-2xl">
                {/* Fake Zoom titlebar */}
                <div className="bg-zinc-800 px-4 py-2.5 flex items-center gap-2 border-b border-zinc-700">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>
                  <span className="text-zinc-400 text-xs mx-auto font-medium">
                    Zoom Meeting — Technical Interview
                  </span>
                </div>

                {/* Fake video grid */}
                <div className="bg-zinc-950 p-4 grid grid-cols-2 gap-3 h-52">
                  {/* Interviewer */}
                  <div className="bg-zinc-800 rounded-xl flex flex-col items-center justify-center border border-zinc-700">
                    <div className="w-12 h-12 rounded-full bg-zinc-600 mb-2 flex items-center justify-center text-zinc-400 text-lg">
                      👤
                    </div>
                    <span className="text-zinc-400 text-xs">
                      Sarah (Interviewer)
                    </span>
                  </div>
                  {/* You */}
                  <div className="bg-blue-950/30 rounded-xl flex flex-col items-center justify-center border border-blue-900/30">
                    <div className="w-12 h-12 rounded-full bg-blue-800/50 mb-2 flex items-center justify-center text-blue-400 text-lg">
                      😊
                    </div>
                    <span className="text-blue-400 text-xs">You</span>
                  </div>
                </div>

                {/* Interviewer question */}
                <div className="bg-zinc-900 px-4 py-3 border-t border-zinc-800">
                  <p className="text-zinc-500 text-xs mb-1">
                    Sarah is speaking...
                  </p>
                  <p className="text-zinc-300 text-sm italic">
                    &quot;Tell me about a time you led a team through a complex technical migration.&quot;
                  </p>
                </div>
              </div>

              {/* ZoomGuru overlay — floating on top */}
              <div className="absolute bottom-0 right-0 translate-y-8 translate-x-2 w-72 rounded-2xl bg-zinc-900/95 border border-blue-500/40 shadow-2xl backdrop-blur-md overflow-hidden glow-blue">
                {/* Overlay header */}
                <div className="flex items-center gap-2 px-3 py-2.5 border-b border-zinc-800">
                  <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                    Z
                  </div>
                  <span className="text-zinc-300 text-xs font-semibold">
                    ZoomGuru
                  </span>
                  <div className="ml-auto flex items-center gap-1.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                        isListening ? 'bg-green-400' : 'bg-zinc-600'
                      }`}
                    />
                    <span className="text-zinc-500 text-xs">
                      {isListening ? 'Listening' : 'Idle'}
                    </span>
                  </div>
                </div>

                {/* Answer streaming */}
                <div className="px-3 py-3 min-h-[100px]">
                  <p className="text-zinc-400 text-[10px] uppercase tracking-wider mb-2 font-medium">
                    AI Answer — Personalized to your CV
                  </p>
                  <p className="text-white text-xs leading-relaxed">
                    {displayText}
                    <span className="inline-block w-0.5 h-3 bg-blue-400 ml-0.5 animate-pulse align-middle" />
                  </p>
                </div>

                {/* Footer */}
                <div className="px-3 py-2 border-t border-zinc-800 flex items-center justify-between">
                  <span className="text-zinc-600 text-[10px]">
                    ⌨ Ctrl+Shift+A
                  </span>
                  <span className="text-blue-500 text-[10px] font-medium">
                    Hidden from screen share
                  </span>
                </div>
              </div>

              {/* Invisible badge */}
              <div className="absolute -top-3 -left-3 bg-green-500/10 border border-green-500/30 text-green-400 text-xs px-3 py-1.5 rounded-full font-medium">
                ✓ Invisible to Zoom
              </div>
            </div>
          </div>
        </div>

        {/* Social proof strip */}
        <div className="mt-20 pt-10 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-center gap-8 text-zinc-500 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-white">500ms</span>
            <span>first AI word</span>
          </div>
          <div className="hidden sm:block w-px h-8 bg-zinc-800" />
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-white">100%</span>
            <span>invisible to screen share</span>
          </div>
          <div className="hidden sm:block w-px h-8 bg-zinc-800" />
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-white">CV-first</span>
            <span>personalized answers</span>
          </div>
        </div>
      </div>
    </section>
  );
}
