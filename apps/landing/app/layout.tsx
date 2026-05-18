import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import ReferralCapture from '@/components/ReferralCapture';

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
      <body className="relative">
        <ReferralCapture />
        <Navbar />
        <main>{children}</main>
      </body>
    </html>
  );
}
