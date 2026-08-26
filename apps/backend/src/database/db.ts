import { Pool } from 'pg';

let _pool: Pool | null = null;

export function getDB(): Pool {
  if (!_pool) {
    const raw = process.env.DATABASE_POOL_URL ?? process.env.DATABASE_URL;
    if (!raw) {
      throw new Error('DATABASE_URL not set');
    }
    // Strip any sslmode param from the URL: pg lets the connection string's
    // sslmode override the ssl option below, and `sslmode=require` forces cert
    // verification, which fails against Supabase's pooler ("self-signed
    // certificate in certificate chain"). Removing it lets our ssl config win.
    const connectionString = raw.replace(/[?&]sslmode=[^&]*/gi, '');
    _pool = new Pool({
      connectionString,
      max: process.env.DATABASE_POOL_URL ? 20 : 12,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      // A local Postgres runs with ssl=off, and forcing SSL there fails with
      // "The server does not support SSL connections" — which made running the
      // backend against a local database impossible. Loopback only; every
      // hosted URL still gets SSL.
      ssl: /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString) ? false : { rejectUnauthorized: false },
    });

    // Prevent idle connection errors from crashing the process.
    // The pool may drop connections after inactivity; without this handler
    // Node.js throws an uncaught error and exits.
    _pool.on('error', (err: Error) => {
      console.error('[DB pool] idle client error:', err.message);
    });
  }
  return _pool;
}
