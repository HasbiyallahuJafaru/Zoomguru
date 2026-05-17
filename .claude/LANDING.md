# ZoomGuru — Landing Page

## Stack
- **Next.js 14** — App Router
- **Tailwind CSS** — styling
- **Netlify** — hosting + automatic deploys from Git
- **Paystack Inline** — payment widget

---

## Directory Structure

```
apps/landing/
├── app/
│   ├── layout.tsx           ← root layout, fonts, meta
│   ├── page.tsx             ← home (hero + features + pricing + download)
│   ├── download/
│   │   └── page.tsx         ← post-payment download page
│   ├── payment/
│   │   └── success/
│   │       └── page.tsx     ← payment success redirect handler
│   └── globals.css
├── components/
│   ├── Hero.tsx
│   ├── HowItWorks.tsx
│   ├── Features.tsx
│   ├── Pricing.tsx          ← Paystack inline trigger
│   ├── Download.tsx         ← OS detection + download links
│   ├── FAQ.tsx
│   └── Footer.tsx
├── public/
│   ├── demo.mp4             ← screen recording of app in action
│   ├── icon.png
│   └── og-image.png
├── next.config.js
├── tailwind.config.js
└── netlify.toml
```

---

## Page Sections

### Hero
```
Invisible AI. Real answers. Every interview.

ZoomGuru sits on your screen — visible only to you.
Listens to questions. Reads your screen. Answers in real time.
Personalized to your CV. Hidden from screen share.

[Start Free — 3 Sessions]    [See How It Works ↓]

── floating mockup of overlay on a Zoom call ──
```

### How It Works
```
1. Upload your CV
   → ZoomGuru learns your experience, skills, projects

2. Start your interview
   → Open any video call. ZoomGuru floats on your screen.

3. Press a hotkey or say "Hey ZoomGuru"
   → It listens, thinks, answers — in under a second.

4. You deliver the answer
   → Confidently. Naturally. Like you knew it all along.
```

### Features Grid
```
🎯 Personalized to your CV        Every answer sounds like you
👻 Invisible to screen share      Zoom, Meet, Teams — none can see it
⚡ Streams in real time           First word in under 500ms
📸 Screenshot understanding       Reads code challenges, diagrams
🎤 Listens to audio               Transcribes questions automatically
🧠 Deep reasoning mode            Solves coding & system design
💬 Session memory                 Remembers what was said 10 mins ago
🌍 Works on Mac + Windows         Full support both platforms
```

### Pricing
```
┌─────────────────────┬──────────────────────┐
│      Monthly        │       Lifetime        │
│                     │                       │
│  ₦15,000 / $12      │  ₦100,000 / $79       │
│    per month        │    pay once           │
│                     │                       │
│ ✓ Unlimited answers │ ✓ Unlimited answers   │
│ ✓ Screenshot mode   │ ✓ Screenshot mode     │
│ ✓ Wake word         │ ✓ Wake word           │
│ ✓ Session history   │ ✓ Session history     │
│ ✓ All future        │ ✓ All future          │
│   updates           │   updates forever     │
│                     │                       │
│ [Pay ₦15k/month]    │ [Pay ₦100k lifetime]  │
│ [Pay $12/month]     │ [Pay $79 lifetime]    │
└─────────────────────┴──────────────────────┘

Free — 3 sessions · 10 answers each · no card required
```

### Download Section
```
Download ZoomGuru

macOS (Apple Silicon + Intel)    [Download .dmg]
Windows (64-bit)                 [Download .exe]

Version 1.0.0 · Requires macOS 12+ or Windows 10+
```

---

## Pricing.tsx — Paystack Integration

```tsx
'use client';
import { useState } from 'react';
import Script from 'next/script';

type Currency = 'NGN' | 'USD';
type Plan = 'monthly' | 'lifetime';

const PRICES = {
  NGN: { monthly: 1500000, lifetime: 10000000 },
  USD: { monthly: 1200, lifetime: 7900 },
};

const LABELS = {
  NGN: { monthly: '₦15,000/month', lifetime: '₦100,000 one-time' },
  USD: { monthly: '$12/month', lifetime: '$79 one-time' },
};

export function Pricing() {
  const [currency, setCurrency] = useState<Currency>('NGN');
  const [loading, setLoading] = useState<Plan | null>(null);

  function pay(plan: Plan) {
    setLoading(plan);

    // @ts-ignore — PaystackPop loaded via script
    const popup = new PaystackPop();
    popup.newTransaction({
      key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
      email: prompt('Enter your email address:') || '',
      amount: PRICES[currency][plan],
      currency,
      metadata: { plan, source: 'landing' },
      onSuccess: (tx: any) => {
        window.location.href = `/download?ref=${tx.reference}&plan=${plan}`;
      },
      onCancel: () => setLoading(null),
    });
  }

  return (
    <>
      <Script src="https://js.paystack.co/v2/inline.js" strategy="lazyOnload" />

      <section id="pricing">
        {/* Currency toggle */}
        <div className="currency-toggle">
          <button
            onClick={() => setCurrency('NGN')}
            className={currency === 'NGN' ? 'active' : ''}
          >
            ₦ Naira
          </button>
          <button
            onClick={() => setCurrency('USD')}
            className={currency === 'USD' ? 'active' : ''}
          >
            $ Dollar
          </button>
        </div>

        <div className="plans-grid">
          {/* Monthly */}
          <div className="plan-card">
            <h3>Monthly</h3>
            <div className="price">{LABELS[currency].monthly}</div>
            <button
              onClick={() => pay('monthly')}
              disabled={loading === 'monthly'}
            >
              {loading === 'monthly' ? 'Opening...' : `Pay ${LABELS[currency].monthly}`}
            </button>
          </div>

          {/* Lifetime */}
          <div className="plan-card featured">
            <div className="badge">Best Value</div>
            <h3>Lifetime</h3>
            <div className="price">{LABELS[currency].lifetime}</div>
            <button
              onClick={() => pay('lifetime')}
              disabled={loading === 'lifetime'}
            >
              {loading === 'lifetime' ? 'Opening...' : `Pay ${LABELS[currency].lifetime}`}
            </button>
          </div>
        </div>

        <p className="free-note">
          Not ready? Start free — 3 sessions, no card required.
        </p>
      </section>
    </>
  );
}
```

---

## Download.tsx — OS Detection

```tsx
'use client';
import { useEffect, useState } from 'react';

type OS = 'mac' | 'windows' | 'unknown';

function detectOS(): OS {
  if (typeof window === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  if (ua.includes('Mac')) return 'mac';
  if (ua.includes('Win')) return 'windows';
  return 'unknown';
}

// Download links — update these after each release
const DOWNLOAD_LINKS = {
  mac: 'https://releases.zoomguru.com/ZoomGuru-1.0.0-arm64.dmg',
  windows: 'https://releases.zoomguru.com/ZoomGuru-Setup-1.0.0.exe',
};

export function Download() {
  const [os, setOS] = useState<OS>('unknown');

  useEffect(() => {
    setOS(detectOS());
  }, []);

  return (
    <section id="download">
      <h2>Download ZoomGuru</h2>

      {os === 'mac' && (
        <a href={DOWNLOAD_LINKS.mac} className="download-btn primary">
          Download for macOS (Apple Silicon + Intel)
        </a>
      )}

      {os === 'windows' && (
        <a href={DOWNLOAD_LINKS.windows} className="download-btn primary">
          Download for Windows (64-bit)
        </a>
      )}

      <div className="all-downloads">
        <a href={DOWNLOAD_LINKS.mac}>macOS .dmg</a>
        <a href={DOWNLOAD_LINKS.windows}>Windows .exe</a>
      </div>

      <p className="requirements">
        Requires macOS 12 Monterey or later · Windows 10/11 64-bit
      </p>
    </section>
  );
}
```

---

## netlify.toml

```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"

[[redirects]]
  from = "/api/*"
  to = "https://api.zoomguru.com/:splat"
  status = 200
  force = true
```

---

## SEO Meta (layout.tsx)

```tsx
export const metadata = {
  title: 'ZoomGuru — Invisible AI Interview Copilot',
  description: 'AI that listens to your interview, reads your screen, and answers in real time. Completely invisible to screen share. Personalized to your CV.',
  keywords: 'interview AI, interview copilot, AI interview helper, invisible overlay, Zoom interview help',
  openGraph: {
    title: 'ZoomGuru — Your invisible edge in every interview',
    description: 'AI copilot that helps you ace interviews. Hidden from screen share. Personalized answers from your CV.',
    url: 'https://zoomguru.com',
    images: [{ url: 'https://zoomguru.com/og-image.png' }],
  },
};
```

---

## Environment Variables

```env
# apps/landing/.env.local
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_live_xxxxxxxxxxxx
NEXT_PUBLIC_API_URL=https://api.zoomguru.com
```
