// Every absolute URL, external endpoint and route label the site needs.
// Nothing here is secret — these are the same public constants the old static
// pages hardcoded, gathered into one place so a host change is a single edit.

export const SITE = {
  name: 'ZoomGuru',
  domain: 'zoomguru.xyz',
  url: 'https://zoomguru.xyz',
  tagline: 'An AI interview copilot your interviewer cannot see.',
  description:
    'ZoomGuru listens to your interview and streams an answer onto your screen. It stays invisible to screen share. Works with Zoom, Meet and Teams.',
  supportEmail: 'support@zoomguru.xyz',
} as const;

// The Railway backend. Download links 302 through it so the hit is recorded.
export const BACKEND_URL = 'https://zoomguru-backend-production.up.railway.app';

export const DOWNLOAD = {
  windows: `${BACKEND_URL}/analytics/download?platform=windows`,
  // The macOS build is not shipping yet. When it does, flip `available` and the
  // buttons light up on their own.
  mac: { href: `${BACKEND_URL}/analytics/download?platform=mac`, available: false },
} as const;

export const REQUIREMENTS = {
  os: 'Windows 10 or later',
  size: '~90 MB',
  ram: '4 GB RAM',
} as const;

export interface FeaturePage {
  slug: string;
  /** Short label for nav and cards. */
  name: string;
  /** The hotkey that triggers it, where there is one. */
  hotkey?: string;
  /** One line, plain, on the card. */
  blurb: string;
}

export const FEATURES: FeaturePage[] = [
  {
    slug: 'live-copilot',
    name: 'Live copilot',
    hotkey: 'Ctrl+Shift+L',
    blurb: 'Press once when a question lands. The answer starts writing itself.',
  },
  {
    slug: 'auto-mode',
    name: 'Auto mode',
    hotkey: 'Ctrl+Shift+D',
    blurb: 'Stop pressing anything. It hears each question and answers on its own.',
  },
  {
    slug: 'screenshot-answers',
    name: 'Screenshot answers',
    hotkey: 'Ctrl+Shift+S',
    blurb: 'For the shared screen — a diagram, a take-home, a block of code.',
  },
  {
    slug: 'invisible-overlay',
    name: 'Invisible overlay',
    hotkey: 'Ctrl+Shift+H',
    blurb: 'On your monitor, not in the meeting. The share shows an empty desktop.',
  },
];

export const NAV = [
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/download', label: 'Download' },
  { href: '/faq', label: 'FAQ' },
] as const;

export const LEGAL_NAV = [
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/refund', label: 'Refunds' },
] as const;

/** Every indexable route, for sitemap.ts. */
export const ROUTES = [
  '/',
  '/pricing',
  '/download',
  '/features',
  ...FEATURES.map((f) => `/features/${f.slug}`),
  '/faq',
  '/terms',
  '/privacy',
  '/refund',
] as const;
