import type { Metadata } from 'next';
import './globals.css';
import NavbarWrapper from '@/components/NavbarWrapper';
import ReferralCapture from '@/components/ReferralCapture';
import GalaxyBackground from '@/components/GalaxyBackground';
import { Providers } from '@/components/Providers';

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'ZoomGuru — Invisible AI Interview Copilot',
  description:
    'AI that listens to your interview, reads your screen, and streams personalized answers in real time. Completely invisible to screen share software. Built around your CV.',
  keywords: 'interview AI, interview copilot, AI interview helper, invisible overlay, Zoom interview, interview assistant, interview cheat',
  openGraph: {
    title: 'ZoomGuru — Your invisible edge in every interview',
    description:
      'AI copilot that listens, reads your screen, and streams personalized answers. Hidden from Zoom, Meet, and Teams. Personalized to your CV.',
    url: 'https://zoomguru.com',
    siteName: 'ZoomGuru',
    images: [{ url: 'https://zoomguru.com/og-image.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ZoomGuru — Invisible AI Interview Copilot',
    description:
      'AI that listens to your interview and streams personalized answers in real time. Invisible to screen share.',
    images: ['https://zoomguru.com/og-image.png'],
  },
  metadataBase: new URL('https://zoomguru.com'),
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="relative">
        <Providers>
          {/* Galaxy — fixed behind everything */}
          <GalaxyBackground />
          <ReferralCapture />
          <NavbarWrapper />
          <main className="relative z-10">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
