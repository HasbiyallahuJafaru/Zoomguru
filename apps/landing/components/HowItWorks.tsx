const steps = [
  {
    number: '01',
    title: 'Upload your CV',
    description:
      'ZoomGuru reads your resume and builds a personalized profile — your experience, projects, tech stack, and achievements. Every answer sounds like you, not a template.',
    detail: 'Supports PDF · DOCX · Plain text',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
      </svg>
    ),
  },
  {
    number: '02',
    title: 'Open your video call',
    description:
      'Launch Zoom, Google Meet, Teams, or Webex. ZoomGuru floats as a transparent overlay — only you can see it. Your interviewer sees absolutely nothing unusual.',
    detail: 'Zoom · Meet · Teams · Webex · Any app',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
  },
  {
    number: '03',
    title: 'Trigger on any question',
    description:
      'Press Ctrl+Shift+A to listen, Ctrl+Shift+S to capture your screen, or say "Hey ZoomGuru". The AI understands the question and streams a personalized answer in under a second.',
    detail: '<500ms first word · Streams word by word',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
      </svg>
    ),
  },
  {
    number: '04',
    title: 'Deliver the answer',
    description:
      'Read naturally as the answer streams onto your overlay. Speak with confidence. The interviewer sees only you — calm, articulate, and thoroughly prepared.',
    detail: 'Behavioral · Technical · Coding · System Design',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-28 px-4 relative overflow-hidden" style={{ background: '#06060f' }}>

      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.018] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
        }}
      />

      <div className="max-w-5xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-20">
          <p className="text-indigo-400 text-xs font-bold uppercase tracking-[0.2em] mb-4">
            How it works
          </p>
          <h2 className="text-4xl sm:text-5xl font-black text-white mb-5 tracking-tight">
            Up and running in{' '}
            <span className="gradient-text">under 2 minutes</span>
          </h2>
          <p className="text-zinc-500 text-lg max-w-xl mx-auto font-light">
            No complex setup. No configuration. Just install, upload your CV, and start your next interview.
          </p>
        </div>

        {/* Steps */}
        <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Connecting line — desktop */}
          <div className="hidden lg:block absolute top-[2.75rem] left-[12.5%] right-[12.5%] h-px pointer-events-none"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.25) 20%, rgba(99,102,241,0.25) 80%, transparent)' }} />

          {steps.map((step, i) => (
            <div key={i} className="relative group">
              <div
                className="h-full rounded-2xl p-6 border transition-all duration-300 hover:border-indigo-500/30"
                style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                {/* Step number + icon */}
                <div className="flex items-center gap-3 mb-5">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-indigo-400 flex-shrink-0 transition-all duration-300 group-hover:bg-indigo-500/20"
                    style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}
                  >
                    {step.icon}
                  </div>
                  <span className="text-indigo-500/40 text-xl font-black font-mono tracking-tight">
                    {step.number}
                  </span>
                </div>

                <h3 className="text-white font-bold text-base mb-2.5 tracking-tight">
                  {step.title}
                </h3>
                <p className="text-zinc-500 text-sm leading-relaxed mb-5 font-light">
                  {step.description}
                </p>

                <div className="pt-4 border-t border-white/5">
                  <p className="text-indigo-500/70 text-[11px] font-semibold tracking-wide">
                    {step.detail}
                  </p>
                </div>
              </div>

              {/* Arrow */}
              {i < steps.length - 1 && (
                <div className="hidden lg:flex absolute -right-3.5 top-11 z-10 w-7 h-7 items-center justify-center">
                  <svg className="w-3 h-3 text-indigo-600/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <a
            href="#pricing"
            className="inline-flex items-center gap-2.5 btn-shimmer text-white font-bold py-4 px-9 rounded-2xl shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all duration-300 hover:scale-[1.03]"
          >
            Get started free
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
