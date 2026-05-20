# AUTH-08 — Subscription Page

## Prompt

```
Read .claude/patches/auth-dashboard/AUTH-DASHBOARD.md first.

Create apps/landing/app/dashboard/subscription/page.tsx

This page shows the user's current subscription and allows
upgrade or management. Dark theme, matches dashboard layout.

Sections:

SECTION 1 — Current Plan Card:
  Large card showing:
    Plan name: Free / Pro Monthly / Pro Lifetime
    Status: Active / Expired / Cancelled
    If monthly: Next billing date, amount
    If lifetime: "Never expires"
    If free: Sessions used (X of 3), Responses (X of 10)
    Device locked to: [fingerprint last 8 chars]

SECTION 2 — Upgrade Options (if not lifetime):
  Two plan cards side by side:
  ┌─────────────────┬──────────────────┐
  │ Monthly         │ Lifetime ★       │
  │ ₦15,000/mo     │ ₦100,000         │
  │ $12/mo          │ $79              │
  │ [Upgrade]       │ [Get Lifetime]   │
  └─────────────────┴──────────────────┘
  Currency toggle: NGN / USD
  Clicking upgrade opens Paystack inline payment
  After payment: page auto-refreshes subscription status

SECTION 3 — Plan Features comparison table:
  Feature | Free | Pro
  Sessions | 3 total | Unlimited
  Responses | 10/session | Unlimited
  Screenshot mode | ✗ | ✓
  Wake word | ✗ | ✓
  Session history | ✗ | ✓
  Priority support | ✗ | ✓

Data from: GET ${API_URL}/user/subscription (add to backend)
Payment via: Paystack inline (same as landing page Pricing.tsx)

Add to backend:
  GET /user/subscription → returns plan, status, expiresAt,
    deviceFingerprint (last 8 chars), usageStats
  These come from users + licenses + user_usage tables.

Show me the page file and backend endpoint additions.
```

---

# AUTH-09 — Payments History Page

## Prompt

```
Create apps/landing/app/dashboard/payments/page.tsx

Dark theme. Shows complete payment history.

Layout:
  Page title: "Payment History"
  Subtitle: Total spent, total transactions

  Filters row:
    Search by reference number
    Filter: All / NGN / USD
    Filter: All / Monthly / Lifetime

  Payments table:
    Columns:
      Date
      Plan (Monthly / Lifetime badge)
      Amount (₦15,000 or $12)
      Currency
      Reference (truncated, copyable)
      Status (Success green / Pending amber / Failed red)

  Pagination: 20 per page

  Empty state: "No payments yet. Upgrade to get started."

Data from:
  GET ${API_URL}/user/payments?page=1&limit=20
  Returns: payments array, total count, total spent in NGN + USD

Add to backend (auth.controller.ts or new user.controller.ts):
  @Get('user/payments')
  @UseGuards(JwtAuthGuard)
  async getPayments(
    @Request() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) → queries payments table WHERE user_id = userId

Show me the page and backend endpoint.
```

---

# AUTH-10 — Sessions Page

## Prompt

```
Create apps/landing/app/dashboard/sessions/page.tsx

Dark theme. Shows interview session history.

Layout:
  Page title: "Interview Sessions"
  Stats row: Total sessions | Avg duration | Avg questions | Best streak

  Session cards (vertical list):
    Each card shows:
      Interview type badge (Behavioral / Technical / Coding / System Design)
      Date + time
      Duration (e.g. "42 minutes")
      Questions answered: X
      AI-generated summary (2-3 sentences, truncated)
      [View Summary] button → expands full summary inline

  Filter: All / Behavioral / Technical / Coding / System Design
  Sort: Newest first / Longest / Most questions

  Empty state with CTA to download and start first interview.

Data from:
  GET ${API_URL}/user/sessions?page=1&limit=20&type=all
  Returns: sessions array with summary, duration, type, etc.

Add backend endpoint:
  @Get('user/sessions')
  @UseGuards(JwtAuthGuard)
  async getSessions → queries interview_sessions WHERE user_id

Show me the page and endpoint.
```

---

# AUTH-11 — Referrals Page

## Prompt

```
Create apps/landing/app/dashboard/referrals/page.tsx

Dark theme. Full referral dashboard.

Layout:

SECTION 1 — Stats row (4 cards):
  Total referred | Converted to paid | Total earned | Pending payout

SECTION 2 — Referral link card:
  Large highlighted card:
    "Your referral link:"
    https://zoomguru.com?ref=ABC123XY    [Copy button]
    "Share this link. Earn 25% of every subscription."
    Share buttons: Twitter/X | WhatsApp | Copy

SECTION 3 — Earnings breakdown table:
  Columns: Date | Referred User (email masked) | Plan | Commission | Status
  Statuses: Pending (not yet paid) | Earned (payment confirmed) | Paid out

SECTION 4 — Payout Request:
  Available balance: ₦XX,XXX
  Minimum payout: ₦5,000
  Form (shown if balance >= 5000):
    Bank name input
    Account number input
    Account name input
    Amount input (max = pending balance)
    [Request Payout] button
  If balance < 5000: "Minimum payout is ₦5,000. Keep referring!"

  Payout history table:
    Date requested | Amount | Status | Date processed

Data from:
  GET ${API_URL}/referral/me (existing endpoint)
  POST ${API_URL}/referral/payout (existing endpoint)

No new backend endpoints needed.
Show me the page file.
```

---

# AUTH-12 — Settings Page

## Prompt

```
Create apps/landing/app/dashboard/settings/page.tsx

Dark theme. User profile management.

Layout (tabbed or sections):

SECTION 1 — Profile:
  Avatar (circle, shows Google avatar or initials fallback)
  Full name input
  Username input (shows if taken on blur)
  Email (read-only if Google OAuth user)
  [Save Profile] button

SECTION 2 — Security:
  Current password input
  New password input
  Confirm new password input
  [Change Password] button
  Hidden for Google OAuth users (show: "Signed in with Google")

SECTION 3 — Device:
  "Your app license is locked to:"
  Device fingerprint: xxxx...xxxx (last 8 chars)
  Platform: macOS / Windows
  Locked since: [date]
  Note: "To transfer your license to a new device,
         contact support@zoomguru.com"

SECTION 4 — Danger Zone:
  [Delete Account] button (red, confirmation modal)
  Text: "This permanently deletes all your data and
         cancels your subscription."

API calls:
  PATCH ${API_URL}/user/profile → updates name, username
  PATCH ${API_URL}/user/password → changes password
  DELETE ${API_URL}/user/account → deletes account

Add these endpoints to backend:
  @Patch('user/profile') @UseGuards(JwtAuthGuard)
    → UPDATE users SET name, username WHERE id = userId

  @Patch('user/password') @UseGuards(JwtAuthGuard)
    → Verify current password, hash new, UPDATE

  @Delete('user/account') @UseGuards(JwtAuthGuard)
    → Soft delete: set deleted_at, anonymize data

  @Get('user/device') @UseGuards(JwtAuthGuard)
    → Returns license device info for current user

Show me the page and all backend endpoint additions.
```
