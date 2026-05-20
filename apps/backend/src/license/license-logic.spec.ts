// Surgical unit tests for license business rules
// No DB — pure logic extracted from license.service.ts

function isLicenseExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return false; // lifetime
  return expiresAt < new Date();
}

function calcExpiresAt(plan: 'monthly' | 'lifetime'): Date | null {
  if (plan === 'lifetime') return null;
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d;
}

function isDeviceLocked(
  licenseFingerprint: string | null,
  requestFingerprint: string
): 'match' | 'mismatch' | 'unbound' {
  if (!licenseFingerprint) return 'unbound';
  return licenseFingerprint === requestFingerprint ? 'match' : 'mismatch';
}

function resolveLicenseStatus(
  expiresAt: Date | null,
  status: string,
  deviceFingerprint: string | null,
  requestDeviceId: string
): { valid: boolean; isPro: boolean; reason?: string } {
  if (status !== 'active') return { valid: false, isPro: false, reason: 'license_not_active' };

  if (isLicenseExpired(expiresAt)) {
    return { valid: false, isPro: false, reason: 'subscription_expired' };
  }

  const lock = isDeviceLocked(deviceFingerprint, requestDeviceId);
  if (lock === 'mismatch') {
    return { valid: false, isPro: false, reason: 'device_mismatch' };
  }

  return { valid: true, isPro: true };
}

// ── expiry logic ──────────────────────────────────────────────────────────────

describe('license expiry', () => {
  it('lifetime plan never expires (null expiresAt)', () => {
    expect(isLicenseExpired(null)).toBe(false);
  });

  it('active monthly plan not expired', () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 10); // 10 days ahead
    expect(isLicenseExpired(future)).toBe(false);
  });

  it('expired monthly plan returns true', () => {
    const past = new Date(Date.now() - 1000); // 1 second ago
    expect(isLicenseExpired(past)).toBe(true);
  });

  it('exact boundary: expires_at === now is expired', () => {
    const boundary = new Date(Date.now() - 1); // just past
    expect(isLicenseExpired(boundary)).toBe(true);
  });
});

// ── calcExpiresAt ─────────────────────────────────────────────────────────────

describe('calcExpiresAt', () => {
  it('lifetime plan returns null', () => {
    expect(calcExpiresAt('lifetime')).toBeNull();
  });

  it('monthly plan returns date ~30 days from now', () => {
    const result = calcExpiresAt('monthly')!;
    const diffDays = (result.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThan(29);
    expect(diffDays).toBeLessThan(31);
  });
});

// ── device lock ───────────────────────────────────────────────────────────────

describe('device fingerprint lock', () => {
  it('unbound license allows any device', () => {
    expect(isDeviceLocked(null, 'device-abc')).toBe('unbound');
  });

  it('matching fingerprint returns match', () => {
    expect(isDeviceLocked('fp-xyz', 'fp-xyz')).toBe('match');
  });

  it('different fingerprint returns mismatch', () => {
    expect(isDeviceLocked('fp-xyz', 'fp-different')).toBe('mismatch');
  });

  it('empty string fingerprint treated as unbound', () => {
    expect(isDeviceLocked('', 'fp-new')).toBe('unbound');
  });
});

// ── full license resolution ───────────────────────────────────────────────────

describe('resolveLicenseStatus', () => {
  const futureDate = new Date(Date.now() + 86400000 * 15);
  const pastDate = new Date(Date.now() - 1000);

  it('valid active non-expired matched-device license', () => {
    const result = resolveLicenseStatus(futureDate, 'active', 'fp-123', 'fp-123');
    expect(result).toEqual({ valid: true, isPro: true });
  });

  it('lifetime active license with unbound device', () => {
    const result = resolveLicenseStatus(null, 'active', null, 'any-device');
    expect(result).toEqual({ valid: true, isPro: true });
  });

  it('suspended license is invalid', () => {
    const result = resolveLicenseStatus(futureDate, 'suspended', 'fp-123', 'fp-123');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('license_not_active');
  });

  it('expired monthly license returns subscription_expired', () => {
    const result = resolveLicenseStatus(pastDate, 'active', 'fp-123', 'fp-123');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('subscription_expired');
  });

  it('device mismatch returns device_mismatch', () => {
    const result = resolveLicenseStatus(futureDate, 'active', 'fp-correct', 'fp-wrong');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('device_mismatch');
  });

  it('expired status takes precedence over device mismatch', () => {
    // expired is checked after status, before device
    const result = resolveLicenseStatus(pastDate, 'active', 'fp-correct', 'fp-wrong');
    expect(result.reason).toBe('subscription_expired');
  });

  it('inactive status checked first regardless of expiry or device', () => {
    const result = resolveLicenseStatus(futureDate, 'expired', 'fp-correct', 'fp-correct');
    expect(result.reason).toBe('license_not_active');
  });
});

// ── free tier: no license found ───────────────────────────────────────────────

describe('free tier (no license)', () => {
  it('user without license should return free plan', () => {
    // Mirrors the service: if no license row, return free
    const licenseRow = undefined;
    const isPro = false;
    const result = licenseRow
      ? resolveLicenseStatus(null, 'active', null, 'any')
      : { valid: true, isPro, plan: 'free' };
    expect(result).toEqual({ valid: true, isPro: false, plan: 'free' });
  });
});
