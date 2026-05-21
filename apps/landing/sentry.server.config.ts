import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_GLITCHTIP_DSN || 'https://41222b9dc9e94a93b69db9367b692e76@app.glitchtip.com/23688',
  environment: process.env.NODE_ENV || 'production',
  release: '1.0.0',
  tracesSampleRate: 0.01,
});
