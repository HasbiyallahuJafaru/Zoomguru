// Self-check for the Gemini→OpenRouter breaker.
//   npm run build && node scripts/check-ai-fallback.mjs
//
// Same shape as check-sessions.mjs: an in-memory stand-in for the two Redis
// commands the breaker uses, so it needs no server and no extra dependency.
// What it checks is the trip/reset/fail-open branching, not ioredis.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// AiService's constructor throws without these; the values are never called.
process.env.GEMINI_API_KEY ||= 'fake-gemini';
process.env.DEEPSEEK_API_KEY ||= 'fake-deepseek';

const store = new Map(); // key -> { value, ttl }
let down = false;
// pipeline() must be CHAINABLE, not async. trackedFetch calls recordApiUsage,
// which builds `getRedis().pipeline().incr().expire().exec()` synchronously
// before the fetch — a stub that returns a promise throws a TypeError that
// propagates out of trackedFetch and looks exactly like Gemini being down.
const pipe = new Proxy({}, {
  get: (_t, prop) => (prop === 'exec' ? async () => [] : () => pipe),
});
const fakeRedis = {
  pipeline: () => pipe,
  multi: () => pipe,
  get: async (k) => { if (down) throw new Error('redis down'); return store.get(k)?.value ?? null; },
  set: async (k, v, mode, ttl) => {
    if (down) throw new Error('redis down');
    assert.equal(mode, 'EX', 'breaker must set a TTL, or it would never reset');
    store.set(k, { value: v, ttl });
    return 'OK';
  },
};

require('../dist/redis/redis.js').getRedis = () => fakeRedis;

const { AiService } = require('../dist/ai/ai.service.js');
const svc = new AiService();

const KEY = 'ai:gemini:down';

// Private in TypeScript, ordinary properties once compiled.
const tripped = () => svc['geminiTripped']();
const trip = () => svc['tripGeminiBreaker']();

// Clean state: Gemini is tried.
assert.equal(await tripped(), false, 'breaker must start untripped');

// One failure trips it, with a TTL that is the reset.
await trip();
assert.equal(await tripped(), true, 'a single Gemini failure must trip the breaker');
// A latched breaker is the bug this guards: the window must cover a burst of
// requests, not an outage. Anything past a few minutes pins users to OpenRouter.
const ttl = store.get(KEY).ttl;
assert.ok(ttl > 0 && ttl <= 300, `reset window must be short, got ${ttl}s`);
assert.equal(store.get(KEY).value, '1');

// Tripping again while already tripped just refreshes the window — it must not
// throw or stack up extra keys.
await trip();
assert.equal(store.size, 1, 'repeat trips must not create extra keys');
assert.equal(await tripped(), true);

// The TTL expiring is the reset. Simulate what Redis does when it lapses.
store.delete(KEY);
assert.equal(await tripped(), false, 'breaker must clear itself when the TTL lapses');

// Redis unavailable must FAIL OPEN — read as untripped so Gemini is still
// tried, matching every other Redis check in this codebase. A breaker that
// fails closed would park every user on OpenRouter during a Redis blip.
down = true;
assert.equal(await tripped(), false, 'redis down must read as untripped');
await trip(); // must not throw
down = false;

// With no OPENROUTER_API_KEY the tier is skipped cleanly: returns false and
// never touches the response, so the caller falls through to DeepSeek/Groq.
const noKey = new AiService();
noKey['openRouterKey'] = '';
let touched = false;
const replySpy = new Proxy({}, { get() { touched = true; return () => {}; } });
assert.equal(await noKey['streamToOpenRouter']({ messages: [], reply: replySpy }), false,
  'missing OpenRouter key must return false, not throw');
assert.equal(touched, false, 'a skipped tier must not write to the response');

// ── Key rotation is sequential, and stops at the first key that answers ─────
// Stubbed fetch, so this is deterministic and costs nothing. Guards two things
// that are easy to regress and expensive in different ways: a parallel fan-out
// bills every key that succeeds (and re-uploads the screenshot to each), while
// giving up after one failure strands the request on a single dead key.
{
  const rotate = new AiService();
  rotate['geminiKeys'] = ['k1', 'k2', 'k3', 'k4', 'k5'];
  rotate['geminiKeyIndex'] = 0;

  let inFlight = 0;
  const order = [];
  // Only k4 works. k1 is out of credits, k2 lost model access, k3 is revoked.
  const status = { k1: 429, k2: 404, k3: 403, k4: 200, k5: 200 };
  globalThis.fetch = async (url) => {
    const key = String(url).split('key=')[1];
    order.push(key);
    assert.equal(++inFlight, 1, 'keys must be tried one at a time, never fanned out in parallel');
    await new Promise((r) => setImmediate(r)); // yield, so overlap would be visible
    inFlight--;
    const code = status[key];
    return { status: code, body: code === 200 ? null : undefined, text: async () => '' };
  };

  const reply = { destroyed: false, write: () => true, end: () => {} };
  await rotate['streamToGemini']({ parts: [], systemPrompt: '', reply });

  assert.deepEqual(order, ['k1', 'k2', 'k3', 'k4'],
    `must walk keys in order and stop at the first success, got ${order.join(',')}`);
  assert.equal(order.length, 4, 'k5 must never be called once k4 answered');
}

// A single configured key must not retry itself.
{
  const solo = new AiService();
  solo['geminiKeys'] = ['only'];
  solo['geminiKeyIndex'] = 0;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return { status: 429, body: undefined, text: async () => '' }; };
  await solo['streamToGemini']({ parts: [], systemPrompt: '', reply: { destroyed: false, write: () => true, end: () => {} } });
  assert.equal(calls, 1, 'one key must be tried exactly once, not looped');
}

console.log('check-ai-fallback: OK');
