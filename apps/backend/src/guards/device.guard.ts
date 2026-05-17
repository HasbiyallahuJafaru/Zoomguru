import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { getDB } from '../database/db';

@Injectable()
export class DeviceGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const deviceId = request.headers['x-device-id'];
    const userId = request.user?.userId;

    if (!deviceId || !userId) throw new ForbiddenException('Device not identified');

    const sql = getDB();
    const [license] = await sql`
      SELECT device_fingerprint FROM licenses
      WHERE user_id = ${userId}
      AND status = 'active'
      LIMIT 1
    `;

    // New user — no license yet (free tier)
    if (!license) return true;

    // Pro user — fingerprint must match (allow empty fingerprint on first bind)
    if (license.device_fingerprint && license.device_fingerprint !== deviceId) {
      throw new ForbiddenException('License bound to different device');
    }

    return true;
  }
}
