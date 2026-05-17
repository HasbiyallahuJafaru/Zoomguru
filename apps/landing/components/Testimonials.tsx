const testimonials = [
  {
    quote: 'I landed a Staff Engineer role at a top fintech. The system design question was brutal — ZoomGuru walked me through the architecture live. They had no idea.',
    name: 'Adewale O.',
    role: 'Staff Engineer · Lagos',
    avatar: 'AO',
    color: 'from-indigo-500 to-blue-600',
  },
  {
    quote: 'Got the Google offer after bombing 3 previous attempts. Used ZoomGuru for the behavioral rounds — STAR answers personalized to my actual CV. Night and day difference.',
    name: 'Priya M.',
    role: 'Senior SWE · Bangalore',
    avatar: 'PM',
    color: 'from-violet-500 to-indigo-600',
  },
  {
    quote: 'The LeetCode problem appeared on screen. I hit Ctrl+Shift+S. ZoomGuru identified it, explained the approach, and gave me working code in 8 seconds. Insane.',
    name: 'James K.',
    role: 'Frontend Engineer · London',
    avatar: 'JK',
    color: 'from-blue-500 to-cyan-600',
  },
  {
    quote: 'Three offers in 2 weeks. I was using ZoomGuru for every single interview. The invisibility feature works — tested it myself by screen-sharing to a friend.',
    name: 'Chidi A.',
    role: 'Full-stack Dev · Abuja',
    avatar: 'CA',
    color: 'from-emerald-500 to-teal-600',
  },
];

export default function Testimonials() {
  return (
    <section className="py-28 px-4 relative overflow-hidden" style={{ background: '#06060f' }}>
      {/* Ambient */}
      <div className="absolute bottom-0 right-0 w-[500px] h-[300px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(99,102,241,0.06) 0%, transparent 70%)' }} />

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-indigo-400 text-xs font-bold uppercase tracking-[0.2em] mb-4">
            Success stories
          </p>
          <h2 className="text-4xl sm:text-5xl font-black text-white mb-5 tracking-tight">
            Real interviews.{' '}
            <span className="gradient-text">Real offers.</span>
          </h2>
          <p className="text-zinc-500 text-lg font-light">
            From users who used ZoomGuru and landed the job.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {testimonials.map((t, i) => (
            <div
              key={i}
              className="rounded-2xl p-6 flex flex-col gap-4 transition-all duration-300 hover:translate-y-[-2px]"
              style={{
                background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              {/* Stars */}
              <div className="flex gap-1">
                {[...Array(5)].map((_, si) => (
                  <svg key={si} className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>

              <p className="text-zinc-300 text-sm leading-relaxed flex-1 font-light">
                &ldquo;{t.quote}&rdquo;
              </p>

              {/* Author */}
              <div className="flex items-center gap-3 pt-3 border-t border-white/5">
                <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${t.color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                  {t.avatar}
                </div>
                <div>
                  <p className="text-white text-xs font-semibold">{t.name}</p>
                  <p className="text-zinc-600 text-[10px]">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
