// Plans, and the competitor prices the comparison table is built from.
//
// Seats are concurrent computers, not people: an account can be installed
// anywhere, but only this many sessions can be signed in at once. The backend
// decides this in seatsForPlan() — apps/backend/src/auth/sessions.ts. Weekly is
// one seat, monthly and yearly are two. Keep the two in step.

export type PlanId = 'weekly' | 'monthly' | 'yearly';

export interface Plan {
  id: PlanId;
  name: string;
  /** Naira, per period. Paystack holds the real charge — this is display only. */
  price: number;
  period: string;
  /** Concurrent computers. Must match seatsForPlan() in the backend. */
  seats: number;
  /** Why someone picks this one. Sits under the price. */
  fit: string;
  featured?: boolean;
  /** Shown only where it is true, never as an empty row. */
  note?: string;
}

export const PLANS: Plan[] = [
  {
    id: 'weekly',
    name: 'Weekly',
    price: 15_000,
    period: 'week',
    seats: 1,
    fit: 'You have interviews this week and want it over with.',
  },
  {
    id: 'monthly',
    name: 'Monthly',
    price: 45_000,
    period: 'month',
    seats: 2,
    fit: 'A real search, running over several rounds and a few companies.',
    featured: true,
    note: 'Three weekly plans cost more than this one.',
  },
  {
    id: 'yearly',
    name: 'Yearly',
    price: 450_000,
    period: 'year',
    seats: 2,
    fit: 'You would rather not think about this again for a while.',
    note: 'Ten months, priced for twelve.',
  },
];

/** Everything in every plan. Listing it per-card would only repeat it. */
export const INCLUDED = [
  'Unlimited questions and answers',
  'Live copilot and hands-free auto mode',
  'Screenshot answers for shared screens',
  'Hidden from Zoom, Meet and Teams screen share',
  'Your CV and the job description in every answer',
  'Nothing kept after the session ends',
];

// ---------------------------------------------------------------------------
// Competitor comparison
//
// These are list prices read from each vendor's own pricing page on the date
// below. Both geo-localise and run promotions, so treat this as a snapshot and
// re-check it before quoting the difference anywhere else.
// ---------------------------------------------------------------------------

/** Re-read the competitor pages when you change this. */
export const PRICES_CHECKED = '27 August 2026';

/** Only used to put our naira price and their dollar prices on one axis. */
export const NGN_PER_USD = 1550;

export interface Competitor {
  name: string;
  usdPerMonth: number;
  plan: string;
  source: string;
}

export const COMPETITORS: Competitor[] = [
  {
    name: 'Parakeet AI',
    usdPerMonth: 74.9,
    plan: 'Unlimited, monthly',
    source: 'https://www.saasworthy.com/product/parakeet-ai/pricing',
  },
  {
    name: 'LockedIn AI',
    usdPerMonth: 54.99,
    plan: 'Unlimited, monthly',
    source: 'https://www.finalroundai.com/blog/lockedin-ai-pricing',
  },
];

export const MONTHLY = PLANS.find((p) => p.id === 'monthly')!;

/** Our monthly plan in dollars, for the comparison table only. */
export const monthlyUsd = Math.round(MONTHLY.price / NGN_PER_USD);

/** e.g. 61 — "61% less than Parakeet AI". Rounded down, so it under-claims. */
export function percentCheaperThan(c: Competitor): number {
  return Math.floor(((c.usdPerMonth - monthlyUsd) / c.usdPerMonth) * 100);
}

/** e.g. "2.6" — what they cost expressed in ZoomGuru monthlies. */
export function timesOurPrice(c: Competitor): string {
  return (c.usdPerMonth / monthlyUsd).toFixed(1);
}

export function formatNaira(amount: number): string {
  return `\u20A6${amount.toLocaleString('en-NG')}`;
}
