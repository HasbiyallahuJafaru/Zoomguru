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
      max: 12,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
    });

    // Prevent idle connection errors from crashing the process.
    // Neon serverless closes WebSocket connections after inactivity;
    // without this handler Node.js throws an uncaught error and exits.
    _pool.on('error', (err) => {
      console.error('[DB pool] idle client error:', err.message);
    });
  }
  return _pool;
}
