const features = [
  {
    icon: '📄',
    title: 'Personalized to your CV',
    description:
      'Upload your resume once. ZoomGuru injects your real experience, projects, and skills into every AI prompt — answers sound like you, not a template.',
    accent: 'blue',
  },
  {
    icon: '👁️',
    title: 'Invisible to screen share',
    description:
      'OS-level window exclusion means Zoom, Google Meet, Teams, and Webex cannot capture the overlay. Your interviewer sees only your face.',
    accent: 'violet',
  },
  {
    icon: '⚡',
    title: 'Streams in real time',
    description:
      'First word appears in under 500ms. Answers stream word by word — you can read and speak naturally without waiting for a complete response.',
    accent: 'blue',
  },
  {
    icon: '📸',
    title: 'Screenshot understanding',
    description:
      'Press a hotkey to capture your screen. ZoomGuru reads the image with vision AI — perfect for whiteboard problems, diagrams, and coding challenges.',
    accent: 'violet',
  },
  {
    icon: '🎙️',
    title: 'Listens to audio',
    description:
      'Local Whisper model transcribes speech in real time. No audio ever leaves your device until you trigger a response — privacy first.',
    accent: 'blue',
  },
  {
    icon: '🧠',
    title: 'Deep reasoning mode',
    description:
      'Coding, system design, and math problems automatically route to DeepSeek R1 — a full chain-of-thought reasoner that shows its work.',
    accent: 'violet',
  },
  {
    icon: '🗂️',
    title: 'Session memory',
    description:
      'ZoomGuru remembers everything said in the current interview session. Follow-up questions get context-aware answers that build on earlier discussion.',
    accent: 'blue',
  },
  {
    icon: '🖥️',
    title: 'Works on Mac + Windows',
    description:
      'Native builds for macOS (Apple Silicon + Intel) and Windows 10/11. One license, one machine — device-locked for security.',
    accent: 'violet',
  },
];

const accentClasses = {
  blue: {
    icon: 'bg-blue-600/10 border-blue-600/20 text-blue-400',
    hover: 'group-hover:border-blue-600/40',
  },
  violet: {
    icon: 'bg-violet-600/10 border-violet-600/20 text-violet-400',
    hover: 'group-hover:border-violet-600/40',
  },
};

export default function Features() {
  return (
    <section
      id="features"
      className="py-24 px-4 bg-zinc-900/50 relative overflow-hidden"
    >
      {/* Background accent */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-blue-400 text-sm font-semibold uppercase tracking-widest mb-3">
            Features
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Everything you need. Nothing you don&apos;t.
          </h2>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
            Built for real interviews — not demos. Every feature ships and
            works on day one.
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((feature, i) => {
            const accent = accentClasses[feature.accent as keyof typeof accentClasses];
            return (
              <div
                key={i}
                className={`group bg-zinc-900 border border-zinc-800 ${accent.hover} rounded-2xl p-6 transition-all duration-300 hover:bg-zinc-800/50`}
              >
                {/* Icon */}
                <div
                  className={`w-12 h-12 rounded-xl border flex items-center justify-center text-2xl mb-4 ${accent.icon}`}
                >
                  {feature.icon}
                </div>

                <h3 className="text-white font-semibold text-base mb-2">
                  {feature.title}
                </h3>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Feature highlight strip */}
        <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { stat: '<500ms', label: 'First AI word' },
            { stat: '100%', label: 'Screen share safe' },
            { stat: '2 AI models', label: 'Auto-routed by question type' },
            { stat: 'CV-locked', label: 'Personalized answers' },
          ].map((item, i) => (
            <div
              key={i}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center"
            >
              <div className="text-xl font-bold text-blue-400 mb-1">
                {item.stat}
              </div>
              <div className="text-zinc-500 text-xs">{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
