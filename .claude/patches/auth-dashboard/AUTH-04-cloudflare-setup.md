# AUTH-04 â€” Cloudflare Setup (Free DDoS + WAF + CDN)

## What This Does
Routes all traffic through Cloudflare's free tier.
Protects against DDoS, bots, credential stuffing.
Adds free SSL, CDN caching, and rate limiting.

## Risk Level
ðŸŸ¢ LOW â€” DNS change only. No code changes.
Worst case: revert nameservers, everything goes back to normal.

---

## Prompt

```
Guide me through setting up Cloudflare free tier for ZoomGuru.
I need protection on these domains:
  zoomguru.xyz          â†’ Netlify (landing + user dashboard)
  admin.zoomguru.xyz    â†’ Netlify (admin dashboard)
  api.zoomguru.xyz      â†’ Render (backend)

Walk me through every step from account creation to
WAF rules being active. No code changes needed.
```

---

## The Steps

### Part 1 â€” Create Cloudflare Account

```
1. Go to: cloudflare.com
2. Sign up with your email
3. Choose Free plan
4. Click "Add a Site"
5. Enter: zoomguru.xyz
6. Select Free plan â†’ Continue
```

### Part 2 â€” Cloudflare Scans Your DNS

```
Cloudflare will auto-detect your existing DNS records.
Review what it finds.

You should see records like:
  A/CNAME records pointing to Netlify
  MX records (email) if you have email set up

DO NOT delete any MX records â€” that breaks email.
```

### Part 3 â€” Add Your DNS Records

```
Add these records manually if not already detected:

Record 1 â€” Landing page (Netlify):
  Type:    CNAME
  Name:    @  (or zoomguru.xyz)
  Target:  your-netlify-site.netlify.app
  Proxy:   ON (orange cloud) â† important

Record 2 â€” Admin dashboard (Netlify):
  Type:    CNAME
  Name:    admin
  Target:  your-admin-netlify-site.netlify.app
  Proxy:   ON (orange cloud)

Record 3 â€” API backend (Render):
  Type:    CNAME
  Name:    api
  Target:  your-render-app.onrender.com
  Proxy:   ON (orange cloud)

Record 4 â€” WWW redirect:
  Type:    CNAME
  Name:    www
  Target:  zoomguru.xyz
  Proxy:   ON (orange cloud)

The orange cloud (proxy ON) means traffic goes through
Cloudflare. This enables all protection features.
Your real server IP is hidden from attackers.
```

### Part 4 â€” Change Nameservers at Your Domain Registrar

```
Cloudflare will show you two nameservers like:
  ada.ns.cloudflare.com
  bob.ns.cloudflare.com

Go to wherever you bought zoomguru.xyz (Namecheap, GoDaddy, etc)
Find: DNS Settings â†’ Nameservers
Change to: Custom nameservers
Enter the two Cloudflare nameservers exactly as shown
Save.

Propagation takes 5 minutes to 48 hours.
Usually done in under 30 minutes.
```

### Part 5 â€” SSL/TLS Configuration

```
In Cloudflare dashboard â†’ SSL/TLS:
  Mode: Full (strict)
  This means: Cloudflare â†” Browser is HTTPS (Cloudflare cert)
              Cloudflare â†” Your server is HTTPS (Netlify/Render cert)

Under Edge Certificates:
  Always Use HTTPS: ON
  Minimum TLS Version: TLS 1.2
  Opportunistic Encryption: ON
  TLS 1.3: ON
  Automatic HTTPS Rewrites: ON
```

### Part 6 â€” Security Settings

```
In Cloudflare dashboard â†’ Security:

Security Level: Medium
  (blocks known bad IPs and suspicious requests)

Bot Fight Mode: ON
  (free â€” blocks simple bots, scrapers)

Challenge Passage: 30 minutes
  (if someone passes a CAPTCHA, don't challenge again for 30 min)

Under Security â†’ Settings:
  Browser Integrity Check: ON
  Privacy Pass Support: ON
```

### Part 7 â€” WAF Rate Limiting Rules (Free Tier)

```
Go to: Security â†’ WAF â†’ Rate Limiting Rules

Rule 1 â€” Protect auth endpoints:
  Name: Block auth brute force
  Field: URI Path
  Operator: contains
  Value: /api/auth
  Rate: More than 10 requests per 1 minute
  From same IP
  Action: Block for 10 minutes
  Click Deploy

Rule 2 â€” Protect payment webhook:
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

### Part 8 â€” Page Rules (Caching)

```
Go to: Rules â†’ Page Rules (3 free rules)

Rule 1 â€” Cache landing page assets:
  URL: zoomguru.xyz/static/*
  Setting: Cache Level = Cache Everything
  Edge Cache TTL: 1 day

Rule 2 â€” No cache on API:
  URL: api.zoomguru.xyz/*
  Setting: Cache Level = Bypass

Rule 3 â€” Force HTTPS on all:
  URL: http://*zoomguru.xyz/*
  Setting: Always Use HTTPS
```

### Part 9 â€” Verify Everything Works

```
After nameserver propagation (check at dnschecker.org):

1. Visit https://zoomguru.xyz
   Should load your landing page
   Padlock shows "Cloudflare Inc" certificate

2. Visit https://api.zoomguru.xyz/health
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

1. Go to Netlify â†’ your site â†’ Domain settings
2. Add custom domain: zoomguru.xyz
3. Netlify will say DNS not configured
   â†’ Ignore this â€” Cloudflare handles DNS
4. Under HTTPS â†’ Verify DNS configuration
5. Netlify provisions its own cert but Cloudflare
   uses its own cert for visitors â€” both are fine

For admin.zoomguru.xyz:
Same process on the admin Netlify site
Add custom domain: admin.zoomguru.xyz
```

---

## What You Get For Free

```
âœ… DDoS protection â€” unlimited, always on
âœ… SSL certificate â€” automatic, renews automatically
âœ… CDN â€” static assets cached at 200+ edge locations globally
âœ… Bot Fight Mode â€” blocks basic bots and scrapers
âœ… 1 WAF rate limiting rule
âœ… Analytics â€” traffic, bandwidth, threats
âœ… Always HTTPS redirect
âœ… Hidden server IP â€” Render/Netlify IPs never exposed
âœ… Page Rules â€” 3 rules for caching/redirect logic

Not included free (Pro $20/mo adds):
  â†’ Advanced WAF rules (50 rules)
  â†’ Advanced bot protection
  â†’ 5 Page Rules (vs 3)
  â†’ Image optimization
```

