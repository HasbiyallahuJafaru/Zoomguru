// Self-check for the concurrent-session cap.
//   npm run build && node scripts/check-sessions.mjs
//
// Runs against an in-memory stand-in for the handful of Redis hash commands
// sessions.ts uses, so it needs no server and no extra dependency. What it
// checks is the cap/prune/revoke branching, not ioredis.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const store = new Map(); // key -> Map(field -> value)
const hash = (k) => store.get(k) ?? store.set(k, new Map()).get(k);
const fakeRedis = {
  hgetall: async (k) => Object.fromEntries(hash(k)),
  hget: async (k, f) => hash(k).get(f) ?? null,
  hset: async (k, f, v) => { hash(k).set(f, v); return 1; },
  hdel: async (k, ...fs) => fs.reduce((n, f) => n + (hash(k).delete(f) ? 1 : 0), 0),
  hlen: async (k) => hash(k).size,
  pexpire: async () => 1,
  del: async (k) => (store.delete(k) ? 1 : 0),
};

require('../dist/redis/redis.js').getRedis = () => fakeRedis;

const {
  addSession, listSessions, touchSession, revokeSession, revokeAllSessions, deviceLabel, seatsForPlan,
} = require('../dist/auth/sessions.js');

const uid = 'selfcheck-user';
const UA = 'Mozilla/5.0 (Windows NT 10.0) ZoomGuru/1.0';

// Seats per plan. Anything unknown, lapsed or missing gets one seat.
assert.equal(seatsForPlan('weekly'), 1);
assert.equal(seatsForPlan('monthly'), 2);
assert.equal(seatsForPlan('yearly'), 2);
assert.equal(seatsForPlan(null), 1);
assert.equal(seatsForPlan(undefined), 1);
assert.equal(seatsForPlan(''), 1);
assert.equal(seatsForPlan('lifetime'), 1);

const SEATS = seatsForPlan('monthly');

assert.equal(deviceLabel(UA), 'Windows');
assert.equal(deviceLabel('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)'), 'Mac');
assert.equal(deviceLabel(undefined), 'Unknown device');

// Fills every slot.
const sids = [];
for (let i = 0; i < SEATS; i++) {
  const sid = await addSession(uid, `10.0.0.${i}`, UA, SEATS);
  assert.ok(sid, `slot ${i} should be granted`);
  sids.push(sid);
}

// One past the cap is refused.
assert.equal(await addSession(uid, '10.0.0.99', UA, SEATS), null, 'over-cap login must be refused');

// Everyone in a slot is listed, oldest first, with the caller's own marked.
const listed = await listSessions(uid, sids[0]);
assert.equal(listed.length, SEATS);
assert.deepEqual(listed.map((s) => s.sid), sids);
assert.equal(listed[0].current, true);
assert.equal(listed[1].current, false);
assert.equal(listed[0].ip, '10.0.0.0');
assert.equal(listed[0].device, 'Windows');

// A live session stays valid; a revoked one stops being honoured and frees its
// slot for the next login.
assert.equal(await touchSession(uid, sids[0]), true);
await revokeSession(uid, sids[0]);
assert.equal(await touchSession(uid, sids[0]), false, 'revoked session must be rejected');

const reclaimed = await addSession(uid, '10.0.0.50', UA, SEATS);
assert.ok(reclaimed, 'a freed slot must be reusable');
assert.equal(await addSession(uid, '10.0.0.51', UA, SEATS), null, 'cap still holds after reclaim');

// The same device signing in again reclaims its own slot rather than taking a
// second one — otherwise a client with no logout call locks itself out.
const beforeRetake = (await listSessions(uid)).length;
const retaken = await addSession(uid, '10.0.0.50', UA, SEATS);
assert.ok(retaken, 'same device must be able to sign in again at capacity');
assert.equal((await listSessions(uid)).length, beforeRetake, 'retake must not consume a slot');
assert.ok(!(await listSessions(uid)).some((s) => s.sid === reclaimed), 'old slot must be released');

// ...but a genuinely different device is still refused at capacity.
assert.equal(await addSession(uid, '10.0.0.77', UA, SEATS), null, 'third device still refused');

// A slot dies with the token that owns it, measured from login time. Being
// seen recently must NOT keep an expired token's slot alive: that would leave
// an unreclaimable seat and lock the account out after a couple of cycles.
const HOUR = 60 * 60 * 1000;
const expired = { ip: '10.0.0.7', device: 'Mac', at: Date.now() - 4 * HOUR, seen: Date.now() };
await fakeRedis.hset(`sess:${uid}`, 'expiredSid', JSON.stringify(expired));
assert.equal(await touchSession(uid, 'expiredSid'), false, 'expired token must not be honoured');
assert.ok(!(await listSessions(uid)).some((s) => s.sid === 'expiredSid'), 'expired slot must be pruned');

// ...and a token still inside its 3h window keeps its slot.
const fresh = { ip: '10.0.0.8', device: 'Mac', at: Date.now() - 2 * HOUR, seen: Date.now() - 2 * HOUR };
await fakeRedis.hset(`sess:${uid}`, 'freshSid', JSON.stringify(fresh));
assert.equal(await touchSession(uid, 'freshSid'), true, 'unexpired token must stay valid');
await revokeSession(uid, 'freshSid');

// Garbage in the hash is treated as dead, not crashed on.
await fakeRedis.hset(`sess:${uid}`, 'junkSid', 'not json');
assert.equal(await touchSession(uid, 'junkSid'), false);
assert.ok(!(await listSessions(uid)).some((s) => s.sid === 'junkSid'));

// A password reset clears every slot.
await revokeAllSessions(uid);
assert.deepEqual(await listSessions(uid), []);
assert.equal(await touchSession(uid, sids[1]), false, 'reset must sign every device out');

// ── Single-seat plans (weekly, trial, lapsed) ───────────────────────────────
// The newest login wins instead of being refused: at one seat the session
// being displaced is almost always this same person's older one.
const solo = 'selfcheck-weekly';
const first = await addSession(solo, '10.0.0.1', UA, 1);
assert.ok(first);
const second = await addSession(solo, '10.0.0.2', UA, 1);
assert.ok(second, 'a single-seat plan must never refuse a login');
assert.equal(await touchSession(solo, first), false, 'the older session must be signed out');
assert.equal((await listSessions(solo)).length, 1, 'a single-seat plan holds one session');

// Same-device takeover still runs first, so it costs no extra eviction pass.
const retakenSolo = await addSession(solo, '10.0.0.2', UA, 1);
assert.ok(retakenSolo);
assert.equal((await listSessions(solo)).length, 1);

// Eviction takes the OLDEST by login time, not an arbitrary entry, and clears
// every extra when an account drops from two seats to one.
await revokeAllSessions(solo);
const now = Date.now();
await fakeRedis.hset(`sess:${solo}`, 'oldSid', JSON.stringify({ ip: '10.0.0.3', device: 'Mac', at: now - 2 * HOUR, seen: now }));
await fakeRedis.hset(`sess:${solo}`, 'newerSid', JSON.stringify({ ip: '10.0.0.4', device: 'Mac', at: now - 1 * HOUR, seen: now }));
const downgraded = await addSession(solo, '10.0.0.5', UA, 1);
assert.ok(downgraded, 'a downgraded account must still be able to log in');
assert.deepEqual((await listSessions(solo)).map((s) => s.sid), [downgraded], 'both older sessions must go');

await revokeAllSessions(solo);

console.log('check-sessions: OK');
