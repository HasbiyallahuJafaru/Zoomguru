import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-[#fafaf8]">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 gap-10 mb-12 sm:grid-cols-2 lg:grid-cols-4">

          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-[#111] flex items-center justify-center">
                <span className="text-white font-black text-sm">Z</span>
              </div>
              <span className="font-bold text-base text-[#111] tracking-tight">ZoomGuru</span>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed max-w-xs">
              Your invisible edge in every interview. AI that listens, reads your screen, and answers in real time.
            </p>
            <a
              href="mailto:support@zoomguru.xyz"
              className="inline-block mt-4 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              support@zoomguru.xyz
            </a>
          </div>

          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-5">Product</p>
            {[
              { label: 'How it works', href: '/how-it-works' },
              { label: 'Features', href: '/features' },
              { label: 'Pricing', href: '/pricing' },
              { label: 'Download', href: '/download' },
            ].map(l => (
              <Link key={l.label} href={l.href} className="block mb-3 text-sm text-gray-600 hover:text-gray-900 transition-colors">
                {l.label}
              </Link>
            ))}
          </div>

          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-5">Account</p>
            {[
              { label: 'Sign in', href: '/login' },
              { label: 'Dashboard', href: '/dashboard' },
              { label: 'FAQ', href: '/faq' },
            ].map(l => (
              <Link key={l.label} href={l.href} className="block mb-3 text-sm text-gray-600 hover:text-gray-900 transition-colors">
                {l.label}
              </Link>
            ))}
          </div>

          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-5">Legal</p>
            {[
              { label: 'Privacy Policy', href: '/privacy' },
              { label: 'Terms', href: '/terms' },
              { label: 'Refund Policy', href: '/refund-policy' },
            ].map(l => (
              <Link key={l.label} href={l.href} className="block mb-3 text-sm text-gray-600 hover:text-gray-900 transition-colors">
                {l.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-gray-400">© 2025 ZoomGuru. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
              All systems operational
            </span>
            <span className="text-xs text-gray-300">Mac &amp; Windows</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
