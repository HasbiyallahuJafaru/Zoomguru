import Link from 'next/link';

const navLinks = [
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'Features', href: '/#features' },
  { label: 'Pricing', href: '/#pricing' },
  { label: 'FAQ', href: '/#faq' },
];

const legalLinks = [
  { label: 'Download', href: '/download' },
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
];

export default function Footer() {
  return (
    <footer className="relative" style={{ background: '#06060f', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      {/* Top gradient line */}
      <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.4), rgba(139,92,246,0.3), transparent)' }} />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-12 mb-14">

          {/* Brand */}
          <div className="col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                <span className="text-white font-black text-base">Z</span>
              </div>
              <span className="text-white font-bold text-xl tracking-tight">
                Zoom<span className="text-indigo-400">Guru</span>
              </span>
            </div>
            <p className="text-zinc-600 text-sm leading-relaxed font-light max-w-xs">
              Your invisible edge in every interview. AI that listens, reads your screen, and answers — hidden from screen share.
            </p>
            <p className="mt-4 text-xs text-zinc-700">
              <a href="mailto:support@zoomguru.com" className="hover:text-zinc-500 transition-colors">
                support@zoomguru.com
              </a>
            </p>
          </div>

          {/* Product links */}
          <div>
            <p className="text-zinc-400 text-xs font-bold uppercase tracking-[0.15em] mb-5">Product</p>
            <ul className="space-y-3">
              {navLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-zinc-500 hover:text-zinc-200 text-sm transition-colors font-light"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal + download */}
          <div>
            <p className="text-zinc-400 text-xs font-bold uppercase tracking-[0.15em] mb-5">Company</p>
            <ul className="space-y-3">
              {legalLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-zinc-500 hover:text-zinc-200 text-sm transition-colors font-light"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-700"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          <p>© 2025 ZoomGuru. All rights reserved.</p>
          <div className="flex items-center gap-5">
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              All systems operational
            </span>
            <span className="text-zinc-800">·</span>
            <span>Mac + Windows</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
