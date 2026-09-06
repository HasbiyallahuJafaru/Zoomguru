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
    get chunks() { return chunks; },
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

// Three kinds, because the rules differ. 'spoken' is length-capped. 'code'
// is not — the cap applies to the sentence of explanation, never to the code
// itself, and asserting otherwise would demand a truncated solution. 'vision'
// is the screenshot path, which shares HUMAN_VOICE but not the cap.
const CASES = [
  // Behavioural: the classic bloat cases.
  { kind: 'spoken', q: 'Tell me about yourself.' },
  { kind: 'spoken', q: 'Tell me about a time you disagreed with a teammate.' },
  { kind: 'spoken', q: 'Why do you want to work here?' },
  { kind: 'spoken', q: 'What is your biggest weakness?' },
  // Technical explanation: the strongest pull toward a lecture.
  { kind: 'spoken', q: 'What is the difference between a process and a thread?' },
  { kind: 'spoken', q: 'How would you decide between SQL and NoSQL for a new service?' },
  // Something the CV does not claim — must admit it, not bluff.
  { kind: 'spoken', q: 'How much Kubernetes experience do you have?' },
  // No CV and no JD: a different branch of buildSystemPrompt entirely.
  { kind: 'spoken', q: 'Tell me about a project you are proud of.', noCv: true },
  // Code must still arrive complete.
  { kind: 'code', q: 'Write a function to reverse a linked list.' },
];

const SPEAK_WPM = 150; // conversational pace, for "how long is this to say out loud"
let failures = 0;

function judge(kind, q, a) {
  console.log(`\n── [${kind}] ${q} ${'─'.repeat(Math.max(0, 46 - q.length))}`);
  console.log(a.replace(/^/gm, '   '));

  const lower = a.toLowerCase();
  const hits = BANNED.filter((w) => lower.includes(w));
  const sentences = (a.match(/[.!?](\s|$)/g) || []).length;
  const words = a.split(/\s+/).filter(Boolean).length;
  const secs = Math.round((words / SPEAK_WPM) * 60);

  const problems = [];
  // First, and non-negotiable: this must be a real answer. Without this the
  // whole check passes on "the answer service is unavailable right now", which
  // is short, clean, contains no banned word, and proves nothing.
  if (/unavailable right now|\[Error/i.test(a)) problems.push('NOT A REAL ANSWER — the model never served this (check the key)');
  if (hits.length) problems.push(`filler vocabulary: ${hits.join(', ')}`);
  if (PREAMBLE.test(a)) problems.push(`preamble: "${a.slice(0, 40)}…"`);
  if (/\*\*|^#{1,6} |^[-*] |```/m.test(a)) problems.push('markdown leaked into a plain-text surface');
  if (a.length < 40) problems.push('answer too short to be real');

  if (kind === 'spoken') {
    // Read aloud mid-conversation. Past roughly 30 seconds the candidate is
    // monologuing and the interviewer has stopped listening.
    if (sentences > 5) problems.push(`${sentences} sentences — should be 2-4 spoken`);
    if (words > 100) problems.push(`${words} words (~${secs}s to say) — too long to read out`);
  }
  if (kind === 'code') {
    // The cap must not have eaten the actual solution.
    if (!/\b(def|function|const |return|class )\b/.test(a)) problems.push('no code in a coding answer — the length rule truncated it');
  }

  if (problems.length) {
    failures++;
    console.log(`   ✘ ${problems.join('\n   ✘ ')}`);
  } else {
    console.log(`   ✔ ${sentences} sentences, ${words} words, ~${secs}s spoken`);
  }
}

for (const c of CASES) {
  const r = fakeReply();
  await svc.streamAnswer({
    transcript: c.q,
    reply: r,
    cvText: c.noCv ? undefined : CV,
    jdText: c.noCv ? undefined : JD,
  });
  judge(c.kind, c.q + (c.noCv ? '  (no CV)' : ''), r.text.trim());
}

// The screenshot path shares HUMAN_VOICE, so it gets checked too — fixing only
// the spoken path would have left this one talking like a brochure.
{
  const r = fakeReply();
  const image = fs.readFileSync(path.join(here, 'fixtures', 'coding-screen.png')).toString('base64');
  await svc.streamScreenshot({ image, reply: r, cvText: CV, jdText: JD });
  const raw = r.text.trim();

  // priorContext for the NEXT screenshot is built from contextSummary, so if a
  // voice rule ever talks the model out of emitting the CONTEXT_SUMMARY line,
  // follow-up screenshots stop knowing whether they are a scroll or a new
  // problem — and nothing else here would notice, because the answers still
  // look perfect. Assert on the final SSE event, not the text: the service
  // strips the marker from the visible stream on purpose and hands the summary
  // back as a field.
  const summary = r.chunks.find((c) => c.contextSummary)?.contextSummary;
  console.log('\n── [vision] CONTEXT_SUMMARY (follow-up context) ──');
  if (summary) {
    console.log(`   ✔ captured: ${summary.slice(0, 90)}`);
  } else {
    failures++;
    console.log('   ✘ MISSING — screenshot follow-up context is broken');
  }

  judge('vision', 'screenshot of a coding screen', raw.split(/CONTEXT_SUMMARY:/)[0].trim());
}

const total = CASES.length + 1;
assert.equal(failures, 0, `${failures} of ${total} answers broke the voice rules`);
console.log(`\ncheck-ai-voice: OK — ${total}/${total} answers clean`);
