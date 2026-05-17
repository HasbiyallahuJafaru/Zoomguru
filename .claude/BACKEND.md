# ZoomGuru — Backend

## Stack
- **NestJS** with **Fastify adapter** (not Express)
- **@neondatabase/serverless** — direct SQL, no ORM, no Prisma
- **Render** — hosting (free tier to start, upgrade as needed)
- **Node.js 20+**

---

## Project Bootstrap

```bash
npm i -g @nestjs/cli
nest new backend --package-manager npm
cd backend

# Switch to Fastify
npm install @nestjs/platform-fastify

# Neon driver
npm install @neondatabase/serverless

# Auth
npm install @nestjs/jwt @nestjs/passport passport passport-jwt bcryptjs
npm install -D @types/bcryptjs @types/passport-jwt

# Paystack webhook verification
npm install crypto

# CV parsing
npm install pdf-parse mammoth

# Multipart file upload
npm install @fastify/multipart

# Environment
npm install @nestjs/config
```

---

## main.ts

```typescript
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import multipart from '@fastify/multipart';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false })
  );

  // Multipart for CV uploads
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB max

  app.enableCors({
    origin: [
      'https://zoomguru.com',
      'app://.',           // Electron production
      'http://localhost:5173' // Electron dev
    ],
    credentials: true,
  });

  // Init DB tables on startup
  const { initDB } = await import('./database/init');
  await initDB();

  await app.listen(process.env.PORT || 3000, '0.0.0.0');
  console.log(`ZoomGuru backend running on port ${process.env.PORT || 3000}`);
}
bootstrap();
```

---

## Module Structure

```
src/
├── main.ts
├── app.module.ts
├── database/
│   ├── db.ts              ← neon client singleton
│   └── init.ts            ← CREATE TABLE IF NOT EXISTS
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   └── jwt.strategy.ts
├── license/
│   ├── license.module.ts
│   ├── license.controller.ts
│   └── license.service.ts
├── ai/
│   ├── ai.module.ts
│   ├── ai.controller.ts
│   ├── ai.service.ts
│   └── question-router.ts
├── cv/
│   ├── cv.module.ts
│   ├── cv.controller.ts
│   └── cv.service.ts
├── session/
│   ├── session.module.ts
│   ├── session.controller.ts
│   └── session.service.ts
└── paystack/
    ├── paystack.module.ts
    ├── paystack.controller.ts
    └── paystack.service.ts
```

---

## database/db.ts

```typescript
import { neon } from '@neondatabase/serverless';

let _sql: ReturnType<typeof neon> | null = null;

export function getDB() {
  if (!_sql) {
    _sql = neon(process.env.DATABASE_URL!);
  }
  return _sql;
}
```

---

## API Endpoints

### Auth
```
POST /auth/register         → create account
POST /auth/login            → returns access_token + refresh_token
POST /auth/refresh          → rotate refresh token
POST /auth/logout           → invalidate refresh token
```

### License
```
GET  /license/verify        → check device fingerprint + pro status
POST /license/bind          → bind license to device on first login
```

### AI
```
POST /ai/stream             → SSE stream — text question answer
POST /ai/screenshot         → SSE stream — screenshot + optional voice
POST /ai/session/start      → create new interview session
POST /ai/session/end        → close session, save transcript
```

### CV
```
POST /cv/upload             → upload + parse CV (PDF or DOCX)
GET  /cv/profile            → get parsed CV profile for user
DELETE /cv/profile          → remove CV
```

### Paystack
```
POST /paystack/webhook      → Paystack event handler (public, HMAC verified)
POST /paystack/initialize   → create payment link for in-app payment
GET  /paystack/plans        → return pricing plans with Paystack plan codes
```

### Session
```
GET  /session/history       → list past interview sessions
GET  /session/:id           → get session transcript
DELETE /session/:id         → delete a session
```

---

## JWT Strategy

```typescript
// auth/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: any) {
    return { userId: payload.sub, email: payload.email };
  }
}
```

---

## Device Fingerprint Guard

Applied to every protected endpoint:

```typescript
// guards/device.guard.ts
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

    // Pro user — fingerprint must match
    if (license.device_fingerprint !== deviceId) {
      throw new ForbiddenException('License bound to different device');
    }

    return true;
  }
}
```

---

## SSE Streaming (ai.controller.ts)

```typescript
import { Controller, Post, Body, Res, UseGuards, Req } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DeviceGuard } from '../guards/device.guard';
import { AiService } from './ai.service';

@Controller('ai')
@UseGuards(JwtAuthGuard, DeviceGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('stream')
  async streamAnswer(
    @Body() body: { sessionId: string; transcript: string },
    @Req() req: any,
    @Res() reply: FastifyReply
  ) {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    await this.aiService.streamAnswer({
      userId: req.user.userId,
      sessionId: body.sessionId,
      transcript: body.transcript,
      reply: reply.raw,
    });
  }

  @Post('screenshot')
  async streamScreenshot(
    @Body() body: { sessionId: string; image: string; voiceContext?: string },
    @Req() req: any,
    @Res() reply: FastifyReply
  ) {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    await this.aiService.streamScreenshot({
      userId: req.user.userId,
      sessionId: body.sessionId,
      image: body.image,
      voiceContext: body.voiceContext,
      reply: reply.raw,
    });
  }
}
```

---

## Rate Limiting (Free Tier — Postgres Only)

```typescript
// ai.service.ts — before every AI call
async checkUsageLimit(userId: string): Promise<void> {
  const sql = getDB();

  const [user] = await sql`
    SELECT u.is_pro, uu.sessions_used, uu.responses_used
    FROM users u
    LEFT JOIN user_usage uu ON uu.user_id = u.id
    WHERE u.id = ${userId}
  `;

  // Pro users — skip all checks
  if (user.is_pro) return;

  // Free tier limits
  if (user.responses_used >= 10) {
    throw new ForbiddenException('Free tier limit reached. Upgrade to continue.');
  }
}

async incrementUsage(userId: string): Promise<void> {
  const sql = getDB();
  await sql`
    UPDATE user_usage
    SET responses_used = responses_used + 1
    WHERE user_id = ${userId}
  `;
}
```

---

## Environment Variables

```env
# .env (never commit this)
DATABASE_URL=postgresql://...neon.tech/zoomguru
JWT_SECRET=super_secret_jwt_key_change_this
JWT_REFRESH_SECRET=super_secret_refresh_key_change_this
DEEPSEEK_API_KEY=sk-...
QWEN_API_KEY=...
PAYSTACK_SECRET_KEY=sk_live_...
PAYSTACK_WEBHOOK_SECRET=...
PORT=3000
NODE_ENV=production
```

---

## Render Deployment

```yaml
# render.yaml
services:
  - type: web
    name: zoomguru-backend
    env: node
    buildCommand: npm install && npm run build
    startCommand: node dist/main.js
    envVars:
      - key: DATABASE_URL
        sync: false
      - key: JWT_SECRET
        sync: false
      - key: DEEPSEEK_API_KEY
        sync: false
      - key: QWEN_API_KEY
        sync: false
      - key: PAYSTACK_SECRET_KEY
        sync: false
      - key: PAYSTACK_WEBHOOK_SECRET
        sync: false
```
