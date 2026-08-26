// Self-check for the quota gate on /ai/stream and /ai/screenshot.
//   npm run build && node scripts/check-quota.mjs
//
// checkQuota() spends a quota unit as part of asking, so it must run only
// AFTER every cheaper gate has passed. This pins that ordering, plus the
// counting behaviour underneath it, against in-memory stand-ins for Redis and
// Postgres — no server, no extra dependency.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// ── Stand-ins ───────────────────────────────────────────────────────────────
const kv = new Map();
const fakeRedis = {
  get: async (k) => kv.get(k) ?? null,
  lpush: async () => 1,
  pipeline() {
    const ops = [];
    const p = {
      incr(k) { ops.push(() => { const v = Number(kv.get(k) ?? 0) + 1; kv.set(k, String(v)); return v; }); return p; },
      expire() { ops.push(() => 1); return p; },
      ttl() { ops.push(() => 60); return p; },
      exec: async () => ops.map((f) => [null, f()]),
    };
    return p;
  },
};

const usage = new Map(); // userId -> { copilot_requests }
let dbQueries = 0;
let dbDown = false;
const fakePool = {
  query: async (sql, params) => {
    if (dbDown) throw new Error('connection terminated');
    dbQueries++;
    const q = sql.trim();
    const uid = params[0];
    if (q.startsWith('INSERT INTO usage')) {
      if (!usage.has(uid)) usage.set(uid, { copilot_requests: 0 });
      return { rows: [] };
    }
    if (q.startsWith('UPDATE usage')) {
      const row = usage.get(uid);
      if (!row || row.copilot_requests >= params[1]) return { rows: [] };
      row.copilot_requests += 1;
      return { rows: [{ val: row.copilot_requests }] };
    }
    if (q.startsWith('SELECT')) {
      const row = usage.get(uid);
      return { rows: row ? [{ val: row.copilot_requests }] : [] };
    }
    throw new Error(`unexpected SQL: ${q}`);
  },
};

require('../dist/redis/redis.js').getRedis = () => fakeRedis;
require('../dist/database/db.js').getDB = () => fakePool;

const { AiController } = require('../dist/ai/ai.controller.js');
const { QuotaService, CAPPED_PLANS } = require('../dist/quota/quota.service.js');

// ── Controller harness ──────────────────────────────────────────────────────
const UID = 'quota-selfcheck-user';
const PERIOD_START = new Date(); // day 0 of the billing period
const CAP_KEY = `cap:${UID}:0`;
const SESSION_CAP_DAILY = 150;

function makeReply() {
  const reply = {
    sent: [],
    streamed: false,
    _code: 200,
    raw: { on() {}, writeHead() {}, write() {}, end() {} },
    code(n) { reply._code = n; return reply; },
    async send(body) { reply.sent.push({ code: reply._code, body }); },
  };
  return reply;
}

// Counts calls so "was quota even asked for?" is directly assertable.
function makeQuotaSpy(result) {
  return {
    calls: 0,
    async checkQuota() {
      this.calls++;
      if (result instanceof Error) throw result;
      return result;
    },
  };
}

const ALLOWED = { allowed: true, planType: 'monthly', feature: 'copilot_requests', limit: 120, used: 1, resetAt: '' };
const REFUSED = { allowed: false, planType: 'monthly', feature: 'copilot_requests', limit: 120, used: 120, resetAt: '' };

function makeController(quota) {
  let streamed = 0;
  const controller = new AiController(
    {
      streamAnswer: async () => { streamed++; },
      streamScreenshot: async () => { streamed++; },
    },
    { checkAccess: async () => ({ canUse: true, plan: 'monthly', periodStart: PERIOD_START, subActive: true }) },
    { verifySignature: async () => ({ valid: true }) },
    quota,
  );
  return { controller, streams: () => streamed };
}

const req = { user: { userId: UID, email: 'q@example.com' } };

async function callStream(quota) {
  const { controller, streams } = makeController(quota);
  const reply = makeReply();
  await controller.stream(req, { transcript: 'hello' }, reply, 'key', '1', 'sig');
  return { reply, streamed: streams() };
}

async function callScreenshot(quota) {
  const { controller, streams } = makeController(quota);
  const reply = makeReply();
  await controller.screenshot(req, { image: 'AAAA' }, reply, 'key', '1', 'sig');
  return { reply, streamed: streams() };
}

// A refused request must not spend quota — the whole point of this file.
for (const call of [callStream, callScreenshot]) {
  kv.clear();
  kv.set(CAP_KEY, String(SESSION_CAP_DAILY));
  const spy = makeQuotaSpy(ALLOWED);
  const { reply, streamed } = await call(spy);
  assert.deepEqual(reply.sent, [{ code: 429, body: { error: 'session_cap' } }], `${call.name}: cap must refuse`);
  assert.equal(spy.calls, 0, `${call.name}: a capped request must never reach checkQuota`);
  assert.equal(streamed, 0, `${call.name}: a capped request must not stream`);
  assert.equal(kv.get(CAP_KEY), String(SESSION_CAP_DAILY), `${call.name}: a refused request must not burn a session slot`);
}

// A served request asks for quota exactly once, and takes exactly one slot.
for (const call of [callStream, callScreenshot]) {
  kv.clear();
  const spy = makeQuotaSpy(ALLOWED);
  const { reply, streamed } = await call(spy);
  assert.deepEqual(reply.sent, [], `${call.name}: an allowed request must not send an error`);
  assert.equal(spy.calls, 1, `${call.name}: quota must be charged exactly once`);
  assert.equal(streamed, 1, `${call.name}: an allowed request must stream`);
  assert.equal(kv.get(CAP_KEY), '1', `${call.name}: a served request consumes one session slot`);
}

// Over quota is refused with the shape the client renders.
{
  kv.clear();
  const { reply, streamed } = await callStream(makeQuotaSpy(REFUSED));
  assert.equal(reply.sent[0].code, 429);
  assert.equal(reply.sent[0].body.error, 'quota_exceeded');
  assert.equal(reply.sent[0].body.limit, 120);
  assert.equal(streamed, 0);
}

// Infrastructure failure must fail OPEN: a Redis or DB blip cannot lock a
// paying customer out mid-interview.
{
  kv.clear();
  const brokenRedis = { ...fakeRedis, get: async () => { throw new Error('redis down'); } };
  require('../dist/redis/redis.js').getRedis = () => brokenRedis;
  const { reply, streamed } = await callStream(makeQuotaSpy(ALLOWED));
  require('../dist/redis/redis.js').getRedis = () => fakeRedis;
  assert.deepEqual(reply.sent, [], 'a Redis failure must not refuse the request');
  assert.equal(streamed, 1, 'a Redis failure must still serve');
}
{
  kv.clear();
  const { reply, streamed } = await callStream(makeQuotaSpy(new Error('db down')));
  assert.deepEqual(reply.sent, [], 'a quota lookup failure must not refuse the request');
  assert.equal(streamed, 1, 'a quota lookup failure must still serve');
}

// ── QuotaService counting ───────────────────────────────────────────────────
const quotaService = new QuotaService();

// Metering is off for every plan today (see CAPPED_PLANS), so no plan may
// touch the database at all. This is why the ordering bug above was latent.
{
  dbQueries = 0;
  const r = await quotaService.checkQuota(UID, 'copilot_requests', 'weekly', PERIOD_START);
  assert.equal(r.allowed, true);
  assert.equal(dbQueries, 0, 'an uncapped plan must not query the database');
}

// Switch metering back on and prove the counting still holds, so re-enabling a
// plan is a one-line change rather than a leap of faith.
CAPPED_PLANS.add('weekly');
{
  usage.clear();

  // The row does not exist yet — it is seeded and the increment still lands.
  let r = await quotaService.checkQuota(UID, 'copilot_requests', 'weekly', PERIOD_START);
  assert.equal(r.allowed, true);
  assert.equal(r.used, 1, 'first request must count as one');
  assert.equal(usage.get(UID).copilot_requests, 1, 'a missing row must be created and incremented');

  // ...and it goes up by exactly one per request thereafter.
  r = await quotaService.checkQuota(UID, 'copilot_requests', 'weekly', PERIOD_START);
  assert.equal(r.used, 2);
  assert.equal(usage.get(UID).copilot_requests, 2);

  // At the limit the counter stops moving and the request is refused.
  const limit = r.limit;
  usage.get(UID).copilot_requests = limit;
  r = await quotaService.checkQuota(UID, 'copilot_requests', 'weekly', PERIOD_START);
  assert.equal(r.allowed, false, 'a request at the limit must be refused');
  assert.equal(r.used, limit);
  assert.equal(usage.get(UID).copilot_requests, limit, 'a refused request must not increment');

  // A dead database throws rather than silently allowing — the controller is
  // what turns that into a fail-open, and the check above proves it does.
  dbDown = true;
  await assert.rejects(() => quotaService.checkQuota(UID, 'copilot_requests', 'weekly', PERIOD_START));
  dbDown = false;
}
CAPPED_PLANS.delete('weekly');

console.log('check-quota: OK');
