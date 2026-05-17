# ZoomGuru — Auth & License

## Auth Flow

```
Register → Login → Access Token (15min) + Refresh Token (30 days)
         → Every request: Bearer access token + X-Device-ID header
         → Access expired → refresh endpoint rotates tokens
         → License check on every protected request
```

---

## JWT Tokens

```typescript
// Access token — short lived
{
  sub: userId,
  email: userEmail,
  isPro: boolean,
  exp: now + 15min
}

// Refresh token — long lived, stored hashed in DB
{
  sub: userId,
  type: 'refresh',
  exp: now + 30days
}
```

---

## auth.service.ts

```typescript
import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { getDB } from '../database/db';

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async register(email: string, password: string, name: string) {
    const sql = getDB();

    // Check existing
    const [existing] = await sql`
      SELECT id FROM users WHERE email = ${email.toLowerCase()}
    `;
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const [user] = await sql`
      INSERT INTO users (email, password_hash, name)
      VALUES (${email.toLowerCase()}, ${passwordHash}, ${name})
      RETURNING id, email, name, is_pro
    `;

    // Init usage row
    await sql`
      INSERT INTO user_usage (user_id)
      VALUES (${user.id})
      ON CONFLICT DO NOTHING
    `;

    return this.generateTokens(user);
  }

  async login(email: string, password: string, deviceId: string) {
    const sql = getDB();

    const [user] = await sql`
      SELECT id, email, name, password_hash, is_pro
      FROM users
      WHERE email = ${email.toLowerCase()}
    `;

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    // Auto-bind device to license if license exists without fingerprint
    if (user.is_pro) {
      await sql`
        UPDATE licenses
        SET device_fingerprint = ${deviceId}
        WHERE user_id = ${user.id}
        AND (device_fingerprint IS NULL OR device_fingerprint = '')
        AND status = 'active'
      `;
    }

    return this.generateTokens(user);
  }

  async refresh(refreshToken: string, deviceId: string) {
    const sql = getDB();

    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    const [stored] = await sql`
      SELECT id FROM refresh_tokens
      WHERE user_id = ${payload.sub}
      AND token_hash = ${tokenHash}
      AND expires_at > NOW()
    `;

    if (!stored) throw new UnauthorizedException('Refresh token expired or revoked');

    // Rotate — delete old, issue new
    await sql`DELETE FROM refresh_tokens WHERE id = ${stored.id}`;

    const [user] = await sql`
      SELECT id, email, name, is_pro FROM users WHERE id = ${payload.sub}
    `;

    return this.generateTokens(user, deviceId);
  }

  async logout(userId: string, refreshToken: string) {
    const sql = getDB();
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await sql`
      DELETE FROM refresh_tokens
      WHERE user_id = ${userId} AND token_hash = ${tokenHash}
    `;
  }

  private async generateTokens(user: any, deviceId?: string) {
    const sql = getDB();

    const accessToken = this.jwtService.sign(
      { sub: user.id, email: user.email, isPro: user.is_pro },
      { secret: process.env.JWT_SECRET, expiresIn: '15m' }
    );

    const refreshToken = this.jwtService.sign(
      { sub: user.id, type: 'refresh' },
      { secret: process.env.JWT_REFRESH_SECRET, expiresIn: '30d' }
    );

    // Store refresh token hash
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await sql`
      INSERT INTO refresh_tokens (user_id, token_hash, device_id, expires_at)
      VALUES (${user.id}, ${tokenHash}, ${deviceId || null}, NOW() + INTERVAL '30 days')
    `;

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isPro: user.is_pro,
      },
    };
  }
}
```

---

## license.service.ts

```typescript
import { Injectable, ForbiddenException } from '@nestjs/common';
import { getDB } from '../database/db';

@Injectable()
export class LicenseService {

  async verify(userId: string, deviceId: string) {
    const sql = getDB();

    const [user] = await sql`
      SELECT is_pro, plan FROM users WHERE id = ${userId}
    `;

    if (!user.is_pro) {
      return { valid: true, isPro: false, plan: 'free' };
    }

    // Pro user — verify device fingerprint
    const [license] = await sql`
      SELECT device_fingerprint, plan, expires_at, status
      FROM licenses
      WHERE user_id = ${userId}
      AND status = 'active'
      ORDER BY activated_at DESC
      LIMIT 1
    `;

    if (!license) {
      return { valid: true, isPro: false, plan: 'free' };
    }

    // Check expiry (monthly plans only — lifetime has null expires_at)
    if (license.expires_at && new Date(license.expires_at) < new Date()) {
      await sql`
        UPDATE users SET is_pro = false WHERE id = ${userId}
      `;
      await sql`
        UPDATE licenses SET status = 'expired'
        WHERE user_id = ${userId} AND status = 'active'
      `;
      return { valid: false, isPro: false, plan: 'free', reason: 'subscription_expired' };
    }

    // Device fingerprint check
    if (license.device_fingerprint && license.device_fingerprint !== deviceId) {
      throw new ForbiddenException('License is bound to a different device');
    }

    return {
      valid: true,
      isPro: true,
      plan: license.plan,
      expiresAt: license.expires_at,
    };
  }
}
```

---

## Electron Token Storage

```typescript
// Uses electron-store with encryption
import Store from 'electron-store';
import crypto from 'crypto';

const store = new Store({
  encryptionKey: 'zoomguru-local-key-' + getDeviceFingerprint().slice(0, 16),
});

// Save after login
store.set('access_token', tokens.accessToken);
store.set('refresh_token', tokens.refreshToken);
store.set('user', tokens.user);

// On every API request
const token = store.get('access_token') as string;

// On 401 — auto refresh
async function refreshIfNeeded() {
  const refresh = store.get('refresh_token') as string;
  const deviceId = getDeviceFingerprint();

  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: refresh, deviceId }),
  });

  const data = await res.json();
  store.set('access_token', data.accessToken);
  store.set('refresh_token', data.refreshToken);
  return data.accessToken;
}
```

---

## Request Headers (Every Call from Electron)

```
Authorization: Bearer {accessToken}
X-Device-ID: {sha256DeviceFingerprint}
Content-Type: application/json
```
