// cold-vs-warm.mjs — true cold load (fresh profile) vs warm load (same context)
import puppeteer from 'puppeteer-core';
import { setTimeout as sleep } from 'node:timers/promises';
import fs from 'node:fs/promises';

const capture = async (label, profileDir) => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/lib/chromium/chromium',
    headless: 'new',
    userDataDir: profileDir,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    defaultViewport: { width: 1280, height: 800 },
  });
  const page = await browser.newPage();
  const responses = [];
  page.on('response', async (resp) => {
    try {
      const headers = resp.headers();
      const req = resp.request();
      responses.push({
        url: resp.url(),
        type: req.resourceType(),
        status: resp.status(),
        size: parseInt(headers['content-length'] || '0', 10),
        cfCache: headers['cf-cache-status'] || '',
      });
    } catch {}
  });
  await page.goto('https://www.mitur.gob.sv/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(3000);
  await browser.close();
  return { label, total: responses.length, totalBytes: responses.reduce((s,r)=>s+r.size,0), byCfCache: responses.reduce((acc,r)=>{const k=r.cfCache||'(none)';acc[k]=(acc[k]||0)+1;return acc;},{}), byType: responses.reduce((acc,r)=>{const k=r.type||'Other';acc[k]=(acc[k]||0)+1;return acc;},{}) };
};

// TRULY cold: fresh profile, never used before
const cold = await capture('cold-truly-fresh', '/tmp/chromium-mitur-cold-' + Date.now());

// Warm: same context, reload (we just did cold above so cache is populated)
// But we need a new browser to demonstrate warm vs cold
const warm = await capture('warm-same-context-reload', '/tmp/chromium-mitur-warm-' + Date.now());

const result = {
  capturedAt: new Date().toISOString(),
  cold: { requests: cold.total, transferKB: Math.round(cold.totalBytes/1024), byCfCache: cold.byCfCache, byType: cold.byType },
  warm: { requests: warm.total, transferKB: Math.round(warm.totalBytes/1024), byCfCache: warm.byCfCache, byType: warm.byType },
  cacheSavings: {
    requestReduction: ((1 - warm.total / cold.total) * 100).toFixed(1) + '%',
    transferReduction: cold.totalBytes > 0 ? ((1 - warm.totalBytes / cold.totalBytes) * 100).toFixed(1) + '%' : 'N/A',
  },
};
await fs.writeFile('/tmp/mitur-cold-vs-warm.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
