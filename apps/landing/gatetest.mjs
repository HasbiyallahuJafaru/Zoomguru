// Checks the download terms gate in a real browser.
//   npm run build && npm start   (then, in another shell)
//   node gatetest.mjs
//
// Deliberately never clicks "Agree and download": that link points at the live
// backend, which would record a real download and pull the real binary.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const browser = await chromium.launch();
// reducedMotion trips the reduced-motion rule in globals.css, which forces the
// scroll-reveals to their shown state. Without it Playwright refuses to click a
// button that is still drifting upward. Same reason shot.mjs sets it.
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  reducedMotion: 'reduce',
});

const open = () => page.evaluate(() => document.querySelector('dialog.gate')?.open === true);
const btn = () => page.locator('a.btn', { hasText: 'Download for Windows' }).first();

await page.goto(BASE + '/download', { waitUntil: 'networkidle' });

// The trigger is still a real link, so "copy link address" and crawlers work.
assert.match(await btn().getAttribute('href'), /\/analytics\/download\?platform=windows$/);
assert.equal(await open(), false, 'gate must start closed');

// A plain click opens the gate instead of downloading.
await btn().click();
await page.waitForTimeout(400);
assert.equal(await open(), true, 'plain click must open the gate');

// It says the three things it exists to say.
const text = await page.locator('dialog.gate').innerText();
assert.match(text, /solely responsible/i);
assert.match(text, /preparation and practice/i);
assert.match(text, /Downloading means you agree/i);
assert.match(await page.locator('dialog.gate a[href="/terms"]').getAttribute('href'), /^\/terms$/);

// The confirm is the same real link, so the analytics hit still happens.
assert.match(
  await page.locator('dialog.gate a.btn-primary').getAttribute('href'),
  /\/analytics\/download\?platform=windows$/,
);

// Dead centre, both axes. Tailwind's preflight zeroes the `margin: auto` a
// modal <dialog> is centred by, which silently parks it in the top-left — so
// this is asserted rather than eyeballed.
const box = await page.locator('dialog.gate').boundingBox();
const view = page.viewportSize();
assert.ok(
  Math.abs(box.x + box.width / 2 - view.width / 2) <= 1,
  `gate is not horizontally centred: ${JSON.stringify(box)}`,
);
assert.ok(
  Math.abs(box.y + box.height / 2 - view.height / 2) <= 1,
  `gate is not vertically centred: ${JSON.stringify(box)}`,
);

await page.screenshot({ path: 'gate.png' });

// Esc closes it — free with <dialog>, but assert it so a rewrite cannot lose it.
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
assert.equal(await open(), false, 'Escape must close the gate');

// "Not now" closes it and downloads nothing.
await btn().click();
await page.waitForTimeout(300);
await page.locator('dialog.gate button', { hasText: 'Not now' }).click();
await page.waitForTimeout(300);
assert.equal(await open(), false, '"Not now" must close the gate');

// Backdrop click closes it.
await btn().click();
await page.waitForTimeout(300);
await page.mouse.click(20, 20);
await page.waitForTimeout(300);
assert.equal(await open(), false, 'backdrop click must close the gate');

// A modified click is someone opening the download in a new tab. It must pass
// straight through untouched rather than trapping them behind a modal.
const ctx = page.context();
await btn().click({ modifiers: ['ControlOrMeta'] });
await page.waitForTimeout(600);
assert.equal(await open(), false, 'ctrl-click must not open the gate');
for (const p of ctx.pages()) if (p !== page) await p.close();

// Every download button on the site is gated, not just the one on /download.
for (const path of ['/', '/pricing', '/features', '/features/live-copilot']) {
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  const n = await page.locator('a.btn', { hasText: /Download for Windows/ }).count();
  assert.ok(n > 0, `no download button found on ${path}`);
  await page.locator('a.btn', { hasText: /Download for Windows/ }).first().click();
  await page.waitForTimeout(400);
  assert.equal(await open(), true, `download button on ${path} is not gated`);
  await page.keyboard.press('Escape');
}

await browser.close();
console.log('gatetest: OK');
