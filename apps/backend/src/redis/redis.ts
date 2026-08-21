import Redis from 'ioredis';

let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (!_redis) {
    if (!process.env.REDIS_URL) {
      throw new Error('REDIS_URL not set');
    }
    _redis = new Redis(process.env.REDIS_URL, {
      // Dual-stack lookup. Railway's private network (*.railway.internal)
      // resolves over IPv6; ioredis would otherwise do an IPv4-only lookup
      // and fail with ENOTFOUND.
      family: 0,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      keepAlive: 30_000,
      connectTimeout: 2_000,
      commandTimeout: 500,
    });
    _redis.on('error', (err) => {
      console.error('[Redis] client error:', err.message);
    });
  }
  return _redis;
}
