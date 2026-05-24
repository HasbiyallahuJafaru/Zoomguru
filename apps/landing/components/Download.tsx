'use client';

import { useEffect, useState } from 'react';

const MAC_URL = 'https://releases.zoomguru.xyz/ZoomGuru-1.0.0-arm64.dmg';
const WIN_URL = 'https://releases.zoomguru.xyz/ZoomGuru-Setup-1.0.0.exe';
const VERSION = '1.0.0';

export default function Download() {
  const [os, setOs] = useState<'mac' | 'windows' | 'unknown'>('unknown');

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('mac')) setOs('mac');
    else if (ua.includes('win')) setOs('windows');
  }, []);

  return (
    <section id="download" style={{ padding: '96px 24px', borderTop: '1px solid #e5e5e5', background: '#111', position: 'relative', overflow: 'hidden' }}>
      {/* Subtle texture */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 30% 50%, rgba(255,255,255,0.03) 0%, transparent 60%), radial-gradient(circle at 70% 50%, rgba(255,255,255,0.02) 0%, transparent 60%)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>

        <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 16 }}>Download</p>
        <h2 style={{ fontSize: 'clamp(32px,5vw,56px)', fontWeight: 900, color: '#fff', letterSpacing: '-2px', lineHeight: 1.05, marginBottom: 16 }}>
          Start your next<br />
          <span style={{ fontStyle: 'italic', fontWeight: 300 }}>interview ready.</span>
        </h2>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', marginBottom: 40, lineHeight: 1.6 }}>
          Free plan included. No credit card. Mac and Windows.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 32 }}>
          {/* Primary CTA — detected OS or both */}
          {(os === 'mac' || os === 'unknown') && (
            <a href={MAC_URL} style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              background: '#fff', color: '#111', fontWeight: 700, fontSize: 15,
              padding: '14px 28px', borderRadius: 14, textDecoration: 'none',
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#eee')}
            onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
              Download for Mac
            </a>
          )}
          {(os === 'windows' || os === 'unknown') && (
            <a href={WIN_URL} style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              background: os === 'windows' ? '#fff' : 'rgba(255,255,255,0.1)',
              color: os === 'windows' ? '#111' : '#fff',
              fontWeight: 700, fontSize: 15,
              padding: '14px 28px', borderRadius: 14, textDecoration: 'none',
              border: os === 'windows' ? 'none' : '1.5px solid rgba(255,255,255,0.2)',
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = os === 'windows' ? '#eee' : 'rgba(255,255,255,0.15)')}
            onMouseLeave={e => (e.currentTarget.style.background = os === 'windows' ? '#fff' : 'rgba(255,255,255,0.1)')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 12V6.75l6-1.32v6.57H3zm17 0V4.5L11 3v9H20zM3 18l6 .82v-6.07H3V18zm17 1L11 21v-8.5h9V19z"/></svg>
              Download for Windows
            </a>
          )}
        </div>

        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>v{VERSION} · macOS 12+ · Windows 10/11</p>
      </div>
    </section>
  );
}
