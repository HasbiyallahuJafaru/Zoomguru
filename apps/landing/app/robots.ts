import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

// The AI crawlers are allowed on purpose: people increasingly ask an assistant
// which interview copilot to use, and we would rather be quotable than absent.
const AI_CRAWLERS = [
  'GPTBot',
  'ChatGPT-User',
  'OAI-SearchBot',
  'ClaudeBot',
  'Claude-Web',
  'anthropic-ai',
  'PerplexityBot',
  'Google-Extended',
  'CCBot',
  'Applebot-Extended',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Minted per payment and single-use — nothing for a crawler to index.
        disallow: ['/checkout.html', '/payment-success.html'],
      },
      ...AI_CRAWLERS.map((userAgent) => ({ userAgent, allow: '/' })),
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
