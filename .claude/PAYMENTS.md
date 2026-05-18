# ZoomGuru — Payments

## Provider
**Paystack** — NGN only. All prices in Nigerian Naira.

---

## Pricing

| Plan | NGN | Type | expires_at |
|------|-----|------|------------|
| Monthly | ₦15,000 | One-time charge, self-renew | NOW() + 30 days |
| Lifetime | ₦100,000 | One-time charge | NULL (never) |

No Paystack subscription plans or plan codes. We charge inline and track expiry in our own database.

---

## Environment Variables

```env
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxx     # Backend — signs API requests
PAYSTACK_PUBLIC_KEY=pk_test_xxxxxxxxxxxx     # Landing page — inline JS popup
PAYSTACK_WEBHOOK_SECRET=xxxxxxxxxxxx         # Backend — verifies webhook signatures
```

No `PAYSTACK_NGN_MONTHLY_PLAN` or `PAYSTACK_USD_MONTHLY_PLAN` needed.

---

## Payment Flows

### Flow 1 — Landing Page (inline JS)
```
User on /pricing enters email, clicks plan
        ↓
Paystack inline popup opens (card / bank transfer / USSD)
        ↓
User pays
        ↓
Paystack fires POST /paystack/webhook → backend
Backend verifies HMAC signature
Sets is_pro = true, inserts license row
Monthly: expires_at = NOW() + 30 days
Lifetime: expires_at = NULL
        ↓
Redirect to /download?ref=<reference>&plan=<plan>
User downloads app, logs in → already Pro
```

### Flow 2 — In-App (Electron)
```
User hits usage limit in overlay → PaywallModal opens
        ↓
Electron calls POST /paystack/initialize (JWT auth)
Backend creates Paystack transaction, returns authorization_url
        ↓
Electron opens authorization_url in system browser
        ↓
User pays on Paystack hosted page
        ↓
Paystack fires POST /paystack/webhook → backend activates license
        ↓
Electron polls GET /license/verify every 3s for up to 60s
License verified → overlay unlocks Pro features
```

---

## Webhook Endpoint

```
POST /paystack/webhook
```

Registered in Paystack Dashboard → Settings → API Keys & Webhooks.

**Events handled:**
- `charge.success` → activate license
- `invoice.payment_failed` → logged only (no action)

**Security:** Every request verified with HMAC-SHA512 using `PAYSTACK_WEBHOOK_SECRET`.
Idempotent — replayed webhooks with an already-processed reference return `200` silently.

---

## License Expiry (Monthly)

Monthly licenses are **not auto-renewed** by Paystack. Renewal is a new payment.

On every login, `auth.service.ts` runs:
1. Expire any license where `expires_at < NOW()`
2. If no active licenses remain → downgrade user to `is_pro = false`, `plan = 'free'`
3. User must pay again to re-activate

---

## paystack.controller.ts (current)

```typescript
@Controller('paystack')
export class PaystackController {

  @Post('initialize')        // JWT protected — Electron in-app upgrade
  @Post('webhook')           // Public — Paystack calls this
  @Get('plans')              // Returns NGN prices
}
```

### GET /paystack/plans response
```json
{
  "monthly":  { "amount": 15000,  "currency": "NGN", "label": "₦15,000/month",    "period": "/month" },
  "lifetime": { "amount": 100000, "currency": "NGN", "label": "₦100,000 one-time", "period": " one-time" }
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
  amount: 1500000, // kobo — ₦15,000 monthly | 10000000 = ₦100,000 lifetime
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
    body: JSON.stringify({ plan }),  // NGN only — no currency param
  });
  const { authorizationUrl } = await res.json();
  await window.zoomguru.openExternal(authorizationUrl);  // Opens system browser
  pollLicenseActivation();  // Polls GET /license/verify every 3s
}
```
