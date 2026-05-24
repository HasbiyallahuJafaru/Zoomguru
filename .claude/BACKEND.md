# ZoomGuru â€” Backend

## Stack
- **NestJS** with **Fastify adapter** (not Express)
- **@neondatabase/serverless** â€” direct SQL, no ORM, no Prisma
- **Render** â€” hosting (free tier to start, upgrade as needed)
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
      'https://zoomguru.xyz',
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
â”œâ”€â”€ main.ts
â”œâ”€â”€ app.module.ts
â”œâ”€â”€ database/
â”‚   â”œâ”€â”€ db.ts              â† neon client singleton
â”‚   â””â”€â”€ init.ts            â† CREATE TABLE IF NOT EXISTS
â”œâ”€â”€ auth/
â”‚   â”œâ”€â”€ auth.module.ts
â”‚   â”œâ”€â”€ auth.controller.ts
â”‚   â”œâ”€â”€ auth.service.ts
â”‚   â””â”€â”€ jwt.strategy.ts
â”œâ”€â”€ license/
â”‚   â”œâ”€â”€ license.module.ts
â”‚   â”œâ”€â”€ license.controller.ts
â”‚   â””â”€â”€ license.service.ts
â”œâ”€â”€ ai/
â”‚   â”œâ”€â”€ ai.module.ts
â”‚   â”œâ”€â”€ ai.controller.ts
â”‚   â”œâ”€â”€ ai.service.ts
â”‚   â””â”€â”€ question-router.ts
â”œâ”€â”€ cv/
â”‚   â”œâ”€â”€ cv.module.ts
â”‚   â”œâ”€â”€ cv.controller.ts
â”‚   â””â”€â”€ cv.service.ts
â”œâ”€â”€ session/
â”‚   â”œâ”€â”€ session.module.ts
â”‚   â”œâ”€â”€ session.controller.ts
â”‚   â””â”€â”€ session.service.ts
â””â”€â”€ paystack/
    â”œâ”€â”€ paystack.module.ts
    â”œâ”€â”€ paystack.controller.ts
    â””â”€â”€ paystack.service.ts
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
POST /auth/register         â†’ create account
POST /auth/login            â†’ returns access_token + refresh_token
POST /auth/refresh          â†’ rotate refresh token
POST /auth/logout           â†’ invalidate refresh token
```

### License
```
GET  /license/verify        â†’ check device fingerprint + pro status
POST /license/bind          â†’ bind license to device on first login
```

### AI
```
POST /ai/stream             â†’ SSE stream â€” text question answer
POST /ai/screenshot         â†’ SSE stream â€” screenshot + optional voice
POST /ai/session/start      â†’ create new interview session
POST /ai/session/end        â†’ close session, save transcript
```

### CV
```
POST /cv/upload             â†’ upload + parse CV (PDF or DOCX)
GET  /cv/profile            â†’ get parsed CV profile for user
DELETE /cv/profile          â†’ remove CV
```

### Paystack
```
POST /paystack/webhook      â†’ Paystack event handler (public, HMAC verified)
POST /paystack/initialize   â†’ create payment link for in-app payment
GET  /paystack/plans        â†’ return pricing plans with Paystack plan codes
```

### Session
```
GET  /session/history       â†’ list past interview sessions
GET  /session/:id           â†’ get session transcript
DELETE /session/:id         â†’ delete a session
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

    // New user â€” no license yet (free tier)
    if (!license) return true;

    // Pro user â€” fingerprint must match
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

## Rate Limiting (Free Tier â€” Postgres Only)

```typescript
// ai.service.ts â€” before every AI call
async checkUsageLimit(userId: string): Promise<void> {
  const sql = getDB();

  const [user] = await sql`
    SELECT u.is_pro, uu.sessions_used, uu.responses_used
    FROM users u
    LEFT JOIN user_usage uu ON uu.user_id = u.id
    WHERE u.id = ${userId}
  `;

  // Pro users â€” skip all checks
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

