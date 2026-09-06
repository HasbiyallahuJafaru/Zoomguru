// Self-check for the broadcast batch sender.
//   npm run build && node scripts/check-broadcast-send.mjs
//
// The first broadcast ever attempted failed with
// "result?.data?.filter is not a function" and reached nobody. The sender had
// been written against an invented response shape and a cast made TypeScript
// believe it:
//
//   (result as unknown as { data?: Array<{ error?: unknown }> })?.data?.filter(...)
//
// Resend actually returns { data: { data: [{id}] }, error }, so the array is a
// level deeper and `.filter` does not exist. The cast is what hid it — nothing
// checked the shape against the real SDK until it ran in production.
//
// This drives sendBatch with the SDK's real success and error shapes and
// asserts what the batch row ends up as.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const rows = new Map();
let sendCalls = [];

require('../dist/database/db.js').getDB = () => ({
  query: async (sql, params) => {
    if (/UPDATE broadcast_batches/i.test(sql)) {
      const id = params[0];
      const prev = rows.get(id) ?? {};
      if (/status = 'sending'/.test(sql)) rows.set(id, { ...prev, status: 'sending' });
      else if (/status = 'sent'/.test(sql)) rows.set(id, { ...prev, status: 'sent' });
      else if (/status = 'pending'/.test(sql)) rows.set(id, { ...prev, status: 'pending', error: params[1] });
      else if (/status = 'failed'/.test(sql)) rows.set(id, { ...prev, status: 'failed', error: params[1] });
    }
    return { rows: [], rowCount: 0 };
  },
});

// The constructor builds a real Resend client, which refuses to exist without
// a key. A fake one is enough — every call is replaced below.
process.env['RESEND_API_KEY'] ??= 're_selfcheck_000000000000000000000000';
process.env['FROM_EMAIL'] ??= 'selfcheck@example.com';

const { BroadcastQueueService } = require('../dist/broadcast/broadcast-queue.service.js');

function makeService(batchSend) {
  const svc = new BroadcastQueueService();
  svc.resend = { batch: { send: batchSend } };
  svc.logger = { log() {}, warn() {}, error() {} };
  return svc;
}

const batch = (id, retry = 0) => ({
  id,
  broadcast_id: 'b-1',
  batch_index: 0,
  recipients: ['a@example.com', 'b@example.com'],
  retry_count: retry,
  broadcast_subject: 'Subject',
  broadcast_body: '<p>Body</p>',
});

// The REAL success shape from resend 6.x: data is an object whose `data` is
// the array of ids. The old code called .filter() straight on the outer
// object, which is the production crash this check exists for.
sendCalls = [];
let svc = makeService(async (emails) => {
  sendCalls.push(emails);
  return { data: { data: [{ id: 'e1' }, { id: 'e2' }] }, error: null };
});
await svc.sendBatch(batch('ok-1'));
assert.equal(rows.get('ok-1').status, 'sent', 'a successful batch must be marked sent');
assert.equal(sendCalls.length, 1);
assert.equal(sendCalls[0].length, 2, 'one email object per recipient');
assert.equal(sendCalls[0][0].subject, 'Subject');
assert.ok(sendCalls[0][0].html.includes('<p>Body</p>'), 'body must be wrapped in the email template');
assert.ok(sendCalls[0][0].html.includes('ZoomGuru'), 'template header missing');

// A rejected batch reports on `error`. First failure retries.
svc = makeService(async () => ({ data: null, error: { name: 'validation_error', message: 'bad from address' } }));
await svc.sendBatch(batch('err-1', 0));
assert.equal(rows.get('err-1').status, 'pending', 'first failure must be requeued for retry');
assert.match(rows.get('err-1').error, /bad from address/);

// Second failure is terminal, and says so.
svc = makeService(async () => ({ data: null, error: { name: 'validation_error', message: 'bad from address' } }));
await svc.sendBatch(batch('err-2', 1));
assert.equal(rows.get('err-2').status, 'failed', 'a retried failure must be marked failed');
assert.match(rows.get('err-2').error, /^FINAL_FAILURE/);

// A thrown transport error behaves the same way.
svc = makeService(async () => { throw new Error('socket hang up'); });
await svc.sendBatch(batch('err-3', 1));
assert.equal(rows.get('err-3').status, 'failed');
assert.match(rows.get('err-3').error, /socket hang up/);

console.log('check-broadcast-send: OK');
