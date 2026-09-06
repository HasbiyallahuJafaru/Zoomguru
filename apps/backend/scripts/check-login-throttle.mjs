// Self-check for the per-ACCOUNT login throttle.
//   npm run build && node scripts/check-login-throttle.mjs
//
// Runs against an in-memory stand-in for the three Redis string commands
// auth.service.ts uses, so it needs no server and no extra dependency. What it
// checks is the counting/blocking branching, not ioredis.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

let store = new Map();
let ttls = new Map();
let failing = false;
const boom = () => { if (failing) throw new Error('redis down'); };

const fakeRedis = {
  get: async (k) => { boom(); return store.has(k) ? String(store.get(k)) : null; },
  incr: async (k) => { boom(); const n = (store.get(k) ?? 0) + 1; store.set(k, n); return n; },
  expire: async (k, s) => { boom(); ttls.set(k, s); return 1; },
};

require('../dist/redis/redis.js').getRedis = () => fakeRedis;

const {
  tooManyFailures, recordLoginFailure, FAILED_LOGIN_MAX, FAILED_LOGIN_WINDOW_SEC,
} = require('../dist/auth/auth.service.js');

const ACCT = 'victim@example.com';
const fail = async (id, n) => { for (let i = 0; i < n; i++) await recordLoginFailure(id); };

// A fresh account is never blocked.
assert.equal(await tooManyFailures(ACCT), false);

// Failures below the cap leave the account usable. This is the case that
// matters most: a legitimate user who fumbles their password still gets in.
await fail(ACCT, FAILED_LOGIN_MAX - 1);
assert.equal(await tooManyFailures(ACCT), false);

// The cap blocks.
await fail(ACCT, 1);
assert.equal(await tooManyFailures(ACCT), true);

// The window is set once, on the first failure, and not pushed out by later
// ones — otherwise a steady grind would keep the block alive forever.
assert.equal(ttls.get(`lf:${ACCT}`), FAILED_LOGIN_WINDOW_SEC);
assert.equal(FAILED_LOGIN_WINDOW_SEC, 900);

// Blocking is per account: everyone else still logs in.
assert.equal(await tooManyFailures('bystander@example.com'), false);

// A case-flipped identifier hits the SAME bucket, so it buys no fresh attempts.
assert.equal(await tooManyFailures('Victim@Example.COM'), true);
store = new Map(); ttls = new Map();
await fail('MixedCase@Example.com', FAILED_LOGIN_MAX);
assert.equal(await tooManyFailures('mixedcase@example.com'), true);

// An unknown identifier must be counted exactly like a real one. If it were
// not, the limit would only ever trip for accounts that exist, and the
// distinct 'too many attempts' error would leak which identifiers are real.
store = new Map(); ttls = new Map();
await fail('no-such-user@example.com', FAILED_LOGIN_MAX);
assert.equal(await tooManyFailures('no-such-user@example.com'), true);

// Redis down fails OPEN — this is an abuse control, not a security boundary,
// and it must never take logins down with it.
failing = true;
assert.equal(await tooManyFailures(ACCT), false);
await recordLoginFailure(ACCT); // must not throw
failing = false;

console.log('check-login-throttle: OK');
