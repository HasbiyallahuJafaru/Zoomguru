# ZoomGuru â€” Landing Page

## Stack
- **Next.js 14** â€” App Router
- **Tailwind CSS** â€” styling
- **Vercel** â€” hosting + automatic deploys from Git
- **Paystack Inline** â€” payment widget

---

## Directory Structure

```
apps/landing/
â”œâ”€â”€ app/
â”‚   â”œâ”€â”€ layout.tsx           â† root layout, fonts, meta
â”‚   â”œâ”€â”€ page.tsx             â† home (hero + features + pricing + download)
â”‚   â”œâ”€â”€ download/
â”‚   â”‚   â””â”€â”€ page.tsx         â† post-payment download page
â”‚   â”œâ”€â”€ payment/
â”‚   â”‚   â””â”€â”€ success/
â”‚   â”‚       â””â”€â”€ page.tsx     â† payment success redirect handler
â”‚   â””â”€â”€ globals.css
â”œâ”€â”€ components/
â”‚   â”œâ”€â”€ Hero.tsx
â”‚   â”œâ”€â”€ HowItWorks.tsx
â”‚   â”œâ”€â”€ Features.tsx
â”‚   â”œâ”€â”€ Pricing.tsx          â† Paystack inline trigger
â”‚   â”œâ”€â”€ Download.tsx         â† OS detection + download links
â”‚   â”œâ”€â”€ FAQ.tsx
â”‚   â””â”€â”€ Footer.tsx
â”œâ”€â”€ public/
â”‚   â”œâ”€â”€ demo.mp4             â† screen recording of app in action
â”‚   â”œâ”€â”€ icon.png
â”‚   â””â”€â”€ og-image.png
â”œâ”€â”€ next.config.js
â”œâ”€â”€ tailwind.config.js
â””â”€â”€ netlify.toml
```

---

## Page Sections

### Hero
```
Invisible AI. Real answers. Every interview.

ZoomGuru sits on your screen â€” visible only to you.
Listens to questions. Reads your screen. Answers in real time.
Personalized to your CV. Hidden from screen share.

[Start Free â€” 3 Sessions]    [See How It Works â†“]

â”€â”€ floating mockup of overlay on a Zoom call â”€â”€
```

### How It Works
```
1. Upload your CV
   â†’ ZoomGuru learns your experience, skills, projects

2. Start your interview
   â†’ Open any video call. ZoomGuru floats on your screen.

3. Press a hotkey or say "Hey ZoomGuru"
   â†’ It listens, thinks, answers â€” in under a second.

4. You deliver the answer
   â†’ Confidently. Naturally. Like you knew it all along.
```

### Features Grid
```
ðŸŽ¯ Personalized to your CV        Every answer sounds like you
ðŸ‘» Invisible to screen share      Zoom, Meet, Teams â€” none can see it
âš¡ Streams in real time           First word in under 500ms
ðŸ“¸ Screenshot understanding       Reads code challenges, diagrams
ðŸŽ¤ Listens to audio               Transcribes questions automatically
ðŸ§  Deep reasoning mode            Solves coding & system design
ðŸ’¬ Session memory                 Remembers what was said 10 mins ago
ðŸŒ Works on Mac + Windows         Full support both platforms
```

### Pricing
```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚      Monthly        â”‚       Lifetime        â”‚
â”‚                     â”‚                       â”‚
â”‚  â‚¦15,000 / $12      â”‚  â‚¦100,000 / $79       â”‚
â”‚    per month        â”‚    pay once           â”‚
â”‚                     â”‚                       â”‚
â”‚ âœ“ Unlimited answers â”‚ âœ“ Unlimited answers   â”‚
â”‚ âœ“ Screenshot mode   â”‚ âœ“ Screenshot mode     â”‚
â”‚ âœ“ Wake word         â”‚ âœ“ Wake word           â”‚
â”‚ âœ“ Session history   â”‚ âœ“ Session history     â”‚
â”‚ âœ“ All future        â”‚ âœ“ All future          â”‚
â”‚   updates           â”‚   updates forever     â”‚
â”‚                     â”‚                       â”‚
â”‚ [Pay â‚¦15k/month]    â”‚ [Pay â‚¦100k lifetime]  â”‚
â”‚ [Pay $12/month]     â”‚ [Pay $79 lifetime]    â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜

Free â€” 3 sessions Â· 10 answers each Â· no card required
```

### Download Section
```
Download ZoomGuru

macOS (Apple Silicon + Intel)    [Download .dmg]
Windows (64-bit)                 [Download .exe]

Version 1.0.0 Â· Requires macOS 12+ or Windows 10+
```

---

## Pricing.tsx â€” Paystack Integration

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
  NGN: { monthly: 'â‚¦15,000/month', lifetime: 'â‚¦100,000 one-time' },
  USD: { monthly: '$12/month', lifetime: '$79 one-time' },
};

export function Pricing() {
  const [currency, setCurrency] = useState<Currency>('NGN');
  const [loading, setLoading] = useState<Plan | null>(null);

  function pay(plan: Plan) {
    setLoading(plan);

    // @ts-ignore â€” PaystackPop loaded via script
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
            â‚¦ Naira
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
          Not ready? Start free â€” 3 sessions, no card required.
        </p>
      </section>
    </>
  );
}
```

---

## Download.tsx â€” OS Detection

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

// Download links â€” update these after each release
const DOWNLOAD_LINKS = {
  mac: 'https://releases.zoomguru.xyz/ZoomGuru-1.0.0-arm64.dmg',
  windows: 'https://releases.zoomguru.xyz/ZoomGuru-Setup-1.0.0.exe',
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
        Requires macOS 12 Monterey or later Â· Windows 10/11 64-bit
      </p>
    </section>
  );
}
```

---

## vercel.json

```json
{
  "framework": "nextjs",
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://api.zoomguru.xyz/:path*" }
  ]
}
```

Vercel auto-detects Next.js â€” no build command or publish dir needed.
Connect the repo in the Vercel dashboard, set root directory to `apps/landing`, and deploy.

---

## SEO Meta (layout.tsx)

```tsx
export const metadata = {
  title: 'ZoomGuru â€” Invisible AI Interview Copilot',
  description: 'AI that listens to your interview, reads your screen, and answers in real time. Completely invisible to screen share. Personalized to your CV.',
  keywords: 'interview AI, interview copilot, AI interview helper, invisible overlay, Zoom interview help',
  openGraph: {
    title: 'ZoomGuru â€” Your invisible edge in every interview',
    description: 'AI copilot that helps you ace interviews. Hidden from screen share. Personalized answers from your CV.',
    url: 'https://zoomguru.xyz',
    images: [{ url: 'https://zoomguru.xyz/og-image.png' }],
  },
};
```

---

## Environment Variables

```env
# apps/landing/.env.local
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_live_xxxxxxxxxxxx
NEXT_PUBLIC_API_URL=https://api.zoomguru.xyz
```

