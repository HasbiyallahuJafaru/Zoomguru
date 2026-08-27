import { chromium } from 'playwright';

const BASE = "http://localhost:3000";
const paths = process.argv[2] ? process.argv[2].split(',') : ['/'];
const width = Number(process.argv[3] ?? 1440);
const full = process.argv[4] === 'full';
// Pass 'motion' to see animated backdrops as a real visitor would.
const motion = process.argv.includes('motion');

const browser = await chromium.launch();
// reducedMotion also trips the reduced-motion rule in globals.css, which forces
// every scroll-reveal to its shown state — otherwise a full-page capture shows
// blank sections that never scrolled into view.
const page = await browser.newPage({
  viewport: { width, height: 900 },
  deviceScaleFactor: 1,
  reducedMotion: motion ? 'no-preference' : 'reduce',
});

for (const p of paths) {
  const res = await page.goto(BASE + p, { waitUntil: 'networkidle' });
  // Let the streaming answer finish so screenshots are not caught mid-type.
  await page.waitForTimeout(2600);
  // Walk the page so IntersectionObserver reveals fire before a full capture.
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.8;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(700);
  const name = (p === '/' ? 'home' : p.replace(/\//g, '-').replace(/^-/, '')) + `-${width}`;
  await page.screenshot({ path: `.shots/${name}.png`, fullPage: full });
  console.log(`${p} -> ${res.status()} -> .shots/${name}.png`);
}

await browser.close();
