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
  addSession, listSessions, touchSession, revokeSession, revokeAllSessions, deviceLabel, MAX_SESSIONS,
} = require('../dist/auth/sessions.js');

const uid = 'selfcheck-user';
const UA = 'Mozilla/5.0 (Windows NT 10.0) ZoomGuru/1.0';

assert.equal(deviceLabel(UA), 'Windows');
assert.equal(deviceLabel('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)'), 'Mac');
assert.equal(deviceLabel(undefined), 'Unknown device');

// Fills every slot.
const sids = [];
for (let i = 0; i < MAX_SESSIONS; i++) {
  const sid = await addSession(uid, `10.0.0.${i}`, UA);
  assert.ok(sid, `slot ${i} should be granted`);
  sids.push(sid);
}

// One past the cap is refused.
assert.equal(await addSession(uid, '10.0.0.99', UA), null, 'over-cap login must be refused');

// Everyone in a slot is listed, oldest first, with the caller's own marked.
const listed = await listSessions(uid, sids[0]);
assert.equal(listed.length, MAX_SESSIONS);
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

const reclaimed = await addSession(uid, '10.0.0.50', UA);
assert.ok(reclaimed, 'a freed slot must be reusable');
assert.equal(await addSession(uid, '10.0.0.51', UA), null, 'cap still holds after reclaim');

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

console.log('check-sessions: OK');
