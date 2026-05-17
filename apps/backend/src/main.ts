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
