import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import * as crypto from 'crypto';
import { getDB } from '../database/db';

function timingSafeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) {
    // Still do a dummy comparison to prevent length-based timing leak
    crypto.timingSafeEqual(ba, ba);
    return false;
  }
  return crypto.timingSafeEqual(ba, bb);
}

@Injectable()
export class DeviceGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const deviceId = request.headers['x-device-id'];
    const userId = request.user?.userId;

    if (!userId) throw new ForbiddenException('Not authenticated');

    const sql = getDB();
    const [license] = await sql`
      SELECT device_fingerprint FROM licenses
      WHERE user_id = ${userId}
      AND status = 'active'
      LIMIT 1
    `;

    // Free tier — no license, device binding not required
    if (!license) return true;

    // Pro user — device ID header is mandatory
    if (!deviceId) throw new ForbiddenException('Device not identified');

    // Pro user — fingerprint must match (allow empty fingerprint on first bind)
    if (license.device_fingerprint && !timingSafeEqual(license.device_fingerprint, deviceId)) {
      throw new ForbiddenException('License bound to different device');
    }

    return true;
  }
}
