// Surgical unit tests for referral + payout business rules
// No DB — pure logic from referral.service.ts and admin.service.ts

function validatePayoutRequest(
  pendingBalance: number,
  requestedAmount: number,
  currency: string
): { valid: boolean; reason?: string } {
  if (requestedAmount < 1000) {
    return { valid: false, reason: 'Minimum payout is ₦1,000' };
  }
  if (pendingBalance < requestedAmount) {
    return { valid: false, reason: 'Insufficient balance for payout' };
  }
  return { valid: true };
}

function buildReferralLink(referralCode: string | null, baseUrl = 'https://zoomguru.com'): string | null {
  if (!referralCode) return null;
  return `${baseUrl}/?ref=${referralCode}`;
}

function calcCommission(paymentAmount: number, commissionRate = 0.1): number {
  return Math.round(paymentAmount * commissionRate);
}

function applyPayoutToBalance(balance: {
  total_earned: number;
  pending_balance: number;
  total_paid: number;
}, payoutAmount: number): { total_earned: number; pending_balance: number; total_paid: number } {
  return {
    total_earned: balance.total_earned,
    pending_balance: Math.max(0, balance.pending_balance - payoutAmount),
    total_paid: balance.total_paid + payoutAmount,
  };
}

function calcNetRevenue(grossRevenue: number, paystackFeePct = 0.015, commissions = 0): number {
  return grossRevenue * (1 - paystackFeePct) - commissions;
}

function calcARR(mrr: number): number {
  return mrr * 12;
}

function calcARPU(totalRevenue: number, payingUsers: number): number {
  if (payingUsers === 0) return 0;
  return Math.round(totalRevenue / payingUsers);
}

function calcConversionRate(signups: number, paid: number): number {
  if (signups === 0) return 0;
  return Math.round((paid / signups) * 1000) / 10; // 1 decimal %
}

// ── payout validation ─────────────────────────────────────────────────────────

describe('validatePayoutRequest', () => {
  it('accepts valid payout within balance', () => {
    expect(validatePayoutRequest(5000, 2000, 'NGN')).toEqual({ valid: true });
  });

  it('accepts payout of exactly ₦1,000', () => {
    expect(validatePayoutRequest(5000, 1000, 'NGN')).toEqual({ valid: true });
  });

  it('rejects payout below minimum', () => {
    const result = validatePayoutRequest(5000, 500, 'NGN');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('1,000');
  });

  it('rejects payout of ₦999', () => {
    expect(validatePayoutRequest(5000, 999, 'NGN').valid).toBe(false);
  });

  it('rejects when balance is insufficient', () => {
    const result = validatePayoutRequest(1000, 2000, 'NGN');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Insufficient');
  });

  it('rejects when balance is exactly 0 and amount > 0', () => {
    expect(validatePayoutRequest(0, 1000, 'NGN').valid).toBe(false);
  });

  it('accepts when balance exactly equals requested amount', () => {
    expect(validatePayoutRequest(2000, 2000, 'NGN')).toEqual({ valid: true });
  });

  it('rejects zero payout amount', () => {
    expect(validatePayoutRequest(5000, 0, 'NGN').valid).toBe(false);
  });
});

// ── referral link generation ──────────────────────────────────────────────────

describe('buildReferralLink', () => {
  it('builds correct referral URL', () => {
    expect(buildReferralLink('ABC12345')).toBe('https://zoomguru.com/?ref=ABC12345');
  });

  it('returns null for null referral code', () => {
    expect(buildReferralLink(null)).toBeNull();
  });

  it('uses custom base URL', () => {
    expect(buildReferralLink('CODE1', 'https://staging.zoomguru.com')).toBe(
      'https://staging.zoomguru.com/?ref=CODE1'
    );
  });
});

// ── commission calculation ────────────────────────────────────────────────────

describe('calcCommission', () => {
  it('calculates 10% commission on ₦15,000 monthly plan', () => {
    expect(calcCommission(15000)).toBe(1500);
  });

  it('calculates 10% commission on ₦100,000 lifetime plan', () => {
    expect(calcCommission(100000)).toBe(10000);
  });

  it('returns 0 for zero payment', () => {
    expect(calcCommission(0)).toBe(0);
  });

  it('rounds fractional commission', () => {
    expect(calcCommission(10001)).toBe(1000); // 10001 * 0.1 = 1000.1 → 1000
  });
});

// ── balance after payout ──────────────────────────────────────────────────────

describe('applyPayoutToBalance', () => {
  it('correctly deducts pending_balance and increments total_paid', () => {
    const before = { total_earned: 10000, pending_balance: 5000, total_paid: 2000 };
    const after = applyPayoutToBalance(before, 3000);
    expect(after.pending_balance).toBe(2000);
    expect(after.total_paid).toBe(5000);
    expect(after.total_earned).toBe(10000); // unchanged
  });

  it('does not let pending_balance go below zero', () => {
    const before = { total_earned: 5000, pending_balance: 1000, total_paid: 0 };
    const after = applyPayoutToBalance(before, 2000); // over-payout
    expect(after.pending_balance).toBe(0);
  });

  it('exact payout empties pending balance', () => {
    const before = { total_earned: 5000, pending_balance: 5000, total_paid: 0 };
    const after = applyPayoutToBalance(before, 5000);
    expect(after.pending_balance).toBe(0);
    expect(after.total_paid).toBe(5000);
  });
});

// ── revenue KPI calculations ──────────────────────────────────────────────────

describe('revenue KPIs', () => {
  it('calculates ARR as MRR × 12', () => {
    expect(calcARR(150000)).toBe(1800000);
  });

  it('ARR of 0 MRR is 0', () => {
    expect(calcARR(0)).toBe(0);
  });

  it('calculates net revenue after 1.5% Paystack fee', () => {
    const net = calcNetRevenue(100000, 0.015, 0);
    expect(net).toBeCloseTo(98500, 0);
  });

  it('deducts referral commissions from net revenue', () => {
    const net = calcNetRevenue(100000, 0.015, 5000);
    expect(net).toBeCloseTo(93500, 0);
  });

  it('calculates ARPU correctly', () => {
    expect(calcARPU(300000, 20)).toBe(15000);
  });

  it('ARPU is 0 when no paying users', () => {
    expect(calcARPU(0, 0)).toBe(0);
  });

  it('ARPU rounds to integer', () => {
    expect(calcARPU(100001, 3)).toBe(33334);
  });
});

// ── funnel conversion rate ────────────────────────────────────────────────────

describe('calcConversionRate', () => {
  it('calculates 50% conversion', () => {
    expect(calcConversionRate(100, 50)).toBe(50);
  });

  it('returns 0 for zero signups', () => {
    expect(calcConversionRate(0, 0)).toBe(0);
  });

  it('rounds to 1 decimal', () => {
    expect(calcConversionRate(3, 1)).toBe(33.3);
  });

  it('100% conversion', () => {
    expect(calcConversionRate(10, 10)).toBe(100);
  });

  it('handles very low conversion rate', () => {
    expect(calcConversionRate(1000, 1)).toBe(0.1);
  });
});
