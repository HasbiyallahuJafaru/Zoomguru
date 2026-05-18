import Link from 'next/link';

const navLinks = [
  { label: 'How it works', href: '/how-it-works' },
  { label: 'Features', href: '/features' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'FAQ', href: '/faq' },
];

const legalLinks = [
  { label: 'Download', href: '/download' },
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
];

export default function Footer() {
  return (
    <footer
      className="relative"
      style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-12 mb-14">

          <div className="col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
              >
                <span className="text-white font-black text-base">Z</span>
              </div>
              <span className="text-white font-bold text-xl tracking-tight">
                Zoom<span className="text-white/65">Guru</span>
              </span>
            </div>
            <p className="text-white/60 text-sm leading-relaxed font-light max-w-xs">
              Your invisible edge in every interview. AI that listens, reads your screen, and answers. Hidden from screen share.
            </p>
            <p className="mt-4 text-xs text-white/50">
              <a href="mailto:support@zoomguru.com" className="hover:text-white/60 transition-colors">
                support@zoomguru.com
              </a>
            </p>
          </div>

          <div>
            <p className="text-white/55 text-xs font-bold uppercase tracking-[0.15em] mb-5">Product</p>
            <ul className="space-y-3">
              {navLinks.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-white/65 hover:text-white text-sm transition-colors font-light">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-white/55 text-xs font-bold uppercase tracking-[0.15em] mb-5">Company</p>
            <ul className="space-y-3">
              {legalLinks.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-white/65 hover:text-white text-sm transition-colors font-light">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div
          className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/50"
          style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
        >
          <p>© 2025 ZoomGuru. All rights reserved.</p>
          <div className="flex items-center gap-5">
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-pulse" />
              All systems operational
            </span>
            <span className="text-white/15">|</span>
            <span>Mac and Windows</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
