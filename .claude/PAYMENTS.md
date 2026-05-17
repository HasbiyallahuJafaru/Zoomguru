# ZoomGuru — Payments

## Provider
**Paystack** — handles NGN and USD natively

---

## Pricing Plans

| Plan | NGN | USD | Paystack Plan Code |
|------|-----|-----|--------------------|
| Monthly | ₦15,000 | $12 | `PLN_ngn_monthly` / `PLN_usd_monthly` |
| Lifetime | ₦100,000 | $79 | one-time charge (no plan code) |

Create plans in Paystack dashboard → Products → Plans.
Store plan codes in environment variables.

```env
PAYSTACK_NGN_MONTHLY_PLAN=PLN_xxxxxxxxxxxx
PAYSTACK_USD_MONTHLY_PLAN=PLN_xxxxxxxxxxxx
PAYSTACK_SECRET_KEY=sk_live_xxxxxxxxxxxx
PAYSTACK_WEBHOOK_SECRET=xxxxxxxxxxxx
PAYSTACK_PUBLIC_KEY=pk_live_xxxxxxxxxxxx
```

---

## Payment Flows

### Flow 1 — In-App (Electron)
```
User clicks Upgrade in overlay
         ↓
Electron calls POST /paystack/initialize
Backend creates Paystack transaction with user metadata
Returns authorization_url
         ↓
Electron opens authorization_url in system browser
         ↓
User pays on Paystack hosted page
         ↓
Paystack fires webhook → POST /paystack/webhook (backend)
Backend activates license
         ↓
Electron polls GET /license/verify every 3 seconds for 60s
License verified → overlay unlocks, shows Pro features
```

### Flow 2 — Landing Page
```
User on zoomguru.com clicks pricing plan
         ↓
Paystack inline widget opens in browser
         ↓
User pays
         ↓
Paystack fires webhook → POST /paystack/webhook
Backend activates license
         ↓
Redirect to /download page
User downloads correct installer (.exe or .dmg)
Installs app, logs in → already Pro
```

---

## paystack.controller.ts

```typescript
import { Controller, Post, Body, Get, Query, Headers, RawBodyRequest, Req } from '@nestjs/common';
import { PaystackService } from './paystack.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UseGuards, Request } from '@nestjs/common';
import { FastifyRequest } from 'fastify';

@Controller('paystack')
export class PaystackController {
  constructor(private readonly paystackService: PaystackService) {}

  @Post('initialize')
  @UseGuards(JwtAuthGuard)
  async initialize(@Request() req: any, @Body() body: {
    plan: 'monthly' | 'lifetime';
    currency: 'NGN' | 'USD';
  }) {
    return this.paystackService.initializeTransaction({
      userId: req.user.userId,
      email: req.user.email,
      plan: body.plan,
      currency: body.currency,
    });
  }

  @Post('webhook')
  async webhook(
    @Headers('x-paystack-signature') signature: string,
    @Body() body: any,
    @Req() req: FastifyRequest
  ) {
    return this.paystackService.handleWebhook(signature, body);
  }

  @Get('plans')
  getPlans() {
    return {
      ngn: {
        monthly: { amount: 15000, currency: 'NGN', label: '₦15,000/month' },
        lifetime: { amount: 100000, currency: 'NGN', label: '₦100,000 one-time' },
      },
      usd: {
        monthly: { amount: 12, currency: 'USD', label: '$12/month' },
        lifetime: { amount: 79, currency: 'USD', label: '$79 one-time' },
      },
    };
  }
}
```

---

## paystack.service.ts

```typescript
import { Injectable, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { getDB } from '../database/db';

@Injectable()
export class PaystackService {

  private readonly secretKey = process.env.PAYSTACK_SECRET_KEY!;
  private readonly webhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET!;

  async initializeTransaction(params: {
    userId: string;
    email: string;
    plan: 'monthly' | 'lifetime';
    currency: 'NGN' | 'USD';
  }) {
    const { userId, email, plan, currency } = params;

    const isMonthly = plan === 'monthly';
    const amount = currency === 'NGN'
      ? (isMonthly ? 1500000 : 10000000)   // Paystack uses kobo for NGN
      : (isMonthly ? 1200 : 7900);          // cents for USD

    const body: any = {
      email,
      amount,
      currency,
      metadata: {
        user_id: userId,
        plan,
        cancel_action: 'https://zoomguru.com/pricing',
      },
      callback_url: 'https://zoomguru.com/payment/success',
    };

    // Monthly — attach plan for subscription
    if (isMonthly) {
      body.plan = currency === 'NGN'
        ? process.env.PAYSTACK_NGN_MONTHLY_PLAN
        : process.env.PAYSTACK_USD_MONTHLY_PLAN;
    }

    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    if (!data.status) throw new BadRequestException('Paystack initialization failed');

    // Record pending payment
    const sql = getDB();
    await sql`
      INSERT INTO payments (user_id, paystack_reference, amount, currency, plan, status)
      VALUES (${userId}, ${data.data.reference}, ${amount / 100}, ${currency}, ${plan}, 'pending')
      ON CONFLICT (paystack_reference) DO NOTHING
    `;

    return {
      authorizationUrl: data.data.authorization_url,
      reference: data.data.reference,
    };
  }

  async handleWebhook(signature: string, body: any) {
    // 1. Verify Paystack signature
    const hash = crypto
      .createHmac('sha512', this.webhookSecret)
      .update(JSON.stringify(body))
      .digest('hex');

    if (hash !== signature) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const event = body.event;
    const data = body.data;

    // 2. Handle events
    if (event === 'charge.success' || event === 'subscription.create') {
      await this.activateLicense(data);
    }

    if (event === 'subscription.disable' || event === 'subscription.not_renew') {
      await this.deactivateLicense(data);
    }

    return { received: true };
  }

  private async activateLicense(data: any) {
    const sql = getDB();

    const userId = data.metadata?.user_id;
    const reference = data.reference;
    const plan = data.metadata?.plan || 'monthly';
    const currency = data.currency;
    const amount = data.amount / 100;

    if (!userId) return;

    // Activate user
    await sql`
      UPDATE users
      SET is_pro = true, plan = ${plan}, updated_at = NOW()
      WHERE id = ${userId}
    `;

    // Insert license (device_fingerprint bound on first login)
    await sql`
      INSERT INTO licenses (
        user_id, plan, currency, amount, paystack_reference,
        status, expires_at, device_fingerprint
      )
      VALUES (
        ${userId}, ${plan}, ${currency}, ${amount}, ${reference},
        'active',
        ${plan === 'monthly' ? sql`NOW() + INTERVAL '30 days'` : null},
        ''
      )
      ON CONFLICT (paystack_reference) DO NOTHING
    `;

    // Update payment record
    await sql`
      UPDATE payments
      SET status = 'success', paystack_event = 'charge.success', updated_at = NOW()
      WHERE paystack_reference = ${reference}
    `;
  }

  private async deactivateLicense(data: any) {
    const sql = getDB();
    const reference = data.subscription_code || data.reference;

    await sql`
      UPDATE licenses
      SET status = 'cancelled'
      WHERE paystack_reference = ${reference}
    `;

    // Check if user still has another active license
    const [active] = await sql`
      SELECT id FROM licenses
      WHERE user_id = (
        SELECT user_id FROM licenses WHERE paystack_reference = ${reference} LIMIT 1
      )
      AND status = 'active'
      LIMIT 1
    `;

    if (!active) {
      await sql`
        UPDATE users
        SET is_pro = false
        WHERE id = (
          SELECT user_id FROM licenses WHERE paystack_reference = ${reference} LIMIT 1
        )
      `;
    }
  }
}
```

---

## Electron In-App Payment UI

```tsx
// PaywallModal.tsx
function PaywallModal({ onClose }: { onClose: () => void }) {
  const [currency, setCurrency] = useState<'NGN' | 'USD'>('NGN');
  const [loading, setLoading] = useState(false);

  async function handleUpgrade(plan: 'monthly' | 'lifetime') {
    setLoading(true);
    try {
      const token = await window.zoomguru.store.get('access_token');
      const res = await fetch(`${API_URL}/paystack/initialize`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan, currency }),
      });

      const { authorizationUrl } = await res.json();

      // Open in system browser
      await window.zoomguru.openExternal(authorizationUrl);

      // Poll for license activation
      pollLicenseActivation();
    } finally {
      setLoading(false);
    }
  }

  function pollLicenseActivation() {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      const verified = await checkLicense();
      if (verified || attempts >= 20) {
        clearInterval(interval);
        if (verified) onClose();
      }
    }, 3000);
  }

  return (
    <div className="paywall">
      {/* Currency toggle + plan cards */}
      {/* Plan buttons call handleUpgrade('monthly') or handleUpgrade('lifetime') */}
    </div>
  );
}
```

---

## Landing Page Paystack Inline

```html
<!-- Add to landing page head -->
<script src="https://js.paystack.co/v2/inline.js"></script>

<script>
function payWithPaystack(plan, currency) {
  const amounts = {
    NGN: { monthly: 1500000, lifetime: 10000000 },
    USD: { monthly: 1200, lifetime: 7900 }
  };

  const popup = new PaystackPop();
  popup.newTransaction({
    key: 'pk_live_xxxx',
    email: userEmail,
    amount: amounts[currency][plan],
    currency: currency,
    metadata: {
      user_id: userId,
      plan: plan
    },
    onSuccess: (transaction) => {
      window.location.href = `/download?ref=${transaction.reference}`;
    },
    onCancel: () => {
      console.log('Payment cancelled');
    }
  });
}
</script>
```
