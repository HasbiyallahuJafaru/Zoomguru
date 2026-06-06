import { Injectable, BadRequestException } from '@nestjs/common';
import { createVerify } from 'node:crypto';
import { getDB } from '../database/db';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIMESTAMP_TOLERANCE_SEC = 30;

export interface SignatureResult {
  valid: boolean;
  reason: 'valid' | 'not_registered' | 'invalid_signature';
}

@Injectable()
export class DeviceService {
  async registerKey(userId: string, keyId: string, publicKey: string): Promise<void> {
    if (!UUID_RE.test(keyId)) throw new BadRequestException('Invalid key ID format');
    if (!publicKey.includes('-----BEGIN PUBLIC KEY-----')) {
      throw new BadRequestException('Invalid public key format');
    }
    const pool = getDB();
    await pool.query(
      `INSERT INTO device_keys (user_id, key_id, public_key)
       VALUES ($1, $2, $3)
       ON CONFLICT (key_id) DO UPDATE SET public_key = EXCLUDED.public_key
       WHERE device_keys.user_id = EXCLUDED.user_id`,
      [userId, keyId, publicKey],
    );
  }

  async verifySignature(
    userId: string,
    keyId: string | undefined,
    timestamp: string | undefined,
    signature: string | undefined,
  ): Promise<SignatureResult> {
    if (!keyId || !timestamp || !signature) {
      return { valid: false, reason: 'invalid_signature' };
    }
    if (!UUID_RE.test(keyId)) {
      return { valid: false, reason: 'invalid_signature' };
    }

    const ts = Number(timestamp);
    if (!Number.isInteger(ts)) {
      return { valid: false, reason: 'invalid_signature' };
    }
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - ts) > TIMESTAMP_TOLERANCE_SEC) {
      return { valid: false, reason: 'invalid_signature' };
    }

    const pool = getDB();
    const result = await pool.query<{ public_key: string }>(
      `SELECT public_key FROM device_keys WHERE user_id = $1 AND key_id = $2 LIMIT 1`,
      [userId, keyId],
    );
    if (result.rows.length === 0) {
      return { valid: false, reason: 'not_registered' };
    }

    try {
      const message = `${keyId}:${timestamp}`;
      const verifier = createVerify('SHA256');
      verifier.update(message);
      const ok = verifier.verify(result.rows[0].public_key, signature, 'base64');
      return ok
        ? { valid: true, reason: 'valid' as const }
        : { valid: false, reason: 'invalid_signature' };
    } catch {
      return { valid: false, reason: 'invalid_signature' };
    }
  }
}
