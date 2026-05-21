import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.GLITCHTIP_DSN || 'https://41222b9dc9e94a93b69db9367b692e76@app.glitchtip.com/23688',
  environment: process.env.NODE_ENV || 'production',
  release: '1.0.0',
  tracesSampleRate: 0.01,
});

import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import multipart from '@fastify/multipart';

async function bootstrap() {
  // Validate required environment variables on startup
  const REQUIRED_ENV = [
    'DATABASE_URL',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'DEEPSEEK_API_KEY',
    'PAYSTACK_SECRET_KEY',
    'PAYSTACK_WEBHOOK_SECRET',
    'ADMIN_SECRET_KEY',
  ];

  const missing = REQUIRED_ENV.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    process.exit(1);
  }

  console.log('✅ All environment variables present');

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false })
  );

  // init() triggers NestJS to register its own application/json parser. We call it explicitly
  // here so we can then replace that parser with our rawBody-capturing version before listen().
  await app.init();

  // Capture raw body so Paystack webhook HMAC can verify against original bytes.
  const fastify = app.getHttpAdapter().getInstance() as any;
  fastify.removeContentTypeParser('application/json');
  fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req: any, body: Buffer, done: any) => {
    req.rawBody = body;
    try {
      done(null, JSON.parse(body.toString('utf8')));
    } catch (e: any) {
      e.statusCode = 400;
      done(e);
    }
  });

  // Multipart for CV uploads
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB max

  const ALLOWED_ORIGINS = [
    'https://zoomguru.com',
    'app://.',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:3001',
  ];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // server-to-server / curl
      if (
        ALLOWED_ORIGINS.includes(origin) ||
        /\.vercel\.app$/.test(origin)        // all vercel preview + production URLs
      ) {
        return callback(null, true);
      }
      callback(new Error('CORS: origin not allowed'), false);
    },
    credentials: true,
  });

  // Init DB tables on startup
  const { initDB } = await import('./database/init');
  await initDB();

  // Global unhandled error catcher
  process.on('uncaughtException', async (err) => {
    Sentry.captureException(err);
    try {
      const { AdminService } = await import('./admin/admin.service');
      const adminService = app.get(AdminService);
      await adminService.logError({
        errorMessage: err.message,
        stackTrace: err.stack,
      });
    } catch {
      // Don't let logging failure crash the process
    }
    console.error('Uncaught exception:', err);
  });

  await app.listen(process.env.PORT || 3000, '0.0.0.0');
  console.log(`ZoomGuru backend running on port ${process.env.PORT || 3000}`);
}
bootstrap();
