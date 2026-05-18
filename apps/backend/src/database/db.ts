import { neon, neonConfig, Pool } from '@neondatabase/serverless';

// Enable connection pooling
neonConfig.poolQueryViaFetch = true;

// Singleton pool for connection pooling
let _pool: Pool | null = null;

export function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return _pool;
}

// Keep getDB() for backward compatibility —
// existing code using sql`` tagged templates still works
let _sql: ReturnType<typeof neon> | null = null;

export function getDB(): ReturnType<typeof neon> {
  if (!_sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable not set');
    }
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql;
}
