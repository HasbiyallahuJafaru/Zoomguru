// Pure logic tests for license expiry and payout validation
// No DB calls — tests the business rules in isolation

function isLicenseExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return false; // lifetime — never expires
  return expiresAt < new Date();
}

function calcExpiresAt(plan: 'monthly' | 'lifetime'): Date | null {
  if (plan === 'lifetime') return null;
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d;
}

function isPayoutValid(pendingBalance: number, requestedAmount: number): { valid: boolean; reason?: string } {
  if (requestedAmount < 1000) return { valid: false, reason: 'Minimum payout is ₦1,000' };
  if (pendingBalance < requestedAmount) return { valid: false, reason: 'Insufficient balance for payout' };
  return { valid: true };
}

describe('License Expiry Logic', () => {
  it('lifetime plan (null expires_at) is never expired', () => {
    expect(isLicenseExpired(null)).toBe(false);
  });

  it('monthly plan with future date is not expired', () => {
    const future = new Date();
    future.setDate(future.getDate() + 15);
    expect(isLicenseExpired(future)).toBe(false);
  });

  it('monthly plan with past date is expired', () => {
    const past = new Date();
    past.setDate(past.getDate() - 1);
    expect(isLicenseExpired(past)).toBe(true);
  });

  it('monthly plan expiring right now (same ms) is expired', () => {
    const justExpired = new Date(Date.now() - 1);
    expect(isLicenseExpired(justExpired)).toBe(true);
  });

  it('calcExpiresAt returns null for lifetime', () => {
    expect(calcExpiresAt('lifetime')).toBeNull();
  });

  it('calcExpiresAt returns ~30 days from now for monthly', () => {
    const result = calcExpiresAt('monthly');
    expect(result).not.toBeNull();
    const diffDays = Math.round((result!.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(30);
  });
});

describe('Payout Validation', () => {
  it('rejects payout below ₦1,000 minimum', () => {
    const result = isPayoutValid(5000, 500);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/minimum/i);
  });

  it('rejects payout when balance is insufficient', () => {
    const result = isPayoutValid(2000, 5000);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/insufficient/i);
  });

  it('accepts payout exactly equal to balance', () => {
    const result = isPayoutValid(3000, 3000);
    expect(result.valid).toBe(true);
  });

  it('accepts payout when balance exceeds request', () => {
    const result = isPayoutValid(10000, 3000);
    expect(result.valid).toBe(true);
  });

  it('rejects exactly ₦999 (below minimum)', () => {
    const result = isPayoutValid(5000, 999);
    expect(result.valid).toBe(false);
  });

  it('accepts exactly ₦1,000 (minimum threshold)', () => {
    const result = isPayoutValid(5000, 1000);
    expect(result.valid).toBe(true);
  });
});

describe('Free Tier Usage Limits', () => {
  function checkUsage(isPro: boolean, responsesUsed: number): { allowed: boolean; reason?: string } {
    if (isPro) return { allowed: true };
    if (responsesUsed >= 10) return { allowed: false, reason: 'Free tier limit reached. Upgrade to continue.' };
    return { allowed: true };
  }

  it('pro user is always allowed regardless of usage', () => {
    expect(checkUsage(true, 999).allowed).toBe(true);
  });

  it('free user with 9 responses is still allowed', () => {
    expect(checkUsage(false, 9).allowed).toBe(true);
  });

  it('free user with exactly 10 responses is blocked', () => {
    const result = checkUsage(false, 10);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/upgrade/i);
  });

  it('free user with 0 responses is allowed', () => {
    expect(checkUsage(false, 0).allowed).toBe(true);
  });
});
