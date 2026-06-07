#!/usr/bin/env node
/**
 * ZoomGuru backend speed test
 * Usage: node scripts/speedtest.js [base_url]
 * Example: node scripts/speedtest.js http://localhost:3000
 *          node scripts/speedtest.js https://zoomguru.onrender.com
 */

const BASE = process.argv[2] ?? 'http://localhost:3000';
const RUNS = 10;

async function time(label, fn) {
  const times = [];
  for (let i = 0; i < RUNS; i++) {
    const t0 = performance.now();
    await fn();
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  const p50 = times[Math.floor(RUNS * 0.5)];
  const p95 = times[Math.floor(RUNS * 0.95)];
  const min = times[0];
  const max = times[times.length - 1];
  console.log(`${label.padEnd(30)} min=${min.toFixed(0)}ms  p50=${p50.toFixed(0)}ms  p95=${p95.toFixed(0)}ms  max=${max.toFixed(0)}ms`);
}

async function run() {
  console.log(`\nZoomGuru Speed Test — ${BASE}\n${'─'.repeat(70)}`);

  // Health check — no auth, no Redis, just Fastify overhead
  await time('/health (no-auth)', async () => {
    const r = await fetch(`${BASE}/health`);
    if (!r.ok) throw new Error(`health ${r.status}`);
  });

  // Analytics download — no auth, one DB insert
  await time('/analytics/download (DB write)', async () => {
    await fetch(`${BASE}/analytics/download?platform=windows`, { method: 'GET' });
  });

  console.log('\nNote: auth-gated endpoints (/ai/*, /subscription/*) require a valid JWT');
  console.log('      and device signature — test those with a real token from the Electron app.\n');
}

run().catch(console.error);
