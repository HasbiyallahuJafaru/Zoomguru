import Redis from 'ioredis';

let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (!_redis) {
    if (!process.env.REDIS_URL) {
      throw new Error('REDIS_URL not set');
    }
    _redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: false,
      keepAlive: 30_000,
      connectTimeout: 5_000,
    });
    _redis.on('error', (err) => {
      console.error('[Redis] client error:', err.message);
    });
  }
  return _redis;
}
