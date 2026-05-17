'use client';

import { useEffect, useState } from 'react';

const MAC_URL = 'https://releases.zoomguru.com/ZoomGuru-1.0.0-arm64.dmg';
const WIN_URL = 'https://releases.zoomguru.com/ZoomGuru-Setup-1.0.0.exe';
const VERSION = '1.0.0';

export default function Download() {
  const [os, setOs] = useState<'mac' | 'windows' | 'unknown'>('unknown');

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('mac')) setOs('mac');
    else if (ua.includes('win')) setOs('windows');
  }, []);

  return (
    <section
      id="download"
      className="py-24 px-4 bg-zinc-900/50 relative overflow-hidden"
    >
      {/* Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue-600/8 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-3xl mx-auto relative z-10 text-center">
        {/* Header */}
        <p className="text-blue-400 text-sm font-semibold uppercase tracking-widest mb-3">
          Download
        </p>
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
          Ready when you are
        </h2>
        <p className="text-zinc-400 text-lg mb-2">
          Version {VERSION} · Requires macOS 12+ or Windows 10+
        </p>
        <p className="text-zinc-600 text-sm mb-10">
          Free plan included · No account required to download
        </p>

        {/* OS-detected primary CTA */}
        <div className="mb-6">
          {os === 'mac' && (
            <div className="mb-2">
              <div className="inline-flex items-center gap-2 text-green-400 text-xs font-medium bg-green-400/10 border border-green-400/20 px-3 py-1.5 rounded-full mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Detected: macOS
              </div>
              <div>
                <a
                  href={MAC_URL}
                  className="inline-flex items-center gap-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-4 px-10 rounded-2xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] text-lg"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                  </svg>
                  Download for macOS
                </a>
              </div>
            </div>
          )}

          {os === 'windows' && (
            <div className="mb-2">
              <div className="inline-flex items-center gap-2 text-green-400 text-xs font-medium bg-green-400/10 border border-green-400/20 px-3 py-1.5 rounded-full mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Detected: Windows
              </div>
              <div>
                <a
                  href={WIN_URL}
                  className="inline-flex items-center gap-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-4 px-10 rounded-2xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] text-lg"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
                  </svg>
                  Download for Windows
                </a>
              </div>
            </div>
          )}

          {os === 'unknown' && (
            <p className="text-zinc-400 mb-4">Choose your platform:</p>
          )}
        </div>

        {/* Both platform links */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
          <a
            href={MAC_URL}
            className={`flex-1 flex items-center justify-center gap-2 border font-medium py-3 px-6 rounded-xl transition-all duration-200 text-sm ${
              os === 'mac'
                ? 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-300'
                : 'border-blue-600/50 text-blue-400 hover:border-blue-500 hover:bg-blue-600/10'
            }`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            macOS .dmg
            {os === 'mac' && <span className="text-zinc-600 text-xs">(current)</span>}
          </a>
          <a
            href={WIN_URL}
            className={`flex-1 flex items-center justify-center gap-2 border font-medium py-3 px-6 rounded-xl transition-all duration-200 text-sm ${
              os === 'windows'
                ? 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-300'
                : 'border-blue-600/50 text-blue-400 hover:border-blue-500 hover:bg-blue-600/10'
            }`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
            </svg>
            Windows .exe
            {os === 'windows' && <span className="text-zinc-600 text-xs">(current)</span>}
          </a>
        </div>

        {/* System info */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-zinc-600 text-xs">
          <span>macOS 12+ (Apple Silicon &amp; Intel)</span>
          <span className="hidden sm:inline">·</span>
          <span>Windows 10 / 11 (64-bit)</span>
          <span className="hidden sm:inline">·</span>
          <span>~80 MB download</span>
          <span className="hidden sm:inline">·</span>
          <span>Version {VERSION}</span>
        </div>

        {/* Mini FAQ */}
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
          {[
            {
              q: 'Is it safe?',
              a: 'Code-signed binaries on both platforms. Certificate pinning in production.',
            },
            {
              q: 'Do I need a license to run it?',
              a: 'Free plan runs without a license. Pro license unlocks everything instantly.',
            },
            {
              q: 'What if my OS isn\'t supported?',
              a: 'Email us at support@zoomguru.com and we\'ll let you know the roadmap.',
            },
          ].map((item, i) => (
            <div
              key={i}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"
            >
              <p className="text-white font-medium text-sm mb-1">{item.q}</p>
              <p className="text-zinc-400 text-xs leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
