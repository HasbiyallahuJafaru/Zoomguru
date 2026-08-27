// Which Gemini keys actually work, right now?
//   local:      node scripts/check-gemini-keys.mjs
//   production: railway run node scripts/check-gemini-keys.mjs
//
// Reads GEMINI_API_KEY..GEMINI_API_KEY_5 from the environment and calls Google
// with each one. Prints status only — never the key, only a short fingerprint,
// so the output is safe to paste into an issue.
//
// Worth running whenever answers start coming from OpenRouter. A key that is
// out of credits (429) or whose project lost model access (404) still LOOKS
// configured; only a real call tells them apart.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MODEL = 'gemini-3.1-flash-lite';
const NAMES = ['GEMINI_API_KEY', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_3', 'GEMINI_API_KEY_4', 'GEMINI_API_KEY_5'];

// Fall back to .env so this works without `railway run`. Split on \r?\n: .env is
// CRLF on Windows and a trailing \r defeats `$`.
const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env');
if (!process.env.GEMINI_API_KEY && fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const fp = (k) => `${k.slice(0, 6)}…${crypto.createHash('sha256').update(k).digest('hex').slice(0, 8)}`;

let live = 0;
let configured = 0;
console.log(`\nGemini keys — direct call to ${MODEL}\n`);

for (const name of NAMES) {
  const key = process.env[name];
  if (!key) { console.log(`  ${'—'.padEnd(7)} ${name.padEnd(18)} (unset)`); continue; }
  configured++;
  let verdict;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Reply with the single word: ok' }] }],
          generationConfig: { maxOutputTokens: 10, thinkingConfig: { thinkingLevel: 'minimal' } },
        }),
      },
    );
    if (res.status === 200) { live++; verdict = 'LIVE   '; }
    else {
      const err = JSON.parse(await res.text()).error ?? {};
      verdict = 'DEAD   ';
      var detail = `${res.status} ${err.status ?? ''} — ${(err.message ?? '').slice(0, 100)}`;
    }
  } catch (e) {
    verdict = 'DEAD   ';
    var detail = `network: ${e.message}`;
  }
  console.log(`  ${verdict} ${name.padEnd(18)} ${fp(key)}${detail ? '  ' + detail : ''}`);
  detail = undefined;
}

console.log(`\n${live}/${configured} configured keys are live.`);
// Rotation only retries other keys when more than one is configured, so a lone
// dead key means every AI request falls through to OpenRouter.
if (live === 0) { console.log('NO WORKING GEMINI KEY — every request will fall back to OpenRouter.\n'); process.exit(1); }
if (live < configured) console.log('Dead keys still in rotation waste a call (and a retry) on every cycle. Remove them.\n');
else console.log('');
