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
const fakeRedis = {
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
const SIX_HOURS = 6 * 60 * 60;

// Private in TypeScript, ordinary properties once compiled.
const tripped = () => svc['geminiTripped']();
const trip = () => svc['tripGeminiBreaker']();

// Clean state: Gemini is tried.
assert.equal(await tripped(), false, 'breaker must start untripped');

// One failure trips it, with a TTL that is the six-hour reset.
await trip();
assert.equal(await tripped(), true, 'a single Gemini failure must trip the breaker');
assert.equal(store.get(KEY).ttl, SIX_HOURS, 'reset window must be exactly 6h');
assert.equal(store.get(KEY).value, '1');

// Tripping again while already tripped just refreshes the window — it must not
// throw or stack up extra keys.
await trip();
assert.equal(store.size, 1, 'repeat trips must not create extra keys');
assert.equal(await tripped(), true);

// The TTL expiring is the reset. Simulate what Redis does at 6h.
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

console.log('check-ai-fallback: OK');
