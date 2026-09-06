// Read-only check of the terms gate on production.
//   node livecheck.mjs [origin]
// Never clicks "Agree and download" and never ctrl-clicks the trigger: both
// would hit /analytics/download, recording a real download and pulling the
// real installer. Opening the gate is inert.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'https://zoomguru.xyz';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });

await page.goto(BASE + '/download', { waitUntil: 'networkidle' });
const btn = page.locator('a.btn', { hasText: 'Download for Windows' }).first();
await btn.click();
await page.waitForTimeout(600);

assert.equal(await page.evaluate(() => document.querySelector('dialog.gate')?.open), true, 'gate did not open');

const box = await page.locator('dialog.gate').boundingBox();
const view = page.viewportSize();
assert.ok(Math.abs(box.x + box.width / 2 - view.width / 2) <= 1, 'gate not centred horizontally');
assert.ok(Math.abs(box.y + box.height / 2 - view.height / 2) <= 1, 'gate not centred vertically');

// Styled, not a naked UA dialog: the pill button proves the CSS shipped.
const h = await page.locator('dialog.gate a.btn-primary').boundingBox();
assert.ok(h.height > 34, `confirm button looks unstyled (h=${h.height}) — CSS may not have shipped`);

const agree = h;
const notNow = await page.locator('dialog.gate button', { hasText: 'Not now' }).boundingBox();
const rowMid = (agree.x + notNow.x + notNow.width) / 2;
assert.ok(Math.abs(rowMid - (box.x + box.width / 2)) <= 2, 'action row not centred on card');

const text = await page.locator('dialog.gate').innerText();
assert.match(text, /solely responsible/i);
assert.match(text, /Downloading means you agree/i);

await page.screenshot({ path: 'gate-live.png' });
await browser.close();
console.log(`livecheck (${BASE}): OK`);
