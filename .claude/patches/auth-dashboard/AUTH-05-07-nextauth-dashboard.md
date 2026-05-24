# AUTH-05 â€” NextAuth Setup in Landing App

## What This Does
Installs and configures NextAuth v5 in the landing app.
Adds Google OAuth + credentials (username/email + password).
Sets up session storage in Neon.

## Files Affected
- `apps/landing/` (new files + package.json)

## Risk Level
ðŸŸ¡ MEDIUM â€” New auth layer. Test login/register after.

---

## Prompt

```
Read .claude/patches/auth-dashboard/AUTH-DASHBOARD.md first.

Tell me which files you will touch before writing any code.

We are adding NextAuth v5 to apps/landing.
Install dependencies first:

cd apps/landing
npm install next-auth@beta @auth/core
npm install @neondatabase/serverless

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
STEP 1 â€” Create apps/landing/auth.ts
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    Credentials({
      name: 'credentials',
      credentials: {
        identifier: { label: 'Email or Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.identifier || !credentials?.password) {
          return null;
        }

        const identifier = String(credentials.identifier)
          .toLowerCase().trim();

        const res = await fetch(
          process.env.NEXT_PUBLIC_API_URL + '/auth/login',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: identifier,
              password: credentials.password,
              deviceId: 'web',
            }),
          }
        );

        if (!res.ok) return null;
        const data = await res.json();

        return {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          username: data.user.username,
          isPro: data.user.isPro,
          role: data.user.role,
          image: data.user.avatarUrl,
          accessToken: data.accessToken,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.username = (user as any).username;
        token.isPro = (user as any).isPro;
        token.role = (user as any).role;
        token.accessToken = (user as any).accessToken;
      }
      if (account?.provider === 'google') {
        // Call backend to create/get user for Google OAuth
        const res = await fetch(
          process.env.NEXT_PUBLIC_API_URL + '/auth/google/web',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              googleId: account.providerAccountId,
              email: token.email,
              name: token.name,
              avatar: token.picture,
            }),
          }
        );
        if (res.ok) {
          const data = await res.json();
          token.id = data.user.id;
          token.username = data.user.username;
          token.isPro = data.user.isPro;
          token.role = data.user.role;
          token.accessToken = data.accessToken;
        }
      }
      return token;
    },

    async session({ session, token }) {
      session.user.id = token.id as string;
      (session.user as any).username = token.username;
      (session.user as any).isPro = token.isPro;
      (session.user as any).role = token.role;
      (session.user as any).accessToken = token.accessToken;
      return session;
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET,
});

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
STEP 2 â€” Create apps/landing/app/api/auth/[...nextauth]/route.ts
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

import { handlers } from '../../../../auth';
export const { GET, POST } = handlers;

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
STEP 3 â€” Add auth middleware
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

Create apps/landing/middleware.ts:

import { auth } from './auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isDashboard = req.nextUrl.pathname.startsWith('/dashboard');
  const isAuthPage = req.nextUrl.pathname === '/login' ||
    req.nextUrl.pathname === '/register';

  if (isDashboard && !isLoggedIn) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (isAuthPage && isLoggedIn) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/register'],
};

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
STEP 4 â€” Add to .env.local
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

NEXTAUTH_SECRET=generate_64_chars_with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
NEXTAUTH_URL=https://zoomguru.xyz
DATABASE_URL=same_as_backend
GOOGLE_CLIENT_ID=from_google_cloud
GOOGLE_CLIENT_SECRET=from_google_cloud
NEXT_PUBLIC_API_URL=https://api.zoomguru.xyz

Show me all created files. Do not modify any existing files.
```

---

# AUTH-06 â€” Login + Register Pages

## Prompt

```
Read .claude/patches/auth-dashboard/AUTH-DASHBOARD.md first.

Create these two pages in apps/landing/app/.
Match the existing landing page dark theme exactly.
Use the same CSS variables and font (Syne).

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
FILE 1: apps/landing/app/login/page.tsx
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

'use client';
import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

Dark themed login page with:
  - ZoomGuru logo/wordmark at top
  - "Continue with Google" button (calls signIn('google'))
  - Divider "or"
  - Input: Email or username
  - Input: Password
  - "Sign In" button (calls signIn('credentials', {...}))
  - Link: "Don't have an account? Register"
  - Link: "Forgot password?" (placeholder for now)
  - Error state shown below form if login fails
  - Loading state on button while signing in
  - Centered card, dark background matching landing page

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
FILE 2: apps/landing/app/register/page.tsx
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

'use client';
Registration page with:
  - ZoomGuru logo/wordmark at top
  - "Continue with Google" button (signIn('google'))
  - Divider "or"
  - Input: Full name
  - Input: Username (shows availability check on blur)
  - Input: Email
  - Input: Password (show strength indicator)
  - Input: Confirm password
  - "Create Account" button
  - On submit: POST to /api/register (Next.js API route)
    then signIn('credentials') automatically
  - Link: "Already have an account? Sign In"
  - Error state display

Create apps/landing/app/api/register/route.ts:
  Receives: name, username, email, password, refCode
  Calls: POST ${NEXT_PUBLIC_API_URL}/auth/register
  Returns: success/error

Same dark theme as landing page.
No new external dependencies.
Show me all created files.
```

---

# AUTH-07 â€” User Dashboard Layout + Home Page

## Prompt

```
Read .claude/patches/auth-dashboard/AUTH-DASHBOARD.md first.

Create the dashboard layout and home page in apps/landing/app/dashboard/.

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
FILE 1: apps/landing/app/dashboard/layout.tsx
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

Dashboard shell with:
  Left sidebar (desktop) / bottom nav (mobile):
    â”œâ”€â”€ ZoomGuru logo + username at top
    â”œâ”€â”€ Navigation links:
    â”‚   Overview (/)
    â”‚   Subscription (/subscription)
    â”‚   Payments (/payments)
    â”‚   Sessions (/sessions)
    â”‚   Referrals (/referrals)
    â”‚   Settings (/settings)
    â””â”€â”€ Sign Out button at bottom

  Main content area (children)

Dark theme matching landing page.
Sidebar collapses to icons on narrow screens.
Active route highlighted.
Uses next-auth session for user info.

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
FILE 2: apps/landing/app/dashboard/page.tsx
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

Dashboard home showing:

Row 1 â€” Status cards (4 cards):
  â”œâ”€â”€ Plan: Free / Pro Monthly / Pro Lifetime
  â”œâ”€â”€ Sessions used: X total
  â”œâ”€â”€ Questions answered: X total
  â””â”€â”€ Referral earnings: â‚¦X pending

Row 2 â€” Recent sessions list:
  Last 5 interview sessions
  Shows: date, duration, questions, interview type, summary snippet
  "View all sessions" link

Row 3 â€” Quick actions:
  â”œâ”€â”€ Download App button (if pro)
  â”œâ”€â”€ Upgrade button (if free)
  â”œâ”€â”€ Copy referral link button
  â””â”€â”€ View subscription button

All data fetched from:
  GET ${API_URL}/user/dashboard-summary
  Protected with session accessToken

Add this endpoint to backend auth.controller.ts:
  @Get('user/dashboard-summary')
  @UseGuards(JwtAuthGuard)
  async getDashboardSummary(@Request() req: any) {
    return this.authService.getDashboardSummary(req.user.userId);
  }

And in auth.service.ts, add getDashboardSummary() that queries:
  - User plan + status
  - Total sessions count
  - Total questions count
  - Referral pending balance
  - Last 5 sessions (id, type, duration, total_questions,
    summary, started_at)

Show me all files created and the backend additions.
```

