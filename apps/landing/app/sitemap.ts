import type { MetadataRoute } from 'next';
import { ROUTES, SITE } from '@/lib/site';

// Generated from ROUTES so a new page cannot be forgotten here.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return ROUTES.map((route) => ({
    url: `${SITE.url}${route === '/' ? '' : route}`,
    lastModified: now,
    changeFrequency: route === '/' ? 'weekly' : 'monthly',
    priority: route === '/' ? 1 : route === '/pricing' || route === '/download' ? 0.9 : 0.7,
  }));
}
