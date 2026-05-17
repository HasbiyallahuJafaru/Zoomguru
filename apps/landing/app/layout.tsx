import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ZoomGuru — Invisible AI Interview Copilot',
  description:
    'AI that listens to your interview, reads your screen, and answers in real time. Completely invisible to screen share. Personalized to your CV.',
  openGraph: {
    title: 'ZoomGuru — Invisible AI Interview Copilot',
    description:
      'AI that listens to your interview, reads your screen, and answers in real time. Completely invisible to screen share. Personalized to your CV.',
    url: 'https://zoomguru.com',
    siteName: 'ZoomGuru',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ZoomGuru — Invisible AI Interview Copilot',
    description:
      'AI that listens to your interview, reads your screen, and answers in real time. Completely invisible to screen share.',
  },
  metadataBase: new URL('https://zoomguru.com'),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
