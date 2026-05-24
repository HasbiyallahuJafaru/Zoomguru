# ZoomGuru â€” Payments

## Provider
**Paystack** â€” NGN only. All prices in Nigerian Naira.

---

## Pricing

| Plan | NGN | Type | expires_at |
|------|-----|------|------------|
| Monthly | â‚¦15,000 | One-time charge, self-renew | NOW() + 30 days |
| Lifetime | â‚¦100,000 | One-time charge | NULL (never) |

No Paystack subscription plans or plan codes. We charge inline and track expiry in our own database.

---

## Environment Variables

```env
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxx     # Backend â€” signs API requests
PAYSTACK_PUBLIC_KEY=pk_test_xxxxxxxxxxxx     # Landing page â€” inline JS popup
PAYSTACK_WEBHOOK_SECRET=xxxxxxxxxxxx         # Backend â€” verifies webhook signatures
```

No `PAYSTACK_NGN_MONTHLY_PLAN` or `PAYSTACK_USD_MONTHLY_PLAN` needed.

---

## Payment Flows

### Flow 1 â€” Landing Page (inline JS)
```
User on /pricing enters email, clicks plan
        â†“
Paystack inline popup opens (card / bank transfer / USSD)
        â†“
User pays
        â†“
Paystack fires POST /paystack/webhook â†’ backend
Backend verifies HMAC signature
Sets is_pro = true, inserts license row
Monthly: expires_at = NOW() + 30 days
Lifetime: expires_at = NULL
        â†“
Redirect to /download?ref=<reference>&plan=<plan>
User downloads app, logs in â†’ already Pro
```

### Flow 2 â€” In-App (Electron)
```
User hits usage limit in overlay â†’ PaywallModal opens
        â†“
Electron calls POST /paystack/initialize (JWT auth)
Backend creates Paystack transaction, returns authorization_url
        â†“
Electron opens authorization_url in system browser
        â†“
User pays on Paystack hosted page
        â†“
Paystack fires POST /paystack/webhook â†’ backend activates license
        â†“
Electron polls GET /license/verify every 3s for up to 60s
License verified â†’ overlay unlocks Pro features
```

---

## Webhook Endpoint

```
POST /paystack/webhook
```

Registered in Paystack Dashboard â†’ Settings â†’ API Keys & Webhooks.

**Events handled:**
- `charge.success` â†’ activate license
- `invoice.payment_failed` â†’ logged only (no action)

**Security:** Every request verified with HMAC-SHA512 using `PAYSTACK_WEBHOOK_SECRET`.
Idempotent â€” replayed webhooks with an already-processed reference return `200` silently.

---

## License Expiry (Monthly)

Monthly licenses are **not auto-renewed** by Paystack. Renewal is a new payment.

On every login, `auth.service.ts` runs:
1. Expire any license where `expires_at < NOW()`
2. If no active licenses remain â†’ downgrade user to `is_pro = false`, `plan = 'free'`
3. User must pay again to re-activate

---

## paystack.controller.ts (current)

```typescript
@Controller('paystack')
export class PaystackController {

  @Post('initialize')        // JWT protected â€” Electron in-app upgrade
  @Post('webhook')           // Public â€” Paystack calls this
  @Get('plans')              // Returns NGN prices
}
```

### GET /paystack/plans response
```json
{
  "monthly":  { "amount": 15000,  "currency": "NGN", "label": "â‚¦15,000/month",    "period": "/month" },
  "lifetime": { "amount": 100000, "currency": "NGN", "label": "â‚¦100,000 one-time", "period": " one-time" }
}
```

---

## Landing Page Paystack Inline (Pricing.tsx)

```tsx
// Script loaded via Next.js Script component
<Script src="https://js.paystack.co/v2/inline.js" strategy="lazyOnload" />

// Payment trigger
window.PaystackPop.newTransaction({
  key: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
  email,
  amount: 1500000, // kobo â€” â‚¦15,000 monthly | 10000000 = â‚¦100,000 lifetime
  currency: 'NGN',
  ref: 'ZG-' + randomString,
  metadata: { plan: 'monthly' | 'lifetime' },
  onSuccess(tx) {
    window.location.href = `/download?ref=${tx.reference}&plan=${plan}`;
  },
  onCancel() {},
});
```

**env for landing:**
```env
# apps/landing/.env.local
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_test_xxxxxxxxxxxx
```

---

## Electron In-App PaywallModal

```tsx
async function handleUpgrade(plan: 'monthly' | 'lifetime') {
  const token = await window.zoomguru.store.get('access_token');
  const res = await fetch(`${API_URL}/paystack/initialize`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan }),  // NGN only â€” no currency param
  });
  const { authorizationUrl } = await res.json();
  await window.zoomguru.openExternal(authorizationUrl);  // Opens system browser
  pollLicenseActivation();  // Polls GET /license/verify every 3s
}
```

