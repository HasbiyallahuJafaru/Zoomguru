// LIVE check that answers still sound like a person, not a document.
//   npm run build && node scripts/check-ai-voice.mjs
//
// A prompt is logic, and this is the only way to test it: drive the real
// streamAnswer against the real model and read what comes back. Costs a few
// hundred tokens per run.
//
// On a machine with a TLS-intercepting proxy, node's fetch cannot reach Google
// and every key reads as dead ("network: fetch failed", NOT a 401/429). That
// is the machine, not the key. Run it as:
//   NODE_OPTIONS=--use-system-ca node scripts/check-ai-voice.mjs
// Same workaround check-gemini-keys.mjs needs, and the same reason npm does.
//
// It asserts the three things the prompt exists to enforce — no filler
// vocabulary, no preamble, and a spoken length — and prints every answer so a
// human can judge the part no assertion can: whether it sounds human.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.GEMINI_API_KEY) {
  // Split on \r?\n: .env is CRLF here, and a trailing \r defeats `$`.
  for (const line of fs.readFileSync(path.join(here, '..', '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
assert.ok(process.env.GEMINI_API_KEY, 'GEMINI_API_KEY must be set to run the voice check');

const chain = new Proxy({}, { get: (_t, p) => (p === 'exec' ? async () => [] : () => chain) });
const fakeRedis = new Proxy({}, {
  get: (_t, p) => {
    if (p === 'get') return async () => null;
    if (p === 'pipeline' || p === 'multi') return () => chain;
    return async () => 'OK';
  },
});
require('../dist/redis/redis.js').getRedis = () => fakeRedis;

const { AiService } = require('../dist/ai/ai.service.js');
const svc = new AiService();

function fakeReply() {
  const chunks = [];
  return {
    destroyed: false,
    write(s) {
      const m = String(s).match(/^data: (.*)\n\n$/s);
      if (m) chunks.push(JSON.parse(m[1]));
      return true;
    },
    end() {},
    get text() { return chunks.filter((c) => c.chunk).map((c) => c.chunk).join(''); },
  };
}

// The vocabulary that makes an answer read as machine-written. Kept in step
// with HUMAN_VOICE in ai.service.ts.
const BANNED = [
  'delve', 'leverage', 'robust', 'seamless', 'holistic', 'myriad', 'crucial',
  'pivotal', 'tapestry', "it's important to note", 'it is important to note',
  "it's worth noting", 'at the end of the day', "in today's fast-paced",
  'i am passionate about', "i'm passionate about", 'as an ai',
];

// Openers that stall before the answer.
const PREAMBLE = /^\s*(great|good|excellent|that's a great|thank you|thanks|certainly|sure|absolutely|of course|well,)/i;

const CV = 'Senior backend engineer, 6 years. Python, Node.js, PostgreSQL, Redis. Built a payments service at 2k req/s.';
const JD = 'Backend Engineer. Python and distributed systems. Strong data-structures fundamentals required.';

const QUESTIONS = [
  'Tell me about yourself.',
  'Tell me about a time you disagreed with a teammate.',
  'Why do you want to work here?',
  'What is your biggest weakness?',
];

let failures = 0;

for (const q of QUESTIONS) {
  const r = fakeReply();
  await svc.streamAnswer({ transcript: q, reply: r, cvText: CV, jdText: JD });
  const a = r.text.trim();

  console.log(`\n── ${q} ${'─'.repeat(Math.max(0, 54 - q.length))}`);
  console.log(a.replace(/^/gm, '   '));

  const lower = a.toLowerCase();
  const hits = BANNED.filter((w) => lower.includes(w));
  const sentences = (a.match(/[.!?](\s|$)/g) || []).length;
  const words = a.split(/\s+/).length;

  const problems = [];
  // First, and non-negotiable: this must be a real answer. Without this the
  // whole check passes on "the answer service is unavailable right now", which
  // is short, clean, contains no banned word, and proves nothing.
  if (/unavailable right now|\[Error/i.test(a)) problems.push('NOT A REAL ANSWER — the model never served this (check the key)');
  if (hits.length) problems.push(`filler vocabulary: ${hits.join(', ')}`);
  if (PREAMBLE.test(a)) problems.push(`preamble: "${a.slice(0, 40)}…"`);
  if (sentences > 6) problems.push(`${sentences} sentences (spoken answers should be 2-4)`);
  if (/\*\*|^#|^- |```/m.test(a)) problems.push('markdown leaked into a plain-text surface');
  if (a.length < 40) problems.push('answer too short to be real');

  if (problems.length) {
    failures++;
    console.log(`   ✘ ${problems.join('\n   ✘ ')}`);
  } else {
    console.log(`   ✔ clean — ${sentences} sentences, ${words} words`);
  }
}

assert.equal(failures, 0, `${failures} of ${QUESTIONS.length} answers broke the voice rules`);
console.log(`\ncheck-ai-voice: OK — ${QUESTIONS.length}/${QUESTIONS.length} answers clean`);
