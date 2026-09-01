// Self-check for the cron jobs' scaling behaviour.
//   npm run build && node scripts/check-cron.mjs
//
// Two things are checked, both branching rather than infrastructure:
//   1. flushSessionLogQueue drains atomically — one tick pops exactly BATCH
//      entries and inserts exactly those, with no entry written twice even when
//      two ticks overlap.
//   2. The two email jobs take a pg advisory lock, so with N replicas ticking
//      at once the body runs once.
//
// Redis and Postgres are in-memory stand-ins covering only the handful of
// commands these jobs use, so this needs no server and no extra dependency.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// --- fake Redis: just the list, with rpop's count arg (Redis 6.2+) ---
const list = []; // index 0 is the head, as lpush leaves it
const fakeRedis = {
  lpush: async (_k, v) => list.unshift(v),
  llen: async () => list.length,
  rpop: async (_k, count) => {
    if (list.length === 0) return null;
    // Splice off the tail, oldest first — same order the real RPOP returns.
    return list.splice(Math.max(0, list.length - count)).reverse();
  },
};

// --- fake Postgres: advisory locks and a row sink ---
const held = new Set();
const inserted = [];
let followUpQueries = 0;
const fakePool = {
  query: async (sql, params) => {
    if (sql.includes('pg_try_advisory_lock')) {
      const key = params[0];
      if (held.has(key)) return { rows: [{ ok: false }] };
      held.add(key);
      return { rows: [{ ok: true }] };
    }
    if (sql.includes('pg_advisory_unlock')) {
      held.delete(params[0]);
      return { rows: [{ ok: true }] };
    }
    if (sql.includes('INSERT INTO ai_sessions')) {
      for (let i = 0; i < params.length; i += 3) inserted.push(params[i]);
      return { rowCount: params.length / 3 };
    }
    if (sql.includes('FROM users u')) {
      followUpQueries++;
      // Yield, so a concurrent replica gets its turn at the lock while we hold it.
      await new Promise((r) => setImmediate(r));
      return { rows: [{ email: 'a@b.c', name: 'A' }] };
    }
    return { rows: [] };
  },
};

require('../dist/redis/redis.js').getRedis = () => fakeRedis;
require('../dist/database/db.js').getDB = () => fakePool;

const { CronService } = require('../dist/cron/cron.service.js');

let emailsSent = 0;
const fakeEmail = { sendFollowUp: async () => { emailsSent++; } };
const cron = new CronService(fakeEmail, {});

// --- 1. the queue drains atomically and exactly once ---
const BATCH = 1000;
const ENQUEUED = 5000;
for (let i = 0; i < ENQUEUED; i++) {
  await fakeRedis.lpush('session_log_queue', JSON.stringify({ userId: `u${i}`, type: 'stream', ts: Date.now() }));
}

await cron.flushSessionLogQueue();
assert.equal(await fakeRedis.llen(), ENQUEUED - BATCH, 'one tick pops exactly BATCH');
assert.equal(inserted.length, BATCH, 'one tick inserts exactly what it popped');
assert.equal(inserted[0], 'u0', 'oldest entry drains first');

// Two overlapping ticks: rpop is atomic, so neither sees the other's entries.
await Promise.all([cron.flushSessionLogQueue(), cron.flushSessionLogQueue()]);
assert.equal(await fakeRedis.llen(), ENQUEUED - 3 * BATCH, 'overlapping ticks do not re-pop');
assert.equal(new Set(inserted).size, inserted.length, 'no entry inserted twice');

// Drains to empty, and an empty tick is a no-op.
while ((await fakeRedis.llen()) > 0) await cron.flushSessionLogQueue();
assert.equal(inserted.length, ENQUEUED, 'every enqueued entry is written exactly once');
await cron.flushSessionLogQueue();
assert.equal(inserted.length, ENQUEUED, 'empty queue inserts nothing');

// --- 2. the advisory lock lets exactly one replica run the job ---
const replicas = [new CronService(fakeEmail, {}), new CronService(fakeEmail, {}), new CronService(fakeEmail, {})];
await Promise.all(replicas.map((r) => r.sendNoPaymentFollowUps()));
assert.equal(followUpQueries, 1, 'only one replica runs the follow-up job body');
assert.equal(emailsSent, 1, 'no duplicate email to a real customer');

// The lock is released, so the next tick runs.
assert.equal(held.size, 0, 'lock released in finally');
await cron.sendNoPaymentFollowUps();
assert.equal(followUpQueries, 2, 'a later tick acquires the lock again');

// A throwing body still releases the lock.
const boom = new CronService({ sendFollowUp: () => { throw new Error('boom'); } }, {});
await boom.sendNoPaymentFollowUps();
assert.equal(held.size, 0, 'lock released even when the body throws');

console.log('check-cron: OK');
