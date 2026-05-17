const steps = [
  {
    number: '01',
    icon: '📄',
    title: 'Upload your CV',
    description:
      'ZoomGuru reads your CV and learns your experience, skills, projects, and achievements. Every AI answer is personalized to your actual background — not generic.',
    detail: 'Supports PDF · DOCX · Plain text',
  },
  {
    number: '02',
    icon: '💻',
    title: 'Start your interview',
    description:
      'Open Zoom, Google Meet, Teams, or any video call. ZoomGuru floats as a transparent overlay on your screen — only you can see it. The interviewer sees nothing.',
    detail: 'Works with Zoom · Meet · Teams · Webex',
  },
  {
    number: '03',
    icon: '🎙️',
    title: 'Press a hotkey or say "Hey ZoomGuru"',
    description:
      'When a question lands, tap Ctrl+Shift+A or use the wake word. ZoomGuru listens to the audio, captures context, and streams a personalized answer in under a second.',
    detail: '&lt;500ms first word · Streams word by word',
  },
  {
    number: '04',
    icon: '✨',
    title: 'You deliver the answer',
    description:
      'Read along naturally as ZoomGuru streams the answer. Speak confidently. Naturally. The interviewer sees only you — calm, knowledgeable, prepared.',
    detail: 'Coding · System design · Behavioral · All question types',
  },
];

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="py-24 px-4 bg-zinc-950 relative overflow-hidden"
    >
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <div className="max-w-5xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-blue-400 text-sm font-semibold uppercase tracking-widest mb-3">
            How It Works
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Four steps to your unfair advantage
          </h2>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
            Setup takes under 2 minutes. You&apos;ll be ready before your next
            interview.
          </p>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Connector line — desktop */}
          <div className="hidden lg:block absolute top-12 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-blue-600/30 to-transparent" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <div key={i} className="relative group">
                <div className="bg-zinc-900 border border-zinc-800 group-hover:border-blue-600/40 rounded-2xl p-6 transition-all duration-300 h-full flex flex-col">
                  {/* Number badge */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-600/30 flex items-center justify-center text-blue-400 font-bold text-sm font-mono">
                      {step.number}
                    </div>
                    <span className="text-2xl">{step.icon}</span>
                  </div>

                  <h3 className="text-white font-semibold text-lg mb-3">
                    {step.title}
                  </h3>
                  <p
                    className="text-zinc-400 text-sm leading-relaxed flex-1"
                    dangerouslySetInnerHTML={{ __html: step.description }}
                  />

                  {/* Detail tag */}
                  <div className="mt-4 pt-4 border-t border-zinc-800">
                    <p
                      className="text-blue-500 text-xs font-medium"
                      dangerouslySetInnerHTML={{ __html: step.detail }}
                    />
                  </div>
                </div>

                {/* Arrow between steps — desktop */}
                {i < steps.length - 1 && (
                  <div className="hidden lg:flex absolute -right-3 top-12 z-10 w-6 h-6 items-center justify-center">
                    <svg
                      className="w-4 h-4 text-blue-600/60"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-14 text-center">
          <a
            href="#pricing"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-4 px-8 rounded-xl transition-all duration-200 hover:scale-[1.02]"
          >
            Get started free
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 8l4 4m0 0l-4 4m4-4H3"
              />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
