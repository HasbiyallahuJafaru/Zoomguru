import { Injectable, UnauthorizedException, ConflictException, BadRequestException, HttpException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes, createHash } from 'node:crypto';
import { getDB } from '../database/db';
import { EmailService } from '../email/email.service';
import { getRedis } from '../redis/redis';
import { addSession, listSessions, revokeAllSessions, revokeSession, seatsForPlan, DEFAULT_SEATS, TOKEN_TTL_SEC } from './sessions';
import { isSubActive, getSubCache } from '../subscription/subscription.service';

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

// Per-ACCOUNT login throttle. The per-IP limiter in auth.controller.ts caps a
// single caller at 10/900s; this caps a single ACCOUNT across every IP, which
// is the axis credential stuffing actually attacks. This replaced a second
// per-IP limiter that was dead code — the controller rejected at 10/900s
// before this one's 20/900s could ever fire.
//
// Only FAILED attempts count, so an attacker grinding an account can never
// lock its owner out: a correct password still gets straight in. Failures are
// counted for unknown identifiers too, so that tripping the limit never
// reveals whether an account exists.
export const FAILED_LOGIN_MAX = 20;
export const FAILED_LOGIN_WINDOW_SEC = 900;

// Lowercased so a case-flipped identifier cannot buy a fresh 20 attempts.
const failKey = (identifier: string) => `lf:${identifier.toLowerCase()}`;

export async function tooManyFailures(identifier: string): Promise<boolean> {
  try {
    const count = await getRedis().get(failKey(identifier));
    return count !== null && Number(count) >= FAILED_LOGIN_MAX;
  } catch {
    return false; // Redis down fails OPEN, same as every other Redis check here
  }
}

export async function recordLoginFailure(identifier: string): Promise<void> {
  try {
    const redis = getRedis();
    const key = failKey(identifier);
    if ((await redis.incr(key)) === 1) {
      await redis.expire(key, FAILED_LOGIN_WINDOW_SEC);
    }
  } catch {
    // An unrecorded failure beats a login outage.
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

  async register(
    email: string,
    name: string,
    password: string,
    referralCode?: string,
    ip?: string,
    userAgent?: string,
  ): Promise<LoginResult> {
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
           VALUES (lower($1), $2, $3, $4, $5)
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

    // A brand-new account has no subscription yet, so it starts on one seat.
    const sid = await addSession(registeredUser.id, ip ?? '', userAgent, DEFAULT_SEATS);
    const accessToken = this.jwtService.sign(
      { sub: registeredUser.id, email: registeredUser.email, name: registeredUser.name, sid },
      { expiresIn: TOKEN_TTL_SEC },
    );

    void this.emailService.sendWelcome(registeredUser.email, registeredUser.name ?? 'there');

    return {
      accessToken,
      user: { id: registeredUser.id, email: registeredUser.email, name: registeredUser.name, username: registeredUser.username },
    };
  }

  async login(
    identifier: string,
    password: string,
    ip?: string,
    userAgent?: string,
    revokeSid?: string,
  ): Promise<LoginResult> {
    if (await tooManyFailures(identifier)) {
      throw new UnauthorizedException('Too many failed attempts for this account. Try again in 15 minutes.');
    }
    const pool = getDB();

    const result = await pool.query<UserRow>(
      `(SELECT id, email, name, username, password_hash
          FROM users WHERE email = lower($1) LIMIT 1)
       UNION ALL
       (SELECT id, email, name, username, password_hash
          FROM users WHERE username = $1 LIMIT 1)
       LIMIT 1`,
      [identifier],
    );

    const user = result.rows[0];
    if (!user) {
      // Counted even though there is no account to protect. If unknown
      // identifiers were skipped, the counter would only ever trip for REAL
      // accounts, and the distinct 'too many attempts' message below would
      // become an account-existence oracle.
      await recordLoginFailure(identifier);
      throw new UnauthorizedException('Invalid credentials');
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      await recordLoginFailure(identifier);
      throw new UnauthorizedException('Invalid credentials');
    }

    // The caller proved they know the password, so they are allowed to take a
    // slot back from an existing session rather than wait for it to log out.
    if (revokeSid) await revokeSession(user.id, revokeSid);

    const seats = await this.seatsFor(user.id);
    const sid = await addSession(user.id, ip ?? '', userAgent, seats);
    if (sid === null) {
      throw new HttpException(
        {
          error: 'session_limit',
          message: `This account is already signed in on ${seats} devices. Sign out on one of them and try again.`,
          sessions: await listSessions(user.id),
        },
        409,
      );
    }

    const accessToken = this.jwtService.sign(
      { sub: user.id, email: user.email, name: user.name, sid },
      { expiresIn: TOKEN_TTL_SEC },
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
      `SELECT id, name FROM users WHERE email = lower($1) LIMIT 1`,
      [email],
    );
    const user = userResult.rows[0];
    if (!user) {
      console.warn('[AuthService] forgotPassword: no account matches that address');
      return;
    }

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

    // Changing the password signs every device out, so the account owner can
    // always take their account back from whoever else was logged in.
    await revokeAllSessions(tokenRow.user_id);
  }

  // How many people may be signed in at once. A row can sit at status
  // 'active' with an elapsed period_end (nothing expires subscriptions on a
  // timer), so the date has to be checked too — isSubActive does both.
  //
  // Served from the 30s `sc:` cache checkAccess already maintains, because the
  // overlay polls GET /auth/sessions every 60s just to render a badge. Read
  // only: a miss falls back to SQL without writing the key, since that entry
  // holds more fields than this query reads.
  private async seatsFor(userId: string): Promise<number> {
    const cached = await getSubCache(userId);
    if (cached) {
      return seatsForPlan(isSubActive(cached.status, cached.periodEnd) ? cached.plan : null);
    }
    const result = await getDB().query<{ plan: string | null; status: string; current_period_end: string | null }>(
      `SELECT plan, status, current_period_end FROM subscriptions WHERE user_id = $1 LIMIT 1`,
      [userId],
    );
    const row = result.rows[0];
    return seatsForPlan(row && isSubActive(row.status, row.current_period_end) ? row.plan : null);
  }

  async listSessions(userId: string, currentSid?: string) {
    return { max: await this.seatsFor(userId), sessions: await listSessions(userId, currentSid) };
  }

  async logout(userId: string, sid: string): Promise<void> {
    await revokeSession(userId, sid);
  }
}
