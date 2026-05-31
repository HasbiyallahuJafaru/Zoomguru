import { Pool } from '@neondatabase/serverless';

let _pool: Pool | null = null;

export function getDB(): Pool {
  if (!_pool) {
    const connectionString = process.env.DATABASE_POOL_URL ?? process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL not set');
    }
    _pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return _pool;
}
