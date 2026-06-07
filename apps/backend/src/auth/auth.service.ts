import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'node:crypto';
import { getDB } from '../database/db';
import { EmailService } from '../email/email.service';
import { getRedis } from '../redis/redis';

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  password_hash: string;
}

export interface LoginResult {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    username: string | null;
  };
}

async function checkLoginRateLimit(ip: string): Promise<boolean> {
  try {
    const redis = getRedis();
    const key = `lr:${ip}`;
    const [[, count]] = (await redis
      .pipeline()
      .incr(key)
      .expire(key, 900)
      .exec()) as [[null, number], [null, number]];
    return count <= 20;
  } catch {
    return true;
  }
}

function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  const bytes = randomBytes(8);
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private emailService: EmailService,
  ) {}

  async register(email: string, name: string, password: string, referralCode?: string): Promise<LoginResult> {
    const pool = getDB();
    const passwordHash = await bcrypt.hash(password, 10);

    let referredByUserId: string | null = null;
    if (referralCode) {
      const refResult = await pool.query<{ id: string }>(
        `SELECT id FROM users WHERE referral_code = $1 LIMIT 1`,
        [referralCode.toUpperCase().trim()],
      );
      if (refResult.rows[0]) {
        referredByUserId = refResult.rows[0].id;
      }
    }

    let user: UserRow | undefined;
    for (let attempt = 0; attempt < 5; attempt++) {
      const newReferralCode = generateReferralCode();
      try {
        const result = await pool.query<UserRow>(
          `INSERT INTO users (email, name, password_hash, referral_code, referred_by_user_id)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, email, name, username, password_hash`,
          [email, name, passwordHash, newReferralCode, referredByUserId],
        );
        user = result.rows[0];
        break;
      } catch (err: unknown) {
        if ((err as { code?: string; constraint?: string }).code === '23505') {
          if ((err as { constraint?: string }).constraint?.includes('referral')) continue;
          throw new ConflictException('Email already in use');
        }
        throw err;
      }
    }
    if (!user) throw new ConflictException('Email already in use');
    const registeredUser = user;

    const accessToken = this.jwtService.sign(
      { sub: registeredUser.id, email: registeredUser.email, name: registeredUser.name },
      { expiresIn: '30d' },
    );

    void this.emailService.sendWelcome(registeredUser.email, registeredUser.name ?? 'there');

    return {
      accessToken,
      user: { id: registeredUser.id, email: registeredUser.email, name: registeredUser.name, username: registeredUser.username },
    };
  }

  async login(identifier: string, password: string, ip?: string): Promise<LoginResult> {
    if (ip && !(await checkLoginRateLimit(ip))) {
      throw new UnauthorizedException('Too many login attempts. Try again in 15 minutes.');
    }
    const pool = getDB();

    const result = await pool.query<UserRow>(
      `(SELECT id, email, name, username, password_hash
          FROM users WHERE email = $1 LIMIT 1)
       UNION ALL
       (SELECT id, email, name, username, password_hash
          FROM users WHERE username = $1 LIMIT 1)
       LIMIT 1`,
      [identifier],
    );

    const user = result.rows[0];
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = this.jwtService.sign(
      { sub: user.id, email: user.email, name: user.name },
      { expiresIn: '30d' },
    );

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
      },
    };
  }

  async forgotPassword(email: string): Promise<void> {
    const pool = getDB();

    const userResult = await pool.query<{ id: string; name: string | null }>(
      `SELECT id, name FROM users WHERE email = $1 LIMIT 1`,
      [email],
    );
    const user = userResult.rows[0];
    if (!user) return;

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM password_reset_tokens WHERE user_id = $1`, [user.id]);
      await client.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
        [user.id, tokenHash],
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    const baseUrl = (process.env['APP_URL'] ?? 'http://localhost:3000').replace(/\/$/, '');
    const resetUrl = `${baseUrl}/auth/reset-password-page?token=${rawToken}`;
    void this.emailService.sendPasswordReset(email, resetUrl);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const pool = getDB();

    const tokenHash = createHash('sha256').update(token).digest('hex');

    const tokenResult = await pool.query<{ id: string; user_id: string }>(
      `SELECT id, user_id FROM password_reset_tokens
       WHERE token_hash = $1 AND expires_at > NOW()
       LIMIT 1`,
      [tokenHash],
    );
    const tokenRow = tokenResult.rows[0];
    if (!tokenRow) {
      throw new BadRequestException('Invalid or expired reset link');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [passwordHash, tokenRow.user_id]);
    await pool.query(`DELETE FROM password_reset_tokens WHERE id = $1`, [tokenRow.id]);
  }
}
