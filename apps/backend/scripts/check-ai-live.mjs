// LIVE end-to-end check for every flow GEMINI serves.
//   npm run build && node scripts/check-ai-live.mjs
//   npm run build && railway run node scripts/check-ai-live.mjs   (prod keys)
//
// Unlike check-ai-fallback.mjs (which mocks everything and asserts branching),
// this drives the real service methods against the real Gemini API with the
// real key. It spends a few thousand tokens per run. That is the point: it is
// the only check that proves the configured model actually serves these flows,
// rather than proving our code would handle it if it did.
//
// Every case asserts GEMINI served it. If the model ID, the thinkingConfig
// shape, or the key is wrong, Gemini errors, the request silently falls through
// to OpenRouter, and this fails instead of quietly costing you money.
//
// NOT covered (they do not use Gemini): /ai/transcribe is Groq Whisper,
// /ai/tts is LemonFox.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.GEMINI_API_KEY) {
  // Split on \r?\n: .env is CRLF here, and a trailing \r defeats `$`.
  const envPath = path.join(here, '..', '.env');
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
assert.ok(process.env.GEMINI_API_KEY, 'GEMINI_API_KEY must be set to run the live check');

// Redis stands in as a no-op: the breaker reads absent (so Gemini is tried),
// the usage counters fire-and-forget into nothing, and the doc cache always
// misses (so the cache-creation path is exercised on every run).
//
// pipeline() must return a CHAINABLE stub, not a promise. recordApiUsage builds
// `getRedis().pipeline().incr().expire().exec()` synchronously inside
// trackedFetch, so a non-chainable stub throws a TypeError that propagates out
// of the fetch wrapper and is indistinguishable from Gemini being down.
const chain = new Proxy({}, {
  get: (_t, prop) => (prop === 'exec' ? async () => [] : () => chain),
});
// Flipped by the last case to force the OpenRouter fallback tier.
let breakerTripped = false;
const fakeRedis = new Proxy({}, {
  get: (_t, prop) => {
    if (prop === 'get') return async (k) => (breakerTripped && k === 'ai:gemini:down' ? '1' : null);
    if (prop === 'pipeline' || prop === 'multi') return () => chain;
    return async () => 'OK';
  },
});
require('../dist/redis/redis.js').getRedis = () => fakeRedis;

// Record which providers actually received traffic, so "it answered" can be
// distinguished from "it answered via the fallback".
let hits = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (url, init) => {
  const u = new URL(String(url));
  hits.push({ host: u.hostname, path: u.pathname });
  return realFetch(url, init);
};

const { AiService } = require('../dist/ai/ai.service.js');
const svc = new AiService();

// Minimal ServerResponse: the SSE helpers only touch write/end/destroyed.
function fakeReply() {
  const chunks = [];
  let ended = false;
  return {
    destroyed: false,
    write(s) {
      const m = String(s).match(/^data: (.*)\n\n$/s);
      if (m) chunks.push(JSON.parse(m[1]));
      return true;
    },
    end() { ended = true; },
    get text() { return chunks.filter((c) => c.chunk).map((c) => c.chunk).join(''); },
    get ended() { return ended; },
    get chunks() { return chunks; },
  };
}

const GEMINI_HOST = 'generativelanguage.googleapis.com';
let passed = 0;

// Asserts Gemini alone served the request, and the answer used the input.
function assertGeminiServed(name, answer, mustMention) {
  const providers = [...new Set(hits.map((h) => h.host))];
  console.log(`\n── ${name} ${'─'.repeat(Math.max(0, 56 - name.length))}`);
  console.log(`   provider : ${providers.join(', ') || '(none)'}   upstream calls: ${hits.length}`);
  console.log(`   answer   : ${answer.slice(0, 200).replace(/\s+/g, ' ')}${answer.length > 200 ? '…' : ''}`);

  assert.ok(providers.includes(GEMINI_HOST), `${name}: Gemini was never called`);
  assert.ok(
    !providers.some((h) => h !== GEMINI_HOST),
    `${name}: fell through to a fallback (${providers.join(', ')}) — Gemini rejected the request`,
  );
  assert.ok(!/unavailable right now|\[Error/i.test(answer), `${name}: service returned its error string`);
  const missing = mustMention.filter((w) => !answer.toLowerCase().includes(w.toLowerCase()));
  assert.equal(missing.length, 0, `${name}: answer ignored the input (never mentioned: ${missing.join(', ')})`);
  console.log(`   ✔ served by Gemini, on-topic`);
  passed++;
}

// Same, plus the SSE-shape assertions that only apply to streaming flows.
function assertStreamed(name, reply, mustMention) {
  assertGeminiServed(name, reply.text, mustMention);
  assert.ok(reply.ended, `${name}: stream never terminated`);
  assert.ok(reply.chunks.length > 1, `${name}: expected incremental SSE chunks, got ${reply.chunks.length}`);
  assert.ok(reply.text.length > 40, `${name}: answer too short to be real (${reply.text.length} chars)`);
}

const run = async (fn) => { hits = []; return fn(); };

const CV = 'Senior backend engineer, 6 years. Python, Node.js, PostgreSQL, Redis. Built a payments service at 2k req/s.';
const JD = 'Backend Engineer. Python and distributed systems. Strong data-structures fundamentals required.';

// ── FLOW 3/4: Listen ────────────────────────────────────────────────────────
let r = fakeReply();
await run(() => svc.streamAnswer({
  transcript: 'Can you tell me about a time you had to optimise a slow database query?',
  reply: r, cvText: CV, jdText: JD,
}));
assertStreamed('FLOW 3/4  Listen  (/ai/stream)', r, ['quer']);

// ── FLOW 5: Screenshot ──────────────────────────────────────────────────────
// A rendered coding-screen PNG, base64'd exactly as the Electron app sends it.
r = fakeReply();
const image = fs.readFileSync(path.join(here, 'fixtures', 'coding-screen.png')).toString('base64');
await run(() => svc.streamScreenshot({ image, reply: r, cvText: CV, jdText: JD }));
// The model can only say these if it genuinely read the pixels.
assertStreamed('FLOW 5    Screenshot  (/ai/screenshot)', r, ['two', 'sum']);

// ── AI Interviewer: question generation ─────────────────────────────────────
r = fakeReply();
await run(() => svc.generateInterviewerQuestion({
  cvText: CV, jdText: JD, difficulty: 'medium', questionNumber: 2,
  priorQuestions: ['Tell me about yourself.'], reply: r,
}));
assertStreamed('Interviewer  question  (/ai/interviewer-question)', r, ['?']);

// ── AI Interviewer: scoring ─────────────────────────────────────────────────
// Non-streaming, and the only flow that must return parseable JSON matching a
// fixed schema — the shape most likely to break on a model swap.
const report = await run(() => svc.scoreSession([
  { question: 'What is a database index?', answer: 'It is a data structure that speeds up lookups at the cost of write throughput and storage.' },
  { question: 'Explain the CAP theorem.', answer: 'dunno' },
]));
assertGeminiServed('Scoring  (/ai/score-session)', JSON.stringify(report), ['overallScore']);
assert.equal(typeof report.overallScore, 'number', 'scoring: overallScore must be a number');
assert.equal(report.answers.length, 2, 'scoring: must score every answer');
assert.ok(Array.isArray(report.strengths) && Array.isArray(report.improvements), 'scoring: arrays missing');
assert.ok(typeof report.nextFocus === 'string' && report.nextFocus.length > 0, 'scoring: nextFocus missing');
// The weak answer must score below the strong one, or the model is not reading.
assert.ok(report.answers[1].score < report.answers[0].score,
  `scoring: "dunno" (${report.answers[1].score}) should score below a real answer (${report.answers[0].score})`);
console.log(`   ✔ valid ScorerReport — overall ${report.overallScore}, per-answer ${report.answers.map((a) => a.score).join(' / ')}`);

// ── Meeting copilot ─────────────────────────────────────────────────────────
r = fakeReply();
await run(() => svc.streamMeetingAnswer({
  transcript: 'What did we agree the renewal rate target was?',
  docText: 'Q3 board notes. Attendees: Ada, Grace.\nThe team agreed the renewal rate target for Q4 is 91.2 percent.\nBudget was left unchanged.',
  reply: r,
}));
assertStreamed('Meeting copilot  (/ai/meeting-stream)', r, ['91.2']);

// ── Doc copilot: cached path ────────────────────────────────────────────────
// Over MIN_CACHE_CHARS, so this exercises Gemini context caching: create the
// cachedContents entry, then query against it. A distinctive fact buried in the
// padding proves the cached document was actually read back.
const filler = 'Operational note: routine maintenance was performed and no incidents were recorded. '.repeat(260);
const doc = `${filler}\nThe Q3 customer renewal rate was 87.4 percent.\n${filler}`;
assert.ok(doc.length >= 16_000, 'fixture must exceed MIN_CACHE_CHARS to hit the cache path');
r = fakeReply();
await run(() => svc.streamDocCopilot({
  transcript: 'What was the Q3 customer renewal rate?',
  documents: [{ docId: 'd1', fileName: 'q3-report.txt', serializedContent: doc }],
  cacheKey: `live-check-${Date.now()}`,
  reply: r,
}));
assertStreamed('Doc copilot  cached  (/ai/doc-copilot)', r, ['87.4']);
// Caching is a silent optimisation: if cachedContents creation fails, the code
// falls back to inlining the doc and still answers correctly. Without this
// assertion the flow would look healthy while quietly paying full price on
// every query, so check the cache endpoint was actually used.
assert.ok(hits.some((h) => h.path.endsWith('/cachedContents')),
  'doc copilot: context caching never happened — cachedContents was never called');
console.log('   ✔ context cache created and queried');

// ── Doc copilot: uncached path ──────────────────────────────────────────────
// Under MIN_CACHE_CHARS, so the doc rides in the system instruction instead.
r = fakeReply();
await run(() => svc.streamDocCopilot({
  transcript: 'What was the Q3 customer renewal rate?',
  documents: [{ docId: 'd1', fileName: 'q3-brief.txt', serializedContent: 'Q3 brief.\nThe Q3 customer renewal rate was 87.4 percent.\nNo other changes.' }],
  cacheKey: undefined,
  reply: r,
}));
assertStreamed('Doc copilot  uncached  (/ai/doc-copilot)', r, ['87.4']);

// ── Fallback tier: OpenRouter ───────────────────────────────────────────────
// The safety net only gets exercised during a Gemini outage, which is exactly
// when nobody is watching. A wrong OpenRouter model slug fails silently until
// then. Force the breaker tripped so the request has to go through OpenRouter.
if (!process.env.OPENROUTER_API_KEY) {
  console.log('\n── Fallback  OpenRouter ────────────────────────────────────');
  console.log('   SKIPPED — OPENROUTER_API_KEY not set. Run under `railway run` to cover it.');
} else {
  breakerTripped = true;
  r = fakeReply();
  await run(() => svc.streamAnswer({ transcript: 'What is a database index?', reply: r, cvText: CV, jdText: JD }));
  breakerTripped = false;
  const providers = [...new Set(hits.map((h) => h.host))];
  console.log('\n── Fallback  OpenRouter (breaker tripped) ──────────────────');
  console.log(`   provider : ${providers.join(', ') || '(none)'}`);
  console.log(`   answer   : ${r.text.slice(0, 160).replace(/\s+/g, ' ')}`);
  assert.ok(providers.includes('openrouter.ai'), 'fallback: OpenRouter was never called');
  assert.ok(!providers.includes(GEMINI_HOST), 'fallback: breaker was tripped but Gemini was still called');
  assert.ok(!/unavailable right now/i.test(r.text) && r.text.length > 40,
    'fallback: OpenRouter did not answer — check OPENROUTER_MODEL, the slug may not exist');
  console.log('   ✔ OpenRouter fallback works — model slug is valid');
}

console.log(`\ncheck-ai-live: OK — ${passed}/${passed} Gemini-backed flows served by Gemini direct\n`);
