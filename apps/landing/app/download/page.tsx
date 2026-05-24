'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const MAC_URL = 'https://releases.zoomguru.xyz/ZoomGuru-1.0.0-arm64.dmg';
const WIN_URL = 'https://releases.zoomguru.xyz/ZoomGuru-Setup-1.0.0.exe';

function DownloadContent() {
  const searchParams = useSearchParams();
  const ref = searchParams.get('ref');
  const plan = searchParams.get('plan');
  const [os, setOs] = useState<'mac' | 'windows' | 'unknown'>('unknown');

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('mac')) setOs('mac');
    else if (ua.includes('win')) setOs('windows');
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4 py-20">
      <div className="max-w-xl w-full text-center">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-10">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
            Z
          </div>
          <span className="text-white font-semibold text-xl">ZoomGuru</span>
        </div>

        <h1 className="text-3xl font-bold text-white mb-3">
          Download ZoomGuru
        </h1>
        <p className="text-zinc-400 mb-2">
          Version 1.0.0 · Requires macOS 12+ or Windows 10+
        </p>

        {ref && (
          <div className="mt-4 mb-6 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-sm text-zinc-400">
            <span className="text-green-400 font-semibold">
              License activated!
            </span>{' '}
            {plan && (
              <span>
                Plan:{' '}
                <span className="text-white capitalize">
                  {plan === 'monthly' ? 'Monthly Pro' : 'Lifetime Pro'}
                </span>{' '}
                ·{' '}
              </span>
            )}
            Ref: <span className="text-zinc-300 font-mono text-xs">{ref}</span>
          </div>
        )}

        {/* Primary download based on OS */}
        <div className="mt-6 mb-4">
          {os === 'mac' && (
            <a
              href={MAC_URL}
              className="block w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-4 px-8 rounded-xl transition-colors text-lg mb-3"
            >
              ⬇ Download for macOS (Apple Silicon)
            </a>
          )}
          {os === 'windows' && (
            <a
              href={WIN_URL}
              className="block w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-4 px-8 rounded-xl transition-colors text-lg mb-3"
            >
              ⬇ Download for Windows (.exe)
            </a>
          )}
          {os === 'unknown' && (
            <p className="text-zinc-400 mb-4">
              Choose your platform below:
            </p>
          )}
        </div>

        {/* Both download links */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href={MAC_URL}
            className={`flex-1 border font-medium py-3 px-6 rounded-xl transition-colors text-center ${
              os === 'mac'
                ? 'border-zinc-600 text-zinc-300 hover:border-zinc-400 hover:text-white'
                : 'border-blue-600 text-blue-400 hover:bg-blue-600 hover:text-white'
            }`}
          >
            🍎 macOS .dmg
          </a>
          <a
            href={WIN_URL}
            className={`flex-1 border font-medium py-3 px-6 rounded-xl transition-colors text-center ${
              os === 'windows'
                ? 'border-zinc-600 text-zinc-300 hover:border-zinc-400 hover:text-white'
                : 'border-blue-600 text-blue-400 hover:bg-blue-600 hover:text-white'
            }`}
          >
            🪟 Windows .exe
          </a>
        </div>

        {/* Instructions */}
        <div className="mt-10 bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-left">
          <h2 className="text-white font-semibold mb-4">Getting started</h2>
          <ol className="space-y-3 text-zinc-400 text-sm">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">
                1
              </span>
              Download and install ZoomGuru for your platform.
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">
                2
              </span>
              Open ZoomGuru and log in with the email you used to purchase.
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">
                3
              </span>
              Upload your CV in Settings → ZoomGuru personalises answers to your background.
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">
                4
              </span>
              Start your interview. Press <kbd className="bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded text-xs font-mono">Ctrl+Shift+A</kbd> or say "Hey ZoomGuru".
            </li>
          </ol>
        </div>

        <p className="mt-6 text-zinc-500 text-sm">
          Need help?{' '}
          <a href="mailto:support@zoomguru.xyz" className="text-blue-400 hover:underline">
            support@zoomguru.xyz
          </a>
        </p>
      </div>
    </div>
  );
}

export default function DownloadPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400">Loading...</div>
      </div>
    }>
      <DownloadContent />
    </Suspense>
  );
}
