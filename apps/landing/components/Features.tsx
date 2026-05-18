'use client';

import ElectricBorder from './ElectricBorder';

const features = [
  {
    title: 'Personalized to your CV',
    description: 'Upload once. Every answer pulls from your real experience, projects, roles, and metrics. Sounds like you, not a generic template.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
    rotate: '-rotate-1',
    size: 'lg:col-span-2',
  },
  {
    title: 'Invisible to all screen share',
    description: 'OS-level window exclusion. Zoom, Meet, Teams, and browser tab share cannot capture the overlay.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
      </svg>
    ),
    rotate: 'rotate-1',
    size: '',
  },
  {
    title: 'Streams in under 500ms',
    description: 'First word in under 500ms. Answers stream word by word so you can start reading almost immediately.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
    rotate: '-rotate-1',
    size: '',
  },
  {
    title: 'Screenshot and vision AI',
    description: 'Capture your screen with a hotkey. Qwen VL reads whiteboard problems, LeetCode windows, and diagrams.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
      </svg>
    ),
    rotate: 'rotate-1',
    size: '',
  },
  {
    title: 'Local speech transcription',
    description: 'Whisper tiny model runs entirely on device. Audio never leaves your machine. Wake word detection runs locally too.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
      </svg>
    ),
    rotate: '-rotate-1',
    size: '',
  },
  {
    title: 'Deep reasoning for hard questions',
    description: 'Coding, system design, and math auto-route to DeepSeek R1. Behavioral questions use the faster V3 model.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zm.75-12h9v9h-9v-9z" />
      </svg>
    ),
    rotate: 'rotate-1',
    size: 'lg:col-span-2',
  },
  {
    title: 'Full session memory',
    description: 'ZoomGuru tracks the full conversation. Follow-up questions get answers that build on everything said earlier.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
      </svg>
    ),
    rotate: '-rotate-1',
    size: '',
  },
  {
    title: 'Mac and Windows native builds',
    description: 'Packaged as a native .dmg for macOS and .exe for Windows 10/11. One device-locked license per machine.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
      </svg>
    ),
    rotate: 'rotate-1',
    size: '',
  },
];

export default function Features() {
  return (
    <section id="features" className="py-28 px-4 relative overflow-hidden">
      <div className="max-w-6xl mx-auto relative z-10">

        <div className="text-center mb-16">
          <p className="text-white/65 text-xs font-bold uppercase tracking-[0.2em] mb-4">Features</p>
          <h2 className="text-4xl sm:text-5xl font-black text-white mb-5 tracking-tight">
            Everything you need.{' '}
            <span className="text-white/60">Nothing you don&apos;t.</span>
          </h2>
          <p className="text-white/65 text-lg max-w-2xl mx-auto font-light">
            Every feature was built for real interviews, not demos.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 auto-rows-auto">
          {features.map((f, i) => (
            <div key={i} className={`${f.size} ${f.rotate} transition-transform hover:rotate-0 duration-300`}>
              <ElectricBorder
                color="rgba(255,255,255,0.7)"
                speed={0.5 + i * 0.07}
                chaos={0.09}
                borderRadius={20}
                style={{ height: '100%' }}
              >
                <div
                  className="rounded-[18px] p-6 h-full flex flex-col gap-3"
                  style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)', minHeight: 160 }}
                >
                  <div className="text-white/70">{f.icon}</div>
                  <h3 className="text-white font-bold text-base leading-snug">{f.title}</h3>
                  <p className="text-white/60 text-sm leading-relaxed font-light flex-1">{f.description}</p>
                </div>
              </ElectricBorder>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
