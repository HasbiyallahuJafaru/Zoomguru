# AUTH-02 — Backend Auth Extensions

## What This Does
- Allows login via username OR email
- Adds Google OAuth endpoint for Electron deep link
- Adds admin role middleware
- Extends register to require username
- Adds admin user management endpoints

## Files Affected
- `apps/backend/src/auth/auth.service.ts`
- `apps/backend/src/auth/auth.controller.ts`
- `apps/backend/src/guards/admin.guard.ts` (new)
- `apps/backend/src/admin/admin.controller.ts`

## Risk Level
🔴 HIGH — Modifies core auth. Test all login flows after.

---

## STEP 1 Prompt — Username login + register extension

```
Read .claude/AUTH.md and .claude/patches/auth-dashboard/AUTH-DASHBOARD.md

Tell me which files you will touch before writing any code.

In apps/backend/src/auth/auth.service.ts make these
changes only. Show diff after each change.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHANGE 1 — Login accepts username OR email
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Find the login() method. It currently queries by email only.
Change the user lookup query from:

  const [user] = await sql`
    SELECT id, email, name, password_hash, is_pro
    FROM users
    WHERE email = ${email.toLowerCase()}
  `;

To:

  const identifier = email.toLowerCase().trim();
  const [user] = await sql`
    SELECT id, email, name, username, password_hash,
           is_pro, role, avatar_url
    FROM users
    WHERE email = ${identifier}
    OR username = ${identifier}
    LIMIT 1
  `;

The parameter name stays as 'email' for backward compatibility
with the Electron app. It now accepts either value.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHANGE 2 — Update login response to include username + role
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

In login(), find the generateTokens() call.
After the successful bcrypt compare, before generateTokens,
update last_login_at and login_count:

  await sql`
    UPDATE users
    SET last_login_at = NOW(),
        login_count = login_count + 1
    WHERE id = ${user.id}
  `;

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHANGE 3 — Register requires username
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Find the register() method signature. Add username parameter:
  async register(
    email: string,
    password: string,
    name: string,
    deviceId: string,
    refCode?: string,
    username?: string
  )

Before the email duplicate check, add username validation:

  if (!username || username.trim().length < 3) {
    throw new BadRequestException(
      'Username must be at least 3 characters'
    );
  }

  const cleanUsername = username.trim().toLowerCase()
    .replace(/[^a-z0-9_]/g, '');

  if (cleanUsername.length < 3) {
    throw new BadRequestException(
      'Username can only contain letters, numbers and underscores'
    );
  }

  const [usernameExists] = await sql`
    SELECT id FROM users WHERE username = ${cleanUsername} LIMIT 1
  `;
  if (usernameExists) {
    throw new ConflictException('Username already taken');
  }

Then update the INSERT INTO users to include username:
  INSERT INTO users
    (email, password_hash, name, username,
     device_fingerprint_trial, referral_code)
  VALUES
    (${email.toLowerCase()}, ${passwordHash}, ${name},
     ${cleanUsername}, ${deviceId || null}, ${referralCode})

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHANGE 4 — generateTokens includes role + username
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

In generateTokens(), update the accessToken payload to include:
  { sub: user.id, email: user.email, isPro: user.is_pro,
    role: user.role || 'user', username: user.username }

Update the return object to include:
  user: {
    id: user.id,
    email: user.email,
    name: user.name,
    username: user.username,
    isPro: user.is_pro,
    role: user.role || 'user',
    avatarUrl: user.avatar_url,
  }

Show me all 4 changes as separate diffs.
```

---

## STEP 2 Prompt — Admin guard

```
Read .claude/BACKEND.md first.

Create a new file apps/backend/src/guards/admin.guard.ts
with exactly this content:

import {
  CanActivate, ExecutionContext,
  Injectable, ForbiddenException
} from '@nestjs/common';
import { getDB } from '../database/db';

@Injectable()
export class AdminGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId;

    if (!userId) throw new ForbiddenException('Not authenticated');

    const sql = getDB();
    const [user] = await sql`
      SELECT role FROM users WHERE id = ${userId} LIMIT 1
    `;

    if (!user || user.role !== 'admin') {
      throw new ForbiddenException(
        'Admin access required'
      );
    }

    return true;
  }
}

Do not modify any existing guard files.
Show me the created file.
```

---

## STEP 3 Prompt — Google OAuth Electron deep link endpoint

```
Read .claude/AUTH.md and .claude/BACKEND.md first.

In apps/backend/src/auth/auth.controller.ts,
add these two new endpoints AFTER the existing /logout endpoint.
Do not modify any existing endpoints:

  @Get('google/electron')
  async googleElectronInit(@Res() reply: FastifyReply) {
    // Redirect to Google OAuth with electron callback
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      redirect_uri: process.env.BACKEND_URL +
        '/auth/google/electron/callback',
      response_type: 'code',
      scope: 'openid email profile',
      state: 'electron',
    });
    reply.redirect(
      'https://accounts.google.com/o/oauth2/v2/auth?' +
      params.toString()
    );
  }

  @Get('google/electron/callback')
  async googleElectronCallback(
    @Query('code') code: string,
    @Res() reply: FastifyReply
  ) {
    const result = await this.authService
      .handleGoogleElectronCallback(code);
    // Redirect to Electron deep link with short-lived token
    reply.redirect(
      'zoomguru://auth?token=' + result.electronToken
    );
  }

Then in apps/backend/src/auth/auth.service.ts,
add this method to AuthService:

  async handleGoogleElectronCallback(code: string) {
    const sql = getDB();

    // Exchange code for tokens with Google
    const tokenRes = await fetch(
      'https://oauth2.googleapis.com/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          redirect_uri: process.env.BACKEND_URL +
            '/auth/google/electron/callback',
          grant_type: 'authorization_code',
        }),
      }
    );
    const tokenData = await tokenRes.json();

    // Get user info from Google
    const userRes = await fetch(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      { headers: { Authorization: 'Bearer ' + tokenData.access_token } }
    );
    const googleUser = await userRes.json();

    // Find or create user
    let [user] = await sql`
      SELECT id, email, name, username, is_pro, role, avatar_url
      FROM users
      WHERE google_id = ${googleUser.sub}
      OR email = ${googleUser.email}
      LIMIT 1
    `;

    if (!user) {
      // New user via Google — auto-generate username
      const baseUsername = googleUser.email
        .split('@')[0]
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '')
        .slice(0, 20);

      const referralCode = (await import('nanoid'))
        .nanoid(8).toUpperCase();

      const [newUser] = await sql`
        INSERT INTO users
          (email, name, username, google_id,
           avatar_url, referral_code, password_hash)
        VALUES
          (${googleUser.email}, ${googleUser.name},
           ${baseUsername + '_' + Math.floor(Math.random() * 999)},
           ${googleUser.sub}, ${googleUser.picture},
           ${referralCode}, '')
        ON CONFLICT (email) DO UPDATE SET
          google_id = ${googleUser.sub},
          avatar_url = ${googleUser.picture}
        RETURNING id, email, name, username,
                  is_pro, role, avatar_url
      `;
      user = newUser;

      await sql`
        INSERT INTO user_usage (user_id)
        VALUES (${user.id}) ON CONFLICT DO NOTHING
      `;
      await sql`
        INSERT INTO referral_balances (user_id, currency)
        VALUES (${user.id}, 'NGN') ON CONFLICT DO NOTHING
      `;
    } else if (!user.google_id) {
      await sql`
        UPDATE users SET google_id = ${googleUser.sub},
        avatar_url = ${googleUser.picture}
        WHERE id = ${user.id}
      `;
    }

    // Generate a short-lived electron token (5 minutes)
    const electronToken = this.jwtService.sign(
      { sub: user.id, type: 'electron_oauth' },
      {
        secret: process.env.ELECTRON_OAUTH_SECRET,
        expiresIn: '5m'
      }
    );

    return { electronToken };
  }

Add to .env:
  BACKEND_URL=https://api.zoomguru.com
  ELECTRON_OAUTH_SECRET=generate_random_32_chars
  GOOGLE_CLIENT_ID=from_google_cloud_console
  GOOGLE_CLIENT_SECRET=from_google_cloud_console

Show me all changes with exact diffs.
```

---

## STEP 4 Prompt — Admin user management endpoints

```
Read .claude/BACKEND.md first.

In apps/backend/src/admin/admin.controller.ts,
add these endpoints AFTER the existing /admin/stats endpoint.
Import AdminGuard and add it alongside JwtAuthGuard
on ALL admin endpoints including the existing stats one:

  @Get('users')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getUsers(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('search') search = '',
    @Query('plan') plan = '',
    @Query('role') role = '',
    @Headers('x-admin-key') adminKey: string,
  ) {
    return this.adminService.getUsers({
      page: parseInt(page),
      limit: parseInt(limit),
      search, plan, role,
    });
  }

  @Get('users/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getUserDetail(@Param('id') id: string) {
    return this.adminService.getUserDetail(id);
  }

  @Patch('users/:id/role')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateUserRole(
    @Param('id') id: string,
    @Body() body: { role: 'user' | 'admin' },
    @Headers('x-admin-key') adminKey: string,
  ) {
    if (adminKey !== process.env.ADMIN_SECRET_KEY) {
      throw new ForbiddenException('Invalid admin key');
    }
    return this.adminService.updateUserRole(id, body.role);
  }

  @Patch('users/:id/license')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async toggleLicense(
    @Param('id') id: string,
    @Body() body: { active: boolean },
  ) {
    return this.adminService.toggleUserLicense(id, body.active);
  }

  @Get('payouts')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getPayouts(@Query('status') status = 'pending') {
    return this.adminService.getPayouts(status);
  }

  @Patch('payouts/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updatePayout(
    @Param('id') id: string,
    @Body() body: { status: 'paid' | 'rejected'; note?: string },
  ) {
    return this.adminService.processPayout(id, body.status, body.note);
  }

  @Get('analytics/revenue')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getRevenueAnalytics(
    @Query('period') period = '30'
  ) {
    return this.adminService.getRevenueAnalytics(parseInt(period));
  }

  @Get('analytics/users')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getUserAnalytics(
    @Query('period') period = '30'
  ) {
    return this.adminService.getUserAnalytics(parseInt(period));
  }

  @Get('analytics/sessions')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getSessionAnalytics(
    @Query('period') period = '30'
  ) {
    return this.adminService.getSessionAnalytics(parseInt(period));
  }

  @Get('analytics/referrals')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getReferralAnalytics() {
    return this.adminService.getReferralAnalytics();
  }

Then add all corresponding methods to admin.service.ts.
Each method should query Neon directly using getDB().
Show me the controller diff first, confirm,
then show me the service methods.
```

## Verification

```bash
# Test username login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"hasbiy","password":"yourpassword","deviceId":"abc"}'

# Should work with username instead of email

# Test admin guard
curl http://localhost:3000/admin/users \
  -H "Authorization: Bearer user_token"
# Should return 403 Forbidden

curl http://localhost:3000/admin/users \
  -H "Authorization: Bearer admin_token"
# Should return users list
```
