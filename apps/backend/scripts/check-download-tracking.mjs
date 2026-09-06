// Self-check for download tracking.
//   npm run build && node scripts/check-download-tracking.mjs
//
// The rule this exists to hold: a row in `downloads` means a file was actually
// served. The INSERT used to run before the availability check, so
// ?platform=mac recorded a download and then 503'd — and since there is no
// macOS build, every mac row in production is a download that never happened.
// Nothing downstream can tell a real hit from a phantom one after the fact.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

let inserts = [];
require('../dist/database/db.js').getDB = () => ({
  query: async (sql, params) => {
    inserts.push({ sql, params });
    return { rows: [] };
  },
});

const { AnalyticsController } = require('../dist/analytics/analytics.controller.js');
const ctrl = new AnalyticsController();

function fakeReply() {
  const out = { status: null, body: null, redirectedTo: null };
  return {
    out,
    code(c) { out.status = c; return this; },
    async send(b) { out.body = b; },
    raw: {
      writeHead(c, headers) { out.status = c; out.redirectedTo = headers.Location; },
      end() {},
    },
  };
}

const req = { headers: {}, ip: '203.0.113.9' };

async function call(platform, env) {
  inserts = [];
  for (const k of ['APP_DOWNLOAD_LINK_WINDOWS', 'APP_DOWNLOAD_LINK_MAC', 'R2_DOWNLOAD_URL_WINDOWS', 'R2_DOWNLOAD_URL_MAC']) {
    delete process.env[k];
  }
  Object.assign(process.env, env);
  const reply = fakeReply();
  await ctrl.trackDownload(platform, req, reply);
  return reply.out;
}

const WIN = 'https://dl.zoomguru.xyz/ZoomGuru-Setup.exe';

// A real Windows download: 302 to the binary, and exactly one row recorded.
let out = await call('windows', { APP_DOWNLOAD_LINK_WINDOWS: WIN });
assert.equal(out.status, 302);
assert.equal(out.redirectedTo, WIN);
assert.equal(inserts.length, 1, 'a served download must be recorded');
assert.deepEqual(inserts[0].params, ['windows', '203.0.113.9']);

// macOS with no build configured: 503, and NOTHING recorded. This is the bug.
out = await call('mac', { APP_DOWNLOAD_LINK_WINDOWS: WIN });
assert.equal(out.status, 503);
assert.equal(inserts.length, 0, 'a 503 must not record a download — this was the mac phantom row');

// Windows with nothing configured either: same rule, no row.
out = await call('windows', {});
assert.equal(out.status, 503);
assert.equal(inserts.length, 0, 'an unavailable download must not be recorded');

// The legacy variable name still works, and still counts.
out = await call('windows', { R2_DOWNLOAD_URL_WINDOWS: WIN });
assert.equal(out.status, 302);
assert.equal(inserts.length, 1, 'the R2_* fallback must still serve and count');

// An unrecognised platform is stored as 'unknown' and served the Windows
// build. Pre-existing behaviour, asserted so a refactor cannot change it
// silently — it is why one 'unknown' row exists in production.
out = await call('linux', { APP_DOWNLOAD_LINK_WINDOWS: WIN });
assert.equal(out.status, 302);
assert.equal(inserts[0].params[0], 'unknown');

// A mac build, once it exists, must count like any other.
out = await call('mac', { APP_DOWNLOAD_LINK_MAC: 'https://dl.zoomguru.xyz/ZoomGuru.dmg' });
assert.equal(out.status, 302);
assert.equal(inserts.length, 1);
assert.equal(inserts[0].params[0], 'mac');

console.log('check-download-tracking: OK');
