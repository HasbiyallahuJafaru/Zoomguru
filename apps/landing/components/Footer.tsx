import Link from 'next/link';

const links = [
  { label: 'Pricing', href: '/#pricing' },
  { label: 'Download', href: '/download' },
  { label: 'How It Works', href: '/#how-it-works' },
  { label: 'Features', href: '/#features' },
  { label: 'FAQ', href: '/#faq' },
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
];

export default function Footer() {
  return (
    <footer className="bg-zinc-950 border-t border-zinc-900 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Top row */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-8 mb-10">
          {/* Brand */}
          <div className="text-center sm:text-left">
            <div className="flex items-center gap-2 justify-center sm:justify-start mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-base">
                Z
              </div>
              <span className="text-white font-bold text-lg tracking-tight">
                ZoomGuru
              </span>
            </div>
            <p className="text-zinc-500 text-sm max-w-xs">
              Your invisible edge in every interview. AI that listens, thinks,
              and answers — hidden from screen share.
            </p>
          </div>

          {/* Links */}
          <nav className="flex flex-wrap gap-x-6 gap-y-2 justify-center sm:justify-end">
            {links.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Divider */}
        <div className="border-t border-zinc-900 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-zinc-600 text-xs">
          <p>© 2025 ZoomGuru. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              All systems operational
            </span>
            <a
              href="mailto:support@zoomguru.com"
              className="hover:text-zinc-400 transition-colors"
            >
              support@zoomguru.com
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
