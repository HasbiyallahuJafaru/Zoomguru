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
    'DATABASE_URL', 'JWT_SECRET', 'GEMINI_API_KEY', 'DEEPSEEK_API_KEY', 'GROQ_API_KEY',
    'PAYSTACK_SECRET_KEY', 'RESEND_API_KEY', 'FROM_EMAIL',
  ];
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error('❌ Missing env vars:', missing.join(', '));
    process.exit(1);
  }

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false, trustProxy: true }),
    { rawBody: true },
  );

  app.enableCors({
    origin: (origin, callback) => {
      const appUrl = (process.env['APP_URL'] ?? '').replace(/\/$/, '');
      const adminCors = (process.env['ADMIN_CORS_ORIGIN'] ?? '').replace(/\/$/, '');
      const allowed = [
        'http://localhost:5173',
        'http://localhost:5174',
        'app://.',
        appUrl,
        adminCors,
      ].filter(Boolean);
      if (!origin || allowed.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  });

  await initDB();

  await app.listen(process.env['PORT'] ?? 3000, '0.0.0.0');

  console.log('✅ ZoomGuru backend: http://localhost:3000');
}

void bootstrap();
