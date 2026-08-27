import { ImageResponse } from 'next/og';
import { SITE } from '@/lib/site';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = `${SITE.name} — ${SITE.tagline}`;

/**
 * Generated at build time, which finally replaces the old workflow of opening
 * social-card.html in a browser and screenshotting it by hand. That never
 * produced the social-card.png the meta tags pointed at.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#f5f3ee',
          padding: '72px 80px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 10, height: 10, borderRadius: 9999, background: '#ff4a1c' }} />
          <div
            style={{
              fontSize: 20,
              letterSpacing: 4,
              textTransform: 'uppercase',
              color: '#78715f',
            }}
          >
            AI interview copilot · Windows
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: 86,
              lineHeight: 1.04,
              letterSpacing: -3,
              color: '#0e0e0c',
              maxWidth: 900,
            }}
          >
            Answers, while they are still asking.
          </div>
          <div style={{ fontSize: 30, color: '#78715f', marginTop: 28, maxWidth: 820 }}>
            Hidden from screen share. Zoom, Meet and Teams.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Satori needs an explicit display on any node with more than one child. */}
          <div style={{ display: 'flex', fontSize: 30, color: '#0e0e0c' }}>
            <span>Zoom</span>
            <span style={{ color: '#1b2ed6' }}>Guru</span>
          </div>
          <div style={{ fontSize: 24, color: '#78715f' }}>{SITE.domain}</div>
        </div>
      </div>
    ),
    size,
  );
}
