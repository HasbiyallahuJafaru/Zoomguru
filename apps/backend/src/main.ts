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
    'QWEN_API_KEY',
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

  // Global unhandled error catcher
  process.on('uncaughtException', async (err) => {
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
