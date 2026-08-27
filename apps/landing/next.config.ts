import type { NextConfig } from 'next';

const config: NextConfig = {
  // This repo keeps its agent context in .claude/CLAUDE.md. A second generated
  // CLAUDE.md inside the app would compete with it.
  agentRules: false,

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
