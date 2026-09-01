import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import {
  NestFastifyApplication,
  FastifyAdapter,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { initDB } from './database/init';

async function bootstrap(): Promise<void> {
  const REQUIRED = [
    'DATABASE_URL', 'JWT_SECRET', 'REDIS_URL', 'GEMINI_API_KEY', 'GROQ_API_KEY',
    'PAYSTACK_SECRET_KEY', 'RESEND_API_KEY', 'FROM_EMAIL', 'ADMIN_KEY',
  ];
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error('❌ Missing env vars:', missing.join(', '));
    process.exit(1);
  }

  if (!process.env['DATABASE_POOL_URL'] && process.env['NODE_ENV'] === 'production') {
    console.error('❌ DATABASE_POOL_URL is required in production');
    process.exit(1);
  }

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    // 4 MB. The only large body is a screenshot at 1280x720: measured base64 is
    // ~50-90 KB as JPEG and ~80-200 KB as PNG from an old client, so 4 MB is a
    // wide safety margin over anything the app can actually produce. 15 MB let
    // one request buffer far more than that, and Fastify buffers the whole body
    // before the 10 MB guard in ai.controller.ts even runs.
    new FastifyAdapter({ logger: false, trustProxy: true, bodyLimit: 4_194_304 }),
    { rawBody: true },
  );

  app.enableCors({
    origin: (origin, callback) => {
      const appUrl = (process.env['APP_URL'] ?? '').replace(/\/$/, '');
      const adminCors = (process.env['ADMIN_CORS_ORIGIN'] ?? '').replace(/\/$/, '');
      const checkoutUrl = (process.env['CHECKOUT_URL'] ?? 'https://zoomguru.xyz').replace(/\/$/, '');
      const allowed = [
        'http://localhost:5173',
        'http://localhost:5174',
        'app://.',
        appUrl,
        adminCors,
        // Hosted checkout page (zoomguru.xyz) calls /payments/session + /confirm.
        checkoutUrl,
        'https://zoomguru.xyz',
        'https://www.zoomguru.xyz',
      ].filter(Boolean);
      if (!origin || allowed.includes(origin) || origin === 'app://zoomguru') {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  });

  // Fire-and-forget: the server must start listening (and answer /health)
  // even if the database is temporarily unreachable. initDB() never throws —
  // it retries the schema setup in the background until it succeeds.
  void initDB();

  await app.listen(process.env['PORT'] ?? 3000, '0.0.0.0');

  console.log('✅ ZoomGuru backend: http://localhost:3000');
}

void bootstrap();
