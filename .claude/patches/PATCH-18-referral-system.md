# PATCH-18 â€” Referral System (DB + Backend + Electron UI + Landing)

## Problem
No referral system. Users who spread the word get nothing.
Missing a viral growth mechanism.

## Rule
25% commission on every paid referral.
Minimum payout: â‚¦5,000 / $5.
Manual payout via bank transfer (automated later).

## Files Affected
- `apps/backend/src/database/init.ts`
- `apps/backend/src/referral/` (new module)
- `apps/backend/src/auth/auth.service.ts`
- `apps/backend/src/paystack/paystack.service.ts`
- `apps/backend/src/app.module.ts`
- `apps/electron/src/overlay/ReferralDashboard.tsx` (new)
- `apps/landing/app/page.tsx` (referral capture)

## Risk Level
ðŸŸ¡ MEDIUM â€” New module, small changes to existing files.

---

## Claude Code Prompt â€” PART A: Database

```
Read .claude/DATABASE.md first.

In apps/backend/src/database/init.ts, add these three
CREATE TABLE statements at the end of initDB(),
BEFORE the console.log line:

  await sql`
    CREATE TABLE IF NOT EXISTS referrals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      referrer_id UUID NOT NULL REFERENCES users(id),
      referred_id UUID UNIQUE NOT NULL REFERENCES users(id),
      payment_id UUID,
      commission_amount NUMERIC DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'NGN',
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS referral_balances (
      user_id UUID PRIMARY KEY REFERENCES users(id),
      total_earned NUMERIC DEFAULT 0,
      total_paid NUMERIC DEFAULT 0,
      pending_balance NUMERIC DEFAULT 0,
      currency TEXT DEFAULT 'NGN',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS payout_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id),
      amount NUMERIC NOT NULL,
      currency TEXT NOT NULL,
      bank_name TEXT,
      account_number TEXT,
      account_name TEXT,
      status TEXT DEFAULT 'pending',
      requested_at TIMESTAMPTZ DEFAULT NOW(),
      processed_at TIMESTAMPTZ
    )
  `;

Also add referral_code column to the users table
CREATE TABLE statement:
  referral_code TEXT UNIQUE,

Add this index:
  await sql`CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_referrals_code ON users(referral_code)`;

Show me exactly what you added.
```

---

## Claude Code Prompt â€” PART B: Auth (Generate Referral Code on Register)

```
Read .claude/AUTH.md first.

In apps/backend/src/auth/auth.service.ts,
find the register() method.

STEP 1: Add nanoid import at the top of the file:
import { nanoid } from 'nanoid';

Install it first: cd apps/backend && npm install nanoid

STEP 2: In the register() method, find the INSERT INTO users
statement. Add referral_code to the insert:

  const referralCode = nanoid(8).toUpperCase();

  const [user] = await sql`
    INSERT INTO users (email, password_hash, name, device_fingerprint_trial, referral_code)
    VALUES (${email.toLowerCase()}, ${passwordHash}, ${name}, 
            ${deviceId || null}, ${referralCode})
    RETURNING id, email, name, is_pro, referral_code
  `;

STEP 3: After the user insert, initialize their referral balance:
  await sql`
    INSERT INTO referral_balances (user_id, currency)
    VALUES (${user.id}, 'NGN')
    ON CONFLICT DO NOTHING
  `;

STEP 4: Check if this user was referred by someone.
The referral code of the referrer is passed in the request body.
Add refCode as a parameter to register():
  async register(email, password, name, deviceId, refCode?)

After creating the user, if refCode exists:
  if (refCode) {
    const [referrer] = await sql`
      SELECT id FROM users WHERE referral_code = ${refCode} LIMIT 1
    `;
    if (referrer && referrer.id !== user.id) {
      await sql`
        INSERT INTO referrals (referrer_id, referred_id, currency)
        VALUES (${referrer.id}, ${user.id}, 'NGN')
        ON CONFLICT (referred_id) DO NOTHING
      `;
    }
  }

STEP 5: Update the auth controller register endpoint to
pass refCode from request body to register().

Do not change login, refresh, or any other methods.
Show me the full diff of auth.service.ts changes.
```

---

## Claude Code Prompt â€” PART C: Paystack Commission Trigger

```
Read .claude/PAYMENTS.md first.

In apps/backend/src/paystack/paystack.service.ts,
find the activateLicense() private method.

At the END of activateLicense(), AFTER all existing logic,
add this commission processing block:

  // Process referral commission if applicable
  await this.processReferralCommission(userId, amount, currency);

Then add this new private method to the class:

  private async processReferralCommission(
    referredUserId: string,
    amount: number,
    currency: string,
  ): Promise<void> {
    const sql = getDB();

    const [referral] = await sql`
      SELECT id, referrer_id FROM referrals
      WHERE referred_id = ${referredUserId}
      AND status = 'pending'
      LIMIT 1
    `;

    if (!referral) return;

    const commission = parseFloat((amount * 0.25).toFixed(2));

    await sql`
      UPDATE referrals
      SET commission_amount = ${commission},
          currency = ${currency},
          status = 'earned'
      WHERE id = ${referral.id}
    `;

    await sql`
      INSERT INTO referral_balances (user_id, total_earned, pending_balance, currency)
      VALUES (${referral.referrer_id}, ${commission}, ${commission}, ${currency})
      ON CONFLICT (user_id) DO UPDATE SET
        total_earned = referral_balances.total_earned + ${commission},
        pending_balance = referral_balances.pending_balance + ${commission},
        updated_at = NOW()
    `;
  }

Do not change signature verification, event routing,
or any other existing methods.
Show me only what changed.
```

---

## Claude Code Prompt â€” PART D: Referral Endpoints

```
Create a new NestJS module at apps/backend/src/referral/.

Create three files:

FILE 1: referral.service.ts

import { Injectable, BadRequestException } from '@nestjs/common';
import { getDB } from '../database/db';

@Injectable()
export class ReferralService {

  async getMyReferralData(userId: string) {
    const sql = getDB();

    const [user] = await sql`
      SELECT referral_code FROM users WHERE id = ${userId}
    `;

    const [balance] = await sql`
      SELECT total_earned, total_paid, pending_balance, currency
      FROM referral_balances
      WHERE user_id = ${userId}
    `;

    const referrals = await sql`
      SELECT r.status, r.commission_amount, r.currency, r.created_at,
             u.email as referred_email
      FROM referrals r
      JOIN users u ON u.id = r.referred_id
      WHERE r.referrer_id = ${userId}
      ORDER BY r.created_at DESC
    `;

    return {
      referralCode: user.referral_code,
      referralLink: 'https://zoomguru.xyz?ref=' + user.referral_code,
      balance: balance || { totalEarned: 0, totalPaid: 0, pendingBalance: 0 },
      referrals,
      totalReferred: referrals.length,
      totalConverted: referrals.filter((r: any) => r.status === 'earned').length,
    };
  }

  async requestPayout(userId: string, data: {
    amount: number;
    currency: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
  }) {
    const sql = getDB();

    const [balance] = await sql`
      SELECT pending_balance, currency FROM referral_balances
      WHERE user_id = ${userId}
    `;

    const minPayout = data.currency === 'NGN' ? 5000 : 5;

    if (!balance || balance.pending_balance < minPayout) {
      throw new BadRequestException(
        `Minimum payout is ${data.currency === 'NGN' ? 'â‚¦5,000' : '$5'}. ` +
        `Your balance is ${balance?.pending_balance || 0}.`
      );
    }

    if (data.amount > balance.pending_balance) {
      throw new BadRequestException('Amount exceeds available balance');
    }

    const [request] = await sql`
      INSERT INTO payout_requests
        (user_id, amount, currency, bank_name, account_number, account_name)
      VALUES
        (${userId}, ${data.amount}, ${data.currency},
         ${data.bankName}, ${data.accountNumber}, ${data.accountName})
      RETURNING id, requested_at
    `;

    return {
      success: true,
      requestId: request.id,
      message: 'Payout request submitted. Processing within 48 hours.',
    };
  }
}

FILE 2: referral.controller.ts

import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReferralService } from './referral.service';

@Controller('referral')
@UseGuards(JwtAuthGuard)
export class ReferralController {
  constructor(private readonly referralService: ReferralService) {}

  @Get('me')
  getMyReferralData(@Request() req: any) {
    return this.referralService.getMyReferralData(req.user.userId);
  }

  @Post('payout')
  requestPayout(@Request() req: any, @Body() body: {
    amount: number;
    currency: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
  }) {
    return this.referralService.requestPayout(req.user.userId, body);
  }
}

FILE 3: referral.module.ts

import { Module } from '@nestjs/common';
import { ReferralController } from './referral.controller';
import { ReferralService } from './referral.service';

@Module({
  controllers: [ReferralController],
  providers: [ReferralService],
})
export class ReferralModule {}

Then add ReferralModule to app.module.ts imports.
Show me all created files and the app.module.ts change.
```

---

## Claude Code Prompt â€” PART E: Landing Page Referral Capture

```
Read .claude/LANDING.md first.

In apps/landing/app/page.tsx or the root layout,
add this referral code capture script.

If there is a useEffect in the page component, add inside it.
If not, add a new useEffect:

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref && ref.length === 8) {
      localStorage.setItem('zg_ref', ref);
      // 30-day cookie as backup
      document.cookie = 
        'zg_ref=' + ref + '; max-age=' + (30 * 24 * 60 * 60) + '; path=/; SameSite=Lax';
    }
  }, []);

Then in the Pricing.tsx component, where Paystack is initialized,
pass the referral code in metadata:

  metadata: {
    user_id: userId,
    plan: plan,
    ref_code: localStorage.getItem('zg_ref') || null,
  }

Also pass ref_code in the /auth/register POST body
when user registers after payment:
  { email, password, name, deviceId, refCode: localStorage.getItem('zg_ref') }

Do not change any other landing page logic.
```

---

## Verification

```bash
# 1. Register user A â†’ gets referral code e.g. "ABC123XY"
# 2. Share link: zoomguru.xyz?ref=ABC123XY
# 3. User B visits link â†’ localStorage stores ref code
# 4. User B registers â†’ referrals table gets a record
# 5. User B pays â†’ commission 25% credited to user A
# 6. GET /referral/me as user A â†’ shows earned commission
# 7. POST /referral/payout â†’ payout request created
# 8. Check admin stats â†’ referrals section shows data
```

