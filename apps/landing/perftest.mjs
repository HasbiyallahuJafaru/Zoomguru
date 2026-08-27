import { chromium } from 'playwright';

// Measures scroll smoothness on a throttled mobile-class device. Each variant
// switches one suspect off, so the cost of each effect can be read separately.
const BASE = process.env.PERF_BASE ?? 'http://localhost:3444';
const CPU_THROTTLE = 6;

const VARIANTS = {
  'mobile (as shipped)': '',
};

const browser = await chromium.launch();
const results = [];

for (const [name, css] of Object.entries(VARIANTS)) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();

  // Applies before first paint, so the effect never gets a chance to run.
  if (css) await page.addInitScript((c) => {
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style');
      s.textContent = c;
      document.head.appendChild(s);
    });
  }, css);

  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });

  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);

  const frames = await page.evaluate(async () => {
    const intervals = [];
    let last = performance.now();
    let running = true;
    const tick = () => {
      const now = performance.now();
      intervals.push(now - last);
      last = now;
      if (running) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    const total = document.body.scrollHeight - window.innerHeight;
    const steps = 50;
    for (let i = 0; i <= steps; i++) {
      window.scrollTo(0, (total * i) / steps);
      await new Promise((r) => setTimeout(r, 50));
    }
    running = false;
    return intervals;
  });

  const sorted = [...frames].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
  const long = frames.filter((f) => f > 50).length;
  results.push({ name, fps: (1000 / p50).toFixed(1), p50, p95, long });

  await ctx.close();
}

console.log(`390x844, CPU throttled ${CPU_THROTTLE}x\n`);
console.log('variant                p50ms   p95ms    ~fps   frames>50ms');
for (const r of results) {
  console.log(
    r.name.padEnd(22),
    r.p50.toFixed(1).padStart(5),
    r.p95.toFixed(1).padStart(7),
    r.fps.padStart(7),
    String(r.long).padStart(9),
  );
}
await browser.close();
