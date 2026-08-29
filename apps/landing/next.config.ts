import type { NextConfig } from 'next';

const config: NextConfig = {
  // This repo keeps its agent context in .claude/CLAUDE.md. A second generated
  // CLAUDE.md inside the app would compete with it.
  agentRules: false,

  images: {
    // AVIF first, WebP for anything that cannot take it. The hero painting is
    // soft and textural, which is exactly what AVIF encodes well.
    formats: ['image/avif', 'image/webp'],
    // Next only serves qualities listed here. 55 is for the hero, which sits
    // under a 55% tint — compression artefacts are not survivable there.
    qualities: [55, 75],
  },

  async redirects() {
    // Explicit paths only. A wildcard such as /:path*.html would also catch
    // /checkout.html, which the backend mints payment links against — that
    // would break every in-app payment.
    return [
      { source: '/index.html', destination: '/', permanent: true },
      { source: '/faq.html', destination: '/faq', permanent: true },
      { source: '/privacy.html', destination: '/privacy', permanent: true },
      { source: '/terms.html', destination: '/terms', permanent: true },
      { source: '/refund.html', destination: '/refund', permanent: true },
    ];
  },
};

export default config;
