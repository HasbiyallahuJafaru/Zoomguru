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
  // Deliberately pages: returns one key at a time so countOnline's cursor loop
  // is exercised, not short-circuited by a single all-in-one reply.
  scan: async (cursor, _m, pattern, _c, _n) => {
    const re = new RegExp('^' + pattern.replace('*', '.*') + '$');
    const keys = [...store.keys()].filter((k) => re.test(k));
    const i = Number(cursor);
    if (i >= keys.length) return ['0', []];
    const next = i + 1;
    return [next >= keys.length ? '0' : String(next), [keys[i]]];
  },
};

require('../dist/redis/redis.js').getRedis = () => fakeRedis;

const {
  addSession, listSessions, touchSession, revokeSession, revokeAllSessions, deviceLabel, seatsForPlan,
  countOnline,
} = require('../dist/auth/sessions.js');

const uid = 'selfcheck-user';
const UA = 'Mozilla/5.0 (Windows NT 10.0) ZoomGuru/1.0';

// Weekly seats one computer; monthly and yearly seat two. No active plan → one.
assert.equal(seatsForPlan('weekly'), 1);
assert.equal(seatsForPlan('monthly'), 2);
assert.equal(seatsForPlan('yearly'), 2);
assert.equal(seatsForPlan(null), 1);
assert.equal(seatsForPlan(undefined), 1);
assert.equal(seatsForPlan(''), 1);

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

// The point of two seats: two computers behind one router share a public IP and
// the same OS label. They must both hold a slot, not evict each other.
await revokeAllSessions(uid);
const pcA = await addSession(uid, '203.0.113.9', UA, SEATS);
const pcB = await addSession(uid, '203.0.113.9', UA, SEATS);
assert.ok(pcA && pcB, 'two computers on one IP must both get a seat');
assert.notEqual(pcA, pcB);
assert.equal(await touchSession(uid, pcA), true, 'the first computer must stay signed in');
assert.equal((await listSessions(uid)).length, 2);

// ...and a third on that same IP is still refused rather than evicting anyone.
assert.equal(await addSession(uid, '203.0.113.9', UA, SEATS), null, 'third device still refused');
assert.equal(await touchSession(uid, pcA), true, 'a refused login must not displace a seat');

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

// ── countOnline: who has the app open right now ─────────────────────────────
// Reads the `seen` stamp the cap already maintains, so the thing under test is
// the window and the per-user de-duplication, not any new tracking.
{
  store.clear();
  const t = Date.now();
  const MIN = 60 * 1000;
  const sess = (seenAgo, atAgo = 0) =>
    JSON.stringify({ ip: '10.0.0.1', device: 'Windows', at: t - atAgo, seen: t - seenAgo });

  assert.equal(await countOnline(), 0, 'no sessions means nobody online');

  // Two devices, one person — must count as ONE user online.
  await fakeRedis.hset('sess:u1', 'a', sess(10 * 1000));
  await fakeRedis.hset('sess:u1', 'b', sess(30 * 1000));
  assert.equal(await countOnline(), 1, 'two devices of one user is one user online');

  // A second person, freshly seen.
  await fakeRedis.hset('sess:u2', 'a', sess(2 * MIN));
  assert.equal(await countOnline(), 2, 'a second active user must be counted');

  // Signed in but idle past the window — has a valid token, is not "online".
  await fakeRedis.hset('sess:u3', 'a', sess(20 * MIN));
  assert.equal(await countOnline(), 2, 'a session idle past the window is not online');

  // One stale device does not hide a user whose other device is live.
  await fakeRedis.hset('sess:u3', 'b', sess(5 * 1000));
  assert.equal(await countOnline(), 3, 'a live device must count even when a sibling is stale');

  // Corrupt entries must not throw or inflate the count.
  await fakeRedis.hset('sess:u4', 'a', 'not json');
  assert.equal(await countOnline(), 3, 'unparseable sessions must be ignored, not counted');

  // Unrelated keys in the same keyspace must not be scanned in.
  store.set('rl:u1', new Map([['x', '1']]));
  store.set('dcc:abc', new Map([['y', '2']]));
  assert.equal(await countOnline(), 3, 'only sess:* keys may be counted');
}

// Redis down must read as 0 rather than throwing into the admin endpoint.
{
  const boom = new Proxy({}, { get: () => async () => { throw new Error('redis down'); } });
  require('../dist/redis/redis.js').getRedis = () => boom;
  assert.equal(await countOnline(), 0, 'redis down must return 0, not throw');
  require('../dist/redis/redis.js').getRedis = () => fakeRedis;
}

console.log('check-sessions: OK');
