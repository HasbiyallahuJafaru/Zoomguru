import Link from 'next/link';

export default function Footer() {
  return (
    <footer style={{ borderTop: '1.5px solid #e5e5e5', background: '#fafaf8' }}>
      <div style={{ maxWidth: 1152, margin: '0 auto', padding: '64px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 48, marginBottom: 48 }}>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: '#fff', fontWeight: 900, fontSize: 14 }}>Z</span>
              </div>
              <span style={{ fontWeight: 700, fontSize: 16, color: '#111', letterSpacing: '-0.3px' }}>ZoomGuru</span>
            </div>
            <p style={{ fontSize: 14, color: '#666', lineHeight: 1.6, maxWidth: 260 }}>
              Your invisible edge in every interview. AI that listens, reads your screen, and answers in real time.
            </p>
            <a href="mailto:support@zoomguru.com" style={{ display: 'inline-block', marginTop: 16, fontSize: 13, color: '#888', textDecoration: 'none' }}>
              support@zoomguru.com
            </a>
          </div>

          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 20 }}>Product</p>
            {[
              { label: 'How it works', href: '/how-it-works' },
              { label: 'Features', href: '/features' },
              { label: 'Pricing', href: '/pricing' },
              { label: 'Download', href: '/download' },
            ].map(l => (
              <Link key={l.label} href={l.href} style={{ display: 'block', marginBottom: 12, fontSize: 14, color: '#555', textDecoration: 'none' }}>{l.label}</Link>
            ))}
          </div>

          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 20 }}>Account</p>
            {[
              { label: 'Sign in', href: '/login' },
              { label: 'Dashboard', href: '/dashboard' },
              { label: 'FAQ', href: '/faq' },
            ].map(l => (
              <Link key={l.label} href={l.href} style={{ display: 'block', marginBottom: 12, fontSize: 14, color: '#555', textDecoration: 'none' }}>{l.label}</Link>
            ))}
          </div>

          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 20 }}>Legal</p>
            {[
              { label: 'Privacy Policy', href: '/privacy' },
              { label: 'Terms', href: '/terms' },
              { label: 'Refund Policy', href: '/refund-policy' },
            ].map(l => (
              <Link key={l.label} href={l.href} style={{ display: 'block', marginBottom: 12, fontSize: 14, color: '#555', textDecoration: 'none' }}>{l.label}</Link>
            ))}
          </div>
        </div>

        <div style={{ borderTop: '1px solid #e5e5e5', paddingTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <p style={{ fontSize: 13, color: '#999' }}>© 2025 ZoomGuru. All rights reserved.</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#999' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
              All systems operational
            </span>
            <span style={{ fontSize: 13, color: '#bbb' }}>Mac &amp; Windows</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
