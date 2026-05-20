// Surgical unit tests for AdminGuard and DeviceGuard decision logic
// Tests the pure branching logic without ExecutionContext or DB

// ── AdminGuard logic ──────────────────────────────────────────────────────────

function adminGuardDecision(
  userId: string | undefined,
  userRole: string | undefined
): { allow: boolean; reason?: string } {
  if (!userId) return { allow: false, reason: 'not_authenticated' };
  if (!userRole || userRole !== 'admin') return { allow: false, reason: 'not_admin' };
  return { allow: true };
}

describe('AdminGuard decision logic', () => {
  it('allows admin user', () => {
    expect(adminGuardDecision('uuid-1', 'admin')).toEqual({ allow: true });
  });

  it('rejects non-admin user', () => {
    const result = adminGuardDecision('uuid-1', 'user');
    expect(result.allow).toBe(false);
    expect(result.reason).toBe('not_admin');
  });

  it('rejects when userId is missing', () => {
    const result = adminGuardDecision(undefined, 'admin');
    expect(result.allow).toBe(false);
    expect(result.reason).toBe('not_authenticated');
  });

  it('rejects when role is undefined', () => {
    const result = adminGuardDecision('uuid-1', undefined);
    expect(result.allow).toBe(false);
  });

  it('rejects empty string role', () => {
    const result = adminGuardDecision('uuid-1', '');
    expect(result.allow).toBe(false);
  });

  it('is case-sensitive — "Admin" is not "admin"', () => {
    const result = adminGuardDecision('uuid-1', 'Admin');
    expect(result.allow).toBe(false);
  });
});

// ── DeviceGuard logic ─────────────────────────────────────────────────────────

function deviceGuardDecision(
  deviceId: string | undefined,
  userId: string | undefined,
  licenseFingerprint: string | null | undefined
): { allow: boolean; reason?: string } {
  if (!deviceId || !userId) return { allow: false, reason: 'missing_device_or_user' };

  // No license → free tier, allow
  if (licenseFingerprint === null || licenseFingerprint === undefined) {
    return { allow: true };
  }

  // Empty fingerprint → unbound, allow
  if (licenseFingerprint === '') return { allow: true };

  // Fingerprint set — must match
  if (licenseFingerprint !== deviceId) return { allow: false, reason: 'device_mismatch' };

  return { allow: true };
}

describe('DeviceGuard decision logic', () => {
  it('allows when no license (free tier)', () => {
    expect(deviceGuardDecision('device-abc', 'uuid-1', null)).toEqual({ allow: true });
  });

  it('allows on first bind (empty fingerprint)', () => {
    expect(deviceGuardDecision('device-abc', 'uuid-1', '')).toEqual({ allow: true });
  });

  it('allows when fingerprint matches device', () => {
    expect(deviceGuardDecision('device-abc', 'uuid-1', 'device-abc')).toEqual({ allow: true });
  });

  it('rejects when fingerprint does not match', () => {
    const result = deviceGuardDecision('device-abc', 'uuid-1', 'device-xyz');
    expect(result.allow).toBe(false);
    expect(result.reason).toBe('device_mismatch');
  });

  it('rejects when device ID is missing', () => {
    const result = deviceGuardDecision(undefined, 'uuid-1', null);
    expect(result.allow).toBe(false);
    expect(result.reason).toBe('missing_device_or_user');
  });

  it('rejects when user ID is missing', () => {
    const result = deviceGuardDecision('device-abc', undefined, null);
    expect(result.allow).toBe(false);
  });

  it('rejects when both are missing', () => {
    const result = deviceGuardDecision(undefined, undefined, null);
    expect(result.allow).toBe(false);
  });
});

// ── multi-account detection logic ─────────────────────────────────────────────

function canRegisterOnDevice(
  existingAccountOnDevice: { id: string; is_pro: boolean } | undefined
): { allowed: boolean; reason?: string } {
  if (!existingAccountOnDevice) return { allowed: true };
  if (existingAccountOnDevice.is_pro) return { allowed: true };  // pro users can have multiple
  return { allowed: false, reason: 'free_trial_already_used_on_device' };
}

describe('multi-account device detection', () => {
  it('allows registration when no existing account on device', () => {
    expect(canRegisterOnDevice(undefined)).toEqual({ allowed: true });
  });

  it('allows when existing account is pro (paid)', () => {
    expect(canRegisterOnDevice({ id: 'uuid-1', is_pro: true })).toEqual({ allowed: true });
  });

  it('blocks when existing free trial account found on device', () => {
    const result = canRegisterOnDevice({ id: 'uuid-1', is_pro: false });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('free_trial_already_used_on_device');
  });
});

// ── admin key header guard ────────────────────────────────────────────────────

function checkAdminSecretKey(
  providedKey: string | undefined,
  expectedKey: string
): boolean {
  if (!providedKey) return false;
  return providedKey === expectedKey;
}

describe('admin secret key validation', () => {
  const SECRET = 'super-secret-admin-key-abc123';

  it('accepts correct key', () => {
    expect(checkAdminSecretKey(SECRET, SECRET)).toBe(true);
  });

  it('rejects wrong key', () => {
    expect(checkAdminSecretKey('wrong-key', SECRET)).toBe(false);
  });

  it('rejects missing key', () => {
    expect(checkAdminSecretKey(undefined, SECRET)).toBe(false);
  });

  it('is exact-match (no prefix/suffix)', () => {
    expect(checkAdminSecretKey(SECRET + '-extra', SECRET)).toBe(false);
  });
});
