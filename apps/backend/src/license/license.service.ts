import { Injectable, ForbiddenException } from '@nestjs/common';
import { getDB } from '../database/db';

@Injectable()
export class LicenseService {

  async verify(userId: string, deviceId: string) {
    const sql = getDB();

    const [user] = await sql`
      SELECT is_pro, plan FROM users WHERE id = ${userId}
    `;

    if (!user) throw new ForbiddenException('User not found');

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

  async bind(userId: string, deviceId: string) {
    const sql = getDB();

    // Bind device fingerprint to active license (first login after purchase)
    const result = await sql`
      UPDATE licenses
      SET device_fingerprint = ${deviceId}
      WHERE user_id = ${userId}
      AND (device_fingerprint IS NULL OR device_fingerprint = '')
      AND status = 'active'
      RETURNING id, plan, expires_at
    `;

    if (result.length === 0) {
      return { bound: false, message: 'No unbounded active license found' };
    }

    return { bound: true, license: result[0] };
  }
}
