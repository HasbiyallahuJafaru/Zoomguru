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

    return this.generateTokens(user, deviceId);
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
    return { success: true };
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
