import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { nanoid } from 'nanoid';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { getDB } from '../database/db';

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async register(email: string, password: string, name: string, deviceId: string, refCode?: string, username?: string) {
    const sql = getDB();

    if (!username || username.trim().length < 3) {
      throw new BadRequestException('Username must be at least 3 characters');
    }

    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');

    if (cleanUsername.length < 3) {
      throw new BadRequestException('Username can only contain letters, numbers and underscores');
    }

    const [usernameExists] = await sql`
      SELECT id FROM users WHERE username = ${cleanUsername} LIMIT 1
    `;
    if (usernameExists) {
      throw new ConflictException('Username already taken');
    }

    // Block multiple free accounts on same device
    if (deviceId) {
      const [deviceExists] = await sql`
        SELECT id, is_pro FROM (
          SELECT u.id, u.is_pro FROM users u
          INNER JOIN licenses l ON l.user_id = u.id
          WHERE l.device_fingerprint = ${deviceId}
          UNION
          SELECT u.id, u.is_pro FROM users u
          WHERE u.device_fingerprint_trial = ${deviceId}
        ) combined
        LIMIT 1
      `;

      if (deviceExists && !deviceExists.is_pro) {
        throw new ConflictException(
          'A free trial has already been used on this device. ' +
          'Please upgrade to create a new account.'
        );
      }
    }

    // Check existing
    const [existing] = await sql`
      SELECT id FROM users WHERE email = ${email.toLowerCase()}
    `;
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(password, 12);
    const referralCode = nanoid(8).toUpperCase();

    // Create user
    const [user] = await sql`
      INSERT INTO users (email, password_hash, name, username, device_fingerprint_trial, referral_code)
      VALUES (${email.toLowerCase()}, ${passwordHash}, ${name}, ${cleanUsername}, ${deviceId || null}, ${referralCode})
      RETURNING id, email, name, username, is_pro, role, avatar_url, referral_code
    `;

    // Init usage row
    await sql`
      INSERT INTO user_usage (user_id)
      VALUES (${user.id})
      ON CONFLICT (user_id) DO NOTHING
    `;

    // Init referral balance
    await sql`
      INSERT INTO referral_balances (user_id, currency)
      VALUES (${user.id}, 'NGN')
      ON CONFLICT (user_id) DO NOTHING
    `;

    // Record referral relationship if referred by someone
    if (refCode) {
      const [referrer] = await sql`
        SELECT id FROM users WHERE referral_code = ${refCode} LIMIT 1
      `;
      if (referrer && referrer.id !== user.id) {
        await sql`
          INSERT INTO referrals (referrer_id, referred_id, currency)
          VALUES (${referrer.id}, ${user.id}, 'NGN')
          ON CONFLICT (referred_id) DO NOTHING
        `;
      }
    }

    return this.generateTokens(user);
  }

  async login(email: string, password: string, deviceId: string) {
    const sql = getDB();

    const identifier = email.toLowerCase().trim();
    const [user] = await sql`
      SELECT id, email, name, username, password_hash,
             is_pro, role, avatar_url
      FROM users
      WHERE email = ${identifier}
      OR username = ${identifier}
      LIMIT 1
    `;

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    // Expire any monthly licenses that have passed their end date
    await sql`
      UPDATE licenses SET status = 'expired'
      WHERE user_id = ${user.id}
      AND status = 'active'
      AND expires_at IS NOT NULL
      AND expires_at < NOW()
    `;

    // Downgrade user only if they have at least one license row but none are active
    // (avoids stripping pro from users whose webhook hasn't fired yet)
    const licenses = await sql`
      SELECT id, status FROM licenses
      WHERE user_id = ${user.id}
    `;
    const hasAnyLicense = licenses.length > 0;
    const hasActiveLicense = licenses.some((l: any) => l.status === 'active');

    if (hasAnyLicense && !hasActiveLicense && user.is_pro) {
      await sql`UPDATE users SET is_pro = false, plan = 'free' WHERE id = ${user.id}`;
      user.is_pro = false;
    }

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

    await sql`
      UPDATE users
      SET last_login_at = NOW(),
          login_count = login_count + 1
      WHERE id = ${user.id}
    `;

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

  async getUserSessions(userId: string, opts: { page: number; limit: number; type: string; sort: string }) {
    const sql = getDB();
    const offset = (opts.page - 1) * opts.limit;

    const orderBy = opts.sort === 'longest'
      ? sql`ORDER BY duration_seconds DESC NULLS LAST`
      : opts.sort === 'questions'
        ? sql`ORDER BY total_questions DESC`
        : sql`ORDER BY started_at DESC`;

    const typeFilter = opts.type === 'all' ? sql`` : sql`AND interview_type = ${opts.type}`;

    const sessions = await sql`
      SELECT id, interview_type, duration_seconds,
             total_questions, summary, started_at, ended_at
      FROM interview_sessions
      WHERE user_id = ${userId}
      ${typeFilter}
      ${orderBy}
      LIMIT ${opts.limit} OFFSET ${offset}
    `;

    const [counts] = await sql`
      SELECT
        COUNT(*) AS total,
        AVG(duration_seconds) AS avg_duration,
        AVG(total_questions) AS avg_questions
      FROM interview_sessions
      WHERE user_id = ${userId}
      ${typeFilter}
    `;

    const total = parseInt(counts.total);
    return {
      sessions,
      total,
      totalSessions: total,
      avgDurationSeconds: parseFloat(counts.avg_duration || '0'),
      avgQuestions: parseFloat(counts.avg_questions || '0'),
    };
  }

  async getUserDevice(userId: string) {
    const sql = getDB();
    const [license] = await sql`
      SELECT device_fingerprint, plan, activated_at
      FROM licenses
      WHERE user_id = ${userId} AND status = 'active'
      ORDER BY activated_at DESC LIMIT 1
    `;
    return {
      deviceFingerprint: license?.device_fingerprint || null,
      plan: license?.plan || 'free',
      lockedSince: license?.activated_at || null,
    };
  }

  async updateProfile(userId: string, name?: string, username?: string) {
    const sql = getDB();

    if (username) {
      const clean = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (clean.length < 3) throw new BadRequestException('Username too short');
      const [taken] = await sql`
        SELECT id FROM users WHERE username = ${clean} AND id != ${userId} LIMIT 1
      `;
      if (taken) throw new ConflictException('Username already taken');

      await sql`
        UPDATE users SET name = ${name || null}, username = ${clean}, updated_at = NOW()
        WHERE id = ${userId}
      `;
    } else {
      await sql`
        UPDATE users SET name = ${name || null}, updated_at = NOW()
        WHERE id = ${userId}
      `;
    }

    const [user] = await sql`
      SELECT id, email, name, username, is_pro, role, avatar_url FROM users WHERE id = ${userId}
    `;
    return user;
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const sql = getDB();
    const [user] = await sql`SELECT password_hash FROM users WHERE id = ${userId}`;
    if (!user) throw new UnauthorizedException('User not found');

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');

    const hash = await bcrypt.hash(newPassword, 12);
    await sql`UPDATE users SET password_hash = ${hash}, updated_at = NOW() WHERE id = ${userId}`;
    return { success: true };
  }

  async deleteAccount(userId: string) {
    const sql = getDB();
    const anon = `deleted_${userId.slice(0, 8)}@deleted.zoomguru.xyz`;
    await sql`
      UPDATE users
      SET email = ${anon}, name = 'Deleted User', username = NULL,
          password_hash = '', google_id = NULL, avatar_url = NULL,
          is_pro = false, plan = 'free', updated_at = NOW()
      WHERE id = ${userId}
    `;
    await sql`DELETE FROM refresh_tokens WHERE user_id = ${userId}`;
    await sql`UPDATE licenses SET status = 'cancelled' WHERE user_id = ${userId}`;
    return { success: true };
  }

  async getUserSubscription(userId: string) {
    const sql = getDB();

    const [user] = await sql`
      SELECT is_pro, plan FROM users WHERE id = ${userId}
    `;

    const [license] = await sql`
      SELECT device_fingerprint, expires_at, status
      FROM licenses
      WHERE user_id = ${userId} AND status = 'active'
      ORDER BY activated_at DESC LIMIT 1
    `;

    const [usage] = await sql`
      SELECT sessions_used, responses_used
      FROM user_usage WHERE user_id = ${userId}
    `;

    return {
      plan: user?.plan || 'free',
      isPro: user?.is_pro || false,
      status: license?.status || 'none',
      expiresAt: license?.expires_at || null,
      deviceFingerprint: license?.device_fingerprint || null,
      sessionsUsed: usage?.sessions_used || 0,
      responsesUsed: usage?.responses_used || 0,
    };
  }

  async getUserPayments(userId: string, opts: {
    page: number; limit: number; search: string; currency: string; plan: string;
  }) {
    const sql = getDB();
    const offset = (opts.page - 1) * opts.limit;
    const search = `%${opts.search}%`;

    const payments = await sql`
      SELECT id, paystack_reference, amount, currency, plan, status, created_at
      FROM payments
      WHERE user_id = ${userId}
      AND (${opts.search} = '' OR paystack_reference ILIKE ${search})
      AND (${opts.currency} = '' OR currency = ${opts.currency})
      AND (${opts.plan} = '' OR plan = ${opts.plan})
      ORDER BY created_at DESC
      LIMIT ${opts.limit} OFFSET ${offset}
    `;

    const [counts] = await sql`
      SELECT
        COUNT(*) AS total,
        COALESCE(SUM(CASE WHEN currency = 'NGN' AND status = 'success' THEN amount END), 0) AS total_ngn,
        COALESCE(SUM(CASE WHEN currency = 'USD' AND status = 'success' THEN amount END), 0) AS total_usd
      FROM payments
      WHERE user_id = ${userId}
      AND (${opts.search} = '' OR paystack_reference ILIKE ${search})
      AND (${opts.currency} = '' OR currency = ${opts.currency})
      AND (${opts.plan} = '' OR plan = ${opts.plan})
    `;

    return {
      payments,
      total: parseInt(counts.total),
      totalSpentNgn: parseFloat(counts.total_ngn),
      totalSpentUsd: parseFloat(counts.total_usd),
    };
  }

  async checkUsername(username: string) {
    if (!username || username.length < 3) {
      return { available: false };
    }
    const sql = getDB();
    const clean = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
    const [existing] = await sql`
      SELECT id FROM users WHERE username = ${clean} LIMIT 1
    `;
    return { available: !existing };
  }

  async getMe(userId: string) {
    const sql = getDB();
    const [user] = await sql`SELECT id, email, name, username, is_pro, role FROM users WHERE id = ${userId} LIMIT 1`;
    if (!user) throw new UnauthorizedException();
    return { isPro: user.is_pro, role: user.role };
  }

  async getDashboardSummary(userId: string) {
    const sql = getDB();

    const [user] = await sql`
      SELECT
        u.id, u.name, u.username, u.email, u.is_pro, u.plan, u.referral_code,
        uu.sessions_used, uu.responses_used
      FROM users u
      LEFT JOIN user_usage uu ON uu.user_id = u.id
      WHERE u.id = ${userId}
    `;

    const [activeLicense] = await sql`
      SELECT expires_at FROM licenses
      WHERE user_id = ${userId} AND status = 'active'
      ORDER BY activated_at DESC LIMIT 1
    `;

    const [sessionStats] = await sql`
      SELECT
        COUNT(*) AS total_sessions,
        COALESCE(SUM(total_questions), 0) AS total_questions
      FROM interview_sessions
      WHERE user_id = ${userId}
    `;

    const [referralBalance] = await sql`
      SELECT pending_balance, currency
      FROM referral_balances
      WHERE user_id = ${userId}
    `;

    const recentSessions = await sql`
      SELECT id, interview_type, duration_seconds,
             total_questions, summary, started_at
      FROM interview_sessions
      WHERE user_id = ${userId}
      ORDER BY started_at DESC
      LIMIT 5
    `;

    return {
      plan: user?.plan || 'free',
      isPro: user?.is_pro || false,
      expiresAt: activeLicense?.expires_at || null,
      referralCode: user?.referral_code || null,
      totalSessions: parseInt(sessionStats?.total_sessions || '0'),
      totalQuestions: parseInt(sessionStats?.total_questions || '0'),
      referralPendingBalance: parseFloat(referralBalance?.pending_balance || '0'),
      referralCurrency: referralBalance?.currency || 'NGN',
      recentSessions,
    };
  }

  async handleGoogleElectronCallback(code: string) {
    const sql = getDB();

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: process.env.BACKEND_URL + '/auth/google/electron/callback',
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = await tokenRes.json();

    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: 'Bearer ' + tokenData.access_token },
    });
    const googleUser = await userRes.json();

    let [user] = await sql`
      SELECT id, email, name, username, is_pro, role, avatar_url
      FROM users
      WHERE google_id = ${googleUser.sub}
      OR email = ${googleUser.email}
      LIMIT 1
    `;

    if (!user) {
      const baseUsername = googleUser.email
        .split('@')[0]
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '')
        .slice(0, 20);

      const referralCode = nanoid(8).toUpperCase();

      const [newUser] = await sql`
        INSERT INTO users
          (email, name, username, google_id, avatar_url, referral_code, password_hash)
        VALUES
          (${googleUser.email}, ${googleUser.name},
           ${baseUsername + '_' + Math.floor(Math.random() * 999)},
           ${googleUser.sub}, ${googleUser.picture},
           ${referralCode}, '')
        ON CONFLICT (email) DO UPDATE SET
          google_id = ${googleUser.sub},
          avatar_url = ${googleUser.picture}
        RETURNING id, email, name, username, is_pro, role, avatar_url
      `;
      user = newUser;

      await sql`INSERT INTO user_usage (user_id) VALUES (${user.id}) ON CONFLICT (user_id) DO NOTHING`;
      await sql`INSERT INTO referral_balances (user_id, currency) VALUES (${user.id}, 'NGN') ON CONFLICT (user_id) DO NOTHING`;
    } else if (!user.google_id) {
      await sql`
        UPDATE users SET google_id = ${googleUser.sub}, avatar_url = ${googleUser.picture}
        WHERE id = ${user.id}
      `;
    }

    const electronToken = this.jwtService.sign(
      { sub: user.id, type: 'electron_oauth' },
      { secret: process.env.ELECTRON_OAUTH_SECRET, expiresIn: '5m' }
    );

    return { electronToken };
  }

  async exchangeGoogleElectronToken(token: string) {
    let payload: any;
    try {
      payload = this.jwtService.verify(token, {
        secret: process.env.ELECTRON_OAUTH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired OAuth token');
    }

    if (payload.type !== 'electron_oauth') {
      throw new UnauthorizedException('Invalid token type');
    }

    const sql = getDB();
    const [user] = await sql`
      SELECT id, email, name, username, is_pro, role, avatar_url
      FROM users WHERE id = ${payload.sub} LIMIT 1
    `;

    if (!user) throw new UnauthorizedException('User not found');

    return this.generateTokens(user);
  }

  async handleGoogleWebAuth(params: { idToken: string }) {
    const sql = getDB();

    const verifyRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(params.idToken)}`
    );
    if (!verifyRes.ok) throw new UnauthorizedException('Invalid Google token');
    const claims = await verifyRes.json();
    if (claims.aud !== process.env.GOOGLE_CLIENT_ID) {
      throw new UnauthorizedException('Token audience mismatch');
    }
    const { sub: googleId, email, name, picture: avatar } = claims;
    if (!googleId || !email) throw new UnauthorizedException('Google token missing required claims');

    let [user] = await sql`
      SELECT id, email, name, username, is_pro, role, avatar_url
      FROM users
      WHERE google_id = ${googleId} OR email = ${email}
      LIMIT 1
    `;

    if (!user) {
      const { nanoid } = await import('nanoid');
      const baseUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
      const referralCode = nanoid(8).toUpperCase();

      const [newUser] = await sql`
        INSERT INTO users (email, name, username, google_id, avatar_url, referral_code, password_hash)
        VALUES (${email}, ${name}, ${baseUsername + '_' + Math.floor(Math.random() * 9999)},
                ${googleId}, ${avatar || null}, ${referralCode}, '')
        ON CONFLICT (email) DO UPDATE SET
          google_id = ${googleId},
          avatar_url = ${avatar || null}
        RETURNING id, email, name, username, is_pro, role, avatar_url
      `;
      user = newUser;
      await sql`INSERT INTO user_usage (user_id) VALUES (${user.id}) ON CONFLICT (user_id) DO NOTHING`;
      await sql`INSERT INTO referral_balances (user_id, currency) VALUES (${user.id}, 'NGN') ON CONFLICT (user_id) DO NOTHING`;
    } else if (!user.google_id) {
      await sql`UPDATE users SET google_id = ${googleId}, avatar_url = ${avatar || null} WHERE id = ${user.id}`;
    }

    return this.generateTokens(user);
  }

  private async generateTokens(user: any, deviceId?: string) {
    const sql = getDB();

    const accessToken = this.jwtService.sign(
      { sub: user.id, email: user.email, isPro: user.is_pro, role: user.role || 'user', username: user.username },
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
        username: user.username,
        isPro: user.is_pro,
        role: user.role || 'user',
        avatarUrl: user.avatar_url,
      },
    };
  }
}
