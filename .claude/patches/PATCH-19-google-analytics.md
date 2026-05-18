# PATCH-19 — Google Analytics 4 on Landing Page

## Problem
No visibility into landing page traffic, conversions,
pricing plan preferences, or download rates.

## Files Affected
- `apps/landing/app/layout.tsx`
- `apps/landing/components/Pricing.tsx`
- `apps/landing/app/download/page.tsx`
- `apps/landing/app/payment/success/page.tsx`

## Risk Level
🟢 LOW — Additive only. No existing logic changed.

---

## Claude Code Prompt

```
Read .claude/LANDING.md first.

I need to add Google Analytics 4 to the Next.js landing page.

STEP 1: Install the package
cd apps/landing && npm install @next/third-parties

STEP 2: In apps/landing/app/layout.tsx,
add the GA component.

Find the closing </body> tag or the end of the layout return.
Add these imports at the top:
  import { GoogleAnalytics } from '@next/third-parties/google';

Add the component INSIDE the <html> tags, after <body>:
  <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID || ''} />

This loads GA only when NEXT_PUBLIC_GA_ID is set.
Do not change the existing layout structure.

STEP 3: In apps/landing/.env.local, add:
  NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX

Replace G-XXXXXXXXXX with actual GA4 Measurement ID.
(Get from: analytics.google.com → Admin → Data Streams)

STEP 4: In apps/landing/components/Pricing.tsx,
add GA event tracking to the pay() function.

Find the pay(plan) function.
BEFORE the PaystackPop initialization, add:

  // Track checkout start
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', 'begin_checkout', {
      currency: currency,
      value: currency === 'NGN'
        ? (plan === 'monthly' ? 15000 : 100000)
        : (plan === 'monthly' ? 12 : 79),
      items: [{
        item_name: 'ZoomGuru ' + plan.charAt(0).toUpperCase() + plan.slice(1),
        item_category: currency,
        price: currency === 'NGN'
          ? (plan === 'monthly' ? 15000 : 100000)
          : (plan === 'monthly' ? 12 : 79),
        quantity: 1,
      }],
    });
  }

STEP 5: In apps/landing/app/payment/success/page.tsx,
add purchase event. Find where the success page renders
(after payment redirect). Add this in a useEffect:

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const plan = params.get('plan');
    const ref = params.get('ref');
    
    if (typeof window !== 'undefined' && (window as any).gtag && plan) {
      (window as any).gtag('event', 'purchase', {
        transaction_id: ref,
        currency: 'NGN',
        value: plan === 'monthly' ? 15000 : 100000,
        items: [{
          item_name: 'ZoomGuru ' + plan,
          quantity: 1,
        }],
      });
    }
  }, []);

STEP 6: In apps/landing/components/Download.tsx,
add download tracking to both download links:

  function trackDownload(platform: string, filename: string) {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'file_download', {
        file_name: filename,
        file_extension: platform === 'mac' ? 'dmg' : 'exe',
        link_text: platform === 'mac' ? 'Download for macOS' : 'Download for Windows',
      });
    }
  }

Add onClick={() => trackDownload('mac', 'ZoomGuru.dmg')} to the Mac link.
Add onClick={() => trackDownload('win', 'ZoomGuru-Setup.exe')} to the Win link.

Do not change any existing download logic or styling.
Show me each file changed with its diff.
```

---

## GA4 Events Summary

```
Events being tracked:
    ├── page_view (automatic via GoogleAnalytics component)
    ├── begin_checkout (pricing plan clicked)
    ├── purchase (payment success page)
    ├── file_download (download button clicked)
    └── scroll, session_start (automatic via GA4)

Custom dimensions to add in GA4 dashboard:
    ├── plan (monthly/lifetime)
    ├── currency (NGN/USD)
    └── platform (mac/win)
```

## GA4 Setup Steps

```
1. Go to analytics.google.com
2. Create new GA4 property for zoomguru.com
3. Add Web data stream → enter zoomguru.com
4. Copy Measurement ID (G-XXXXXXXXXX)
5. Paste into NEXT_PUBLIC_GA_ID in .env.local
6. Deploy → verify in GA4 Realtime reports
```

## Verification

```bash
npm run dev

# Open browser dev tools → Network tab
# Navigate landing page
# Should see requests to google-analytics.com
# Go to GA4 → Realtime → should see active users
# Click a pricing button → DebugView should show begin_checkout event
```

## Rollback
Remove GoogleAnalytics component from layout.tsx.
Remove gtag() calls from Pricing.tsx, success page, Download.tsx.
Uninstall @next/third-parties.
Remove NEXT_PUBLIC_GA_ID from .env.local.
