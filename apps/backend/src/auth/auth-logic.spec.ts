// Surgical unit tests for auth business logic
// Tests pure functions extracted from auth.service.ts — no DB, no network

import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';

// ── helpers mirroring auth.service.ts logic ──────────────────────────────────

function sanitizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
}

function isUsernameValid(username: string): boolean {
  const clean = sanitizeUsername(username);
  return clean.length >= 3;
}

function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function buildAccessTokenPayload(user: {
  id: string; email: string; isPro: boolean; role: string; username: string;
}) {
  return {
    sub: user.id,
    email: user.email,
    isPro: user.isPro,
    role: user.role,
    username: user.username,
  };
}

function generateReferralCode(seed?: string): string {
  // nanoid-like: 8 uppercase alphanumeric chars
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function deriveUsernameFromEmail(email: string): string {
  return email
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 20);
}

function isPasswordStrong(password: string): boolean {
  return password.length >= 8;
}

const JWT_SECRET = 'test-jwt-secret';
const JWT_REFRESH_SECRET = 'test-refresh-secret';
const ELECTRON_OAUTH_SECRET = 'test-electron-secret';

function signAccessToken(payload: object, expiresIn: string = '15m'): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as jwt.SignOptions);
}

function verifyAccessToken(token: string): any {
  return jwt.verify(token, JWT_SECRET);
}

function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId, type: 'refresh' }, JWT_REFRESH_SECRET, { expiresIn: '30d' });
}

function verifyRefreshToken(token: string): any {
  return jwt.verify(token, JWT_REFRESH_SECRET);
}

function signElectronOAuthToken(userId: string): string {
  return jwt.sign({ sub: userId, type: 'electron_oauth' }, ELECTRON_OAUTH_SECRET, { expiresIn: '5m' });
}

function verifyElectronOAuthToken(token: string): any {
  const payload = jwt.verify(token, ELECTRON_OAUTH_SECRET) as any;
  if (payload.type !== 'electron_oauth') throw new Error('Invalid token type');
  return payload;
}

// ── username validation ───────────────────────────────────────────────────────

describe('username validation', () => {
  it('accepts valid lowercase username', () => {
    expect(isUsernameValid('jafaru')).toBe(true);
  });

  it('accepts username with numbers and underscore', () => {
    expect(isUsernameValid('user_42')).toBe(true);
  });

  it('rejects username under 3 chars after sanitization', () => {
    expect(isUsernameValid('ab')).toBe(false);
  });

  it('rejects username that is all special chars', () => {
    expect(isUsernameValid('!@#')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isUsernameValid('')).toBe(false);
  });

  it('strips spaces and uppercases on sanitize', () => {
    expect(sanitizeUsername('  JohnDoe  ')).toBe('johndoe');
  });

  it('strips hyphens and dots', () => {
    expect(sanitizeUsername('john.doe-99')).toBe('johndoe99');
  });

  it('preserves underscores', () => {
    expect(sanitizeUsername('john_doe')).toBe('john_doe');
  });

  it('accepts exactly 3 chars after sanitization', () => {
    expect(isUsernameValid('abc')).toBe(true);
  });

  it('trims leading/trailing whitespace before length check', () => {
    expect(isUsernameValid('  a  ')).toBe(false); // only 'a' after sanitize
  });
});

// ── password strength ─────────────────────────────────────────────────────────

describe('password strength', () => {
  it('accepts password of exactly 8 chars', () => {
    expect(isPasswordStrong('12345678')).toBe(true);
  });

  it('accepts long password', () => {
    expect(isPasswordStrong('correcthorsebatterystaple')).toBe(true);
  });

  it('rejects password under 8 chars', () => {
    expect(isPasswordStrong('short')).toBe(false);
  });

  it('rejects empty password', () => {
    expect(isPasswordStrong('')).toBe(false);
  });

  it('rejects 7-char password', () => {
    expect(isPasswordStrong('1234567')).toBe(false);
  });
});

// ── bcrypt hashing ────────────────────────────────────────────────────────────

describe('bcrypt password hashing', () => {
  it('hashes and verifies a password correctly', async () => {
    const password = 'SecurePass123';
    const hash = await bcrypt.hash(password, 12);
    const match = await bcrypt.compare(password, hash);
    expect(match).toBe(true);
  });

  it('rejects wrong password against hash', async () => {
    const hash = await bcrypt.hash('correct-password', 12);
    const match = await bcrypt.compare('wrong-password', hash);
    expect(match).toBe(false);
  });

  it('produces different hashes for same password (salt)', async () => {
    const hash1 = await bcrypt.hash('same', 10);
    const hash2 = await bcrypt.hash('same', 10);
    expect(hash1).not.toBe(hash2);
  });
});

// ── refresh token hashing ─────────────────────────────────────────────────────

describe('refresh token hashing', () => {
  it('produces consistent SHA-256 hash', () => {
    const token = 'my-refresh-token-abc';
    expect(hashRefreshToken(token)).toBe(hashRefreshToken(token));
  });

  it('produces different hashes for different tokens', () => {
    expect(hashRefreshToken('token-a')).not.toBe(hashRefreshToken('token-b'));
  });

  it('produces 64-char hex string', () => {
    const hash = hashRefreshToken('any-token');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });
});

// ── JWT access token ──────────────────────────────────────────────────────────

describe('JWT access token', () => {
  const user = { id: 'uuid-1', email: 'test@test.com', isPro: false, role: 'user', username: 'tester' };

  it('signs and verifies an access token', () => {
    const token = signAccessToken(buildAccessTokenPayload(user));
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe('uuid-1');
    expect(payload.email).toBe('test@test.com');
    expect(payload.isPro).toBe(false);
    expect(payload.role).toBe('user');
  });

  it('embeds all required fields in payload', () => {
    const payload = buildAccessTokenPayload(user);
    expect(payload).toMatchObject({ sub: 'uuid-1', email: 'test@test.com', isPro: false, role: 'user', username: 'tester' });
  });

  it('rejects token signed with wrong secret', () => {
    const token = jwt.sign({ sub: 'uuid-1' }, 'wrong-secret', { expiresIn: '15m' });
    expect(() => verifyAccessToken(token)).toThrow();
  });

  it('rejects expired token', () => {
    const token = signAccessToken({ sub: 'uuid-1' }, '-1s');
    expect(() => verifyAccessToken(token)).toThrow(/expired/);
  });

  it('access token expires in 15 minutes (not 30 days)', () => {
    const token = signAccessToken(buildAccessTokenPayload(user));
    const decoded = jwt.decode(token) as any;
    const diffSeconds = decoded.exp - decoded.iat;
    expect(diffSeconds).toBe(15 * 60);
  });
});

// ── JWT refresh token ─────────────────────────────────────────────────────────

describe('JWT refresh token', () => {
  it('signs and verifies a refresh token', () => {
    const token = signRefreshToken('uuid-99');
    const payload = verifyRefreshToken(token);
    expect(payload.sub).toBe('uuid-99');
    expect(payload.type).toBe('refresh');
  });

  it('refresh token expires in 30 days', () => {
    const token = signRefreshToken('uuid-1');
    const decoded = jwt.decode(token) as any;
    const diffDays = (decoded.exp - decoded.iat) / 86400;
    expect(diffDays).toBeCloseTo(30, 0);
  });

  it('rejects refresh token verified against access secret', () => {
    const token = signRefreshToken('uuid-1');
    expect(() => jwt.verify(token, JWT_SECRET)).toThrow();
  });
});

// ── Electron OAuth token ──────────────────────────────────────────────────────

describe('Electron OAuth token', () => {
  it('signs and verifies electron oauth token', () => {
    const token = signElectronOAuthToken('uuid-42');
    const payload = verifyElectronOAuthToken(token);
    expect(payload.sub).toBe('uuid-42');
    expect(payload.type).toBe('electron_oauth');
  });

  it('expires in 5 minutes', () => {
    const token = signElectronOAuthToken('uuid-1');
    const decoded = jwt.decode(token) as any;
    const diffSeconds = decoded.exp - decoded.iat;
    expect(diffSeconds).toBe(5 * 60);
  });

  it('rejects token with wrong type', () => {
    const token = jwt.sign({ sub: 'uuid-1', type: 'access' }, ELECTRON_OAUTH_SECRET, { expiresIn: '5m' });
    expect(() => verifyElectronOAuthToken(token)).toThrow('Invalid token type');
  });

  it('cannot be verified with access token secret', () => {
    const token = signElectronOAuthToken('uuid-1');
    expect(() => jwt.verify(token, JWT_SECRET)).toThrow();
  });
});

// ── referral code generation ──────────────────────────────────────────────────

describe('referral code generation', () => {
  it('generates 8-char code', () => {
    expect(generateReferralCode()).toHaveLength(8);
  });

  it('generates unique codes', () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateReferralCode()));
    expect(codes.size).toBeGreaterThan(95); // allow tiny collision chance
  });

  it('only contains uppercase letters and digits', () => {
    const code = generateReferralCode();
    expect(code).toMatch(/^[A-Z0-9]{8}$/);
  });
});

// ── email → username derivation ───────────────────────────────────────────────

describe('username derivation from email', () => {
  it('strips domain and lowercases', () => {
    expect(deriveUsernameFromEmail('John@example.com')).toBe('john');
  });

  it('removes dots and special chars', () => {
    expect(deriveUsernameFromEmail('john.doe+99@gmail.com')).toBe('johndoe99');
  });

  it('truncates at 20 chars', () => {
    const result = deriveUsernameFromEmail('averylongemailaddresslocal@example.com');
    expect(result.length).toBeLessThanOrEqual(20);
  });

  it('handles numeric-only local part', () => {
    expect(deriveUsernameFromEmail('12345@example.com')).toBe('12345');
  });
});
