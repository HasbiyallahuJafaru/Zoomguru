# AUTH-04 — Cloudflare Setup (Free DDoS + WAF + CDN)

## What This Does
Routes all traffic through Cloudflare's free tier.
Protects against DDoS, bots, credential stuffing.
Adds free SSL, CDN caching, and rate limiting.

## Risk Level
🟢 LOW — DNS change only. No code changes.
Worst case: revert nameservers, everything goes back to normal.

---

## Prompt

```
Guide me through setting up Cloudflare free tier for ZoomGuru.
I need protection on these domains:
  zoomguru.com          → Netlify (landing + user dashboard)
  admin.zoomguru.com    → Netlify (admin dashboard)
  api.zoomguru.com      → Render (backend)

Walk me through every step from account creation to
WAF rules being active. No code changes needed.
```

---

## The Steps

### Part 1 — Create Cloudflare Account

```
1. Go to: cloudflare.com
2. Sign up with your email
3. Choose Free plan
4. Click "Add a Site"
5. Enter: zoomguru.com
6. Select Free plan → Continue
```

### Part 2 — Cloudflare Scans Your DNS

```
Cloudflare will auto-detect your existing DNS records.
Review what it finds.

You should see records like:
  A/CNAME records pointing to Netlify
  MX records (email) if you have email set up

DO NOT delete any MX records — that breaks email.
```

### Part 3 — Add Your DNS Records

```
Add these records manually if not already detected:

Record 1 — Landing page (Netlify):
  Type:    CNAME
  Name:    @  (or zoomguru.com)
  Target:  your-netlify-site.netlify.app
  Proxy:   ON (orange cloud) ← important

Record 2 — Admin dashboard (Netlify):
  Type:    CNAME
  Name:    admin
  Target:  your-admin-netlify-site.netlify.app
  Proxy:   ON (orange cloud)

Record 3 — API backend (Render):
  Type:    CNAME
  Name:    api
  Target:  your-render-app.onrender.com
  Proxy:   ON (orange cloud)

Record 4 — WWW redirect:
  Type:    CNAME
  Name:    www
  Target:  zoomguru.com
  Proxy:   ON (orange cloud)

The orange cloud (proxy ON) means traffic goes through
Cloudflare. This enables all protection features.
Your real server IP is hidden from attackers.
```

### Part 4 — Change Nameservers at Your Domain Registrar

```
Cloudflare will show you two nameservers like:
  ada.ns.cloudflare.com
  bob.ns.cloudflare.com

Go to wherever you bought zoomguru.com (Namecheap, GoDaddy, etc)
Find: DNS Settings → Nameservers
Change to: Custom nameservers
Enter the two Cloudflare nameservers exactly as shown
Save.

Propagation takes 5 minutes to 48 hours.
Usually done in under 30 minutes.
```

### Part 5 — SSL/TLS Configuration

```
In Cloudflare dashboard → SSL/TLS:
  Mode: Full (strict)
  This means: Cloudflare ↔ Browser is HTTPS (Cloudflare cert)
              Cloudflare ↔ Your server is HTTPS (Netlify/Render cert)

Under Edge Certificates:
  Always Use HTTPS: ON
  Minimum TLS Version: TLS 1.2
  Opportunistic Encryption: ON
  TLS 1.3: ON
  Automatic HTTPS Rewrites: ON
```

### Part 6 — Security Settings

```
In Cloudflare dashboard → Security:

Security Level: Medium
  (blocks known bad IPs and suspicious requests)

Bot Fight Mode: ON
  (free — blocks simple bots, scrapers)

Challenge Passage: 30 minutes
  (if someone passes a CAPTCHA, don't challenge again for 30 min)

Under Security → Settings:
  Browser Integrity Check: ON
  Privacy Pass Support: ON
```

### Part 7 — WAF Rate Limiting Rules (Free Tier)

```
Go to: Security → WAF → Rate Limiting Rules

Rule 1 — Protect auth endpoints:
  Name: Block auth brute force
  Field: URI Path
  Operator: contains
  Value: /api/auth
  Rate: More than 10 requests per 1 minute
  From same IP
  Action: Block for 10 minutes
  Click Deploy

Rule 2 — Protect payment webhook:
  Name: Protect Paystack webhook
  Field: URI Path
  Operator: equals
  Value: /paystack/webhook
  Rate: More than 20 requests per 1 minute
  Action: Block for 5 minutes
  Click Deploy

Note: Free tier allows 1 custom rate limiting rule.
If you need both, upgrade to Pro ($20/mo) or
prioritize Rule 1 (auth protection is more critical).
```

### Part 8 — Page Rules (Caching)

```
Go to: Rules → Page Rules (3 free rules)

Rule 1 — Cache landing page assets:
  URL: zoomguru.com/static/*
  Setting: Cache Level = Cache Everything
  Edge Cache TTL: 1 day

Rule 2 — No cache on API:
  URL: api.zoomguru.com/*
  Setting: Cache Level = Bypass

Rule 3 — Force HTTPS on all:
  URL: http://*zoomguru.com/*
  Setting: Always Use HTTPS
```

### Part 9 — Verify Everything Works

```
After nameserver propagation (check at dnschecker.org):

1. Visit https://zoomguru.com
   Should load your landing page
   Padlock shows "Cloudflare Inc" certificate

2. Visit https://api.zoomguru.com/health
   Should return {"status":"ok",...}

3. Check Cloudflare Analytics after 1 hour
   Should show traffic, cached requests, threats blocked

4. In Render settings, add Cloudflare's IP ranges
   to any allowlist if Render blocks unknown IPs
   Cloudflare IP list: cloudflare.com/ips
```

---

## Netlify Specific Setup

```
When using Cloudflare in front of Netlify,
you need to tell Netlify about your custom domain:

1. Go to Netlify → your site → Domain settings
2. Add custom domain: zoomguru.com
3. Netlify will say DNS not configured
   → Ignore this — Cloudflare handles DNS
4. Under HTTPS → Verify DNS configuration
5. Netlify provisions its own cert but Cloudflare
   uses its own cert for visitors — both are fine

For admin.zoomguru.com:
Same process on the admin Netlify site
Add custom domain: admin.zoomguru.com
```

---

## What You Get For Free

```
✅ DDoS protection — unlimited, always on
✅ SSL certificate — automatic, renews automatically
✅ CDN — static assets cached at 200+ edge locations globally
✅ Bot Fight Mode — blocks basic bots and scrapers
✅ 1 WAF rate limiting rule
✅ Analytics — traffic, bandwidth, threats
✅ Always HTTPS redirect
✅ Hidden server IP — Render/Netlify IPs never exposed
✅ Page Rules — 3 rules for caching/redirect logic

Not included free (Pro $20/mo adds):
  → Advanced WAF rules (50 rules)
  → Advanced bot protection
  → 5 Page Rules (vs 3)
  → Image optimization
```
