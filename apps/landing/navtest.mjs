import { chromium } from 'playwright';

// Walks the site the way a visitor does — scroll down, click a nav link — and
// asserts every arrival starts at the top of the page.
const BASE = 'http://localhost:3000';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const hops = [
  ['/', 'Pricing'],
  ['/pricing', 'Download'],
  ['/download', 'FAQ'],
  ['/faq', 'Features'],
  ['/features', 'Live copilot'],
];

let failures = 0;

for (const [from, linkText] of hops) {
  await page.goto(BASE + from, { waitUntil: 'networkidle' });
  // Get well down the page first: that is when the bug shows.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.6));
  await page.waitForTimeout(300);
  const before = await page.evaluate(() => Math.round(window.scrollY));

  const link = page.getByRole('link', { name: linkText, exact: true }).first();
  const href = await link.getAttribute('href');
  await link.click();
  try {
    await page.waitForURL(`**${href}`, { timeout: 8000 });
  } catch {
    console.log(`  (never reached ${href}; still on ${new URL(page.url()).pathname})`);
  }
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);

  const after = await page.evaluate(() => Math.round(window.scrollY));
  const url = new URL(page.url()).pathname;
  const ok = after === 0;
  if (!ok) failures++;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${from} (scrolled ${before}px) -> click "${linkText}" -> ${url} lands at ${after}px`,
  );
}

await browser.close();
console.log(failures === 0 ? '\nAll navigations land at the top.' : `\n${failures} navigation(s) did not.`);
process.exit(failures === 0 ? 0 : 1);
