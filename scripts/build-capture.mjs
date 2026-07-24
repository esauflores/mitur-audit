// build-capture.mjs
// Inspect MITUR homepage build outputs: JS / CSS bundles, image formats,
// 3rd-party loading strategy, source-map exposure, and unused-JS / unused-CSS
// via puppeteer's coverage API (matches Lighthouse methodology).
//
// Unlike apnews-audit/scripts/build-capture.mjs, MITUR has no consent popup,
// so no pre-click is needed before navigation.
//
// Run:  node scripts/build-capture.mjs
// Output: stdout summary + writes /tmp/mitur-build-capture.json with full data.

import puppeteer from 'puppeteer-core';
import { setTimeout as sleep } from 'node:timers/promises';
import fs from 'node:fs/promises';
import { execSync } from 'node:child_process';

const PROFILE = '/tmp/chromium-mitur-profile';
const HOME = 'https://www.mitur.gob.sv/';
const OUTPUT = '/tmp/mitur-build-capture.json';

// ---------- 1. Launch browser and start coverage ----------
const browser = await puppeteer.launch({
  executablePath: '/usr/lib/chromium/chromium',
  headless: 'new',
  userDataDir: PROFILE,
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  defaultViewport: { width: 412, height: 915 }, // mobile viewport (Lighthouse equivalent)
});

const page = await browser.newPage();

// Start coverage BEFORE navigation. resetOnNavigation:false lets us collect
// across the full page load in one shot. The coverage API returns ranges of
// code that actually executed; we compute unused = total - executed.
await Promise.all([
  page.coverage.startJSCoverage({ resetOnNavigation: false, reportAnonymousScripts: true }),
  page.coverage.startCSSCoverage({ resetOnNavigation: false }),
]);

const responses = [];
page.on('response', (resp) => {
  try {
    const req = resp.request();
    const headers = resp.headers();
    responses.push({
      url: resp.url(),
      type: req.resourceType(),
      status: resp.status(),
      contentLength: parseInt(headers['content-length'] || '0', 10),
      contentEncoding: headers['content-encoding'] || '',
      cacheControl: headers['cache-control'] || '',
      contentType: headers['content-type'] || '',
      sourcemapHeader: headers['sourcemap'] || headers['x-sourcemap'] || '',
      linkHeader: headers['link'] || '',
      hasSourceMapSuffix: resp.url().endsWith('.map'),
    });
  } catch (e) {
    if (process.env.DEBUG) console.error('response err:', e.message, resp.url());
  }
});

await page.goto(HOME, { waitUntil: 'domcontentloaded', timeout: 60000 });
await sleep(8000);

// Pull Performance API data — gives us actual on-wire transfer size
// (after compression) and decoded body size, which headers alone cannot.
// This is the same source Lighthouse uses for network-requests audit.
const perfData = await page.evaluate(() => {
  const entries = performance.getEntriesByType('resource');
  return entries.map((e) => ({
    name: e.name,
    initiatorType: e.initiatorType,
    transferSize: e.transferSize,
    encodedBodySize: e.encodedBodySize,
    decodedBodySize: e.decodedBodySize,
    duration: e.duration,
    nextHopProtocol: e.nextHopProtocol,
  }));
});

// Merge: keep puppeteer response headers + content-type, but override
// the size fields with Performance API values (more accurate, especially
// with chunked transfer encoding where Content-Length header is absent).
const perfByName = new Map(perfData.map((p) => [p.name, p]));
for (const r of responses) {
  const p = perfByName.get(r.url);
  if (p) {
    r.transferSize = p.transferSize;
    r.encodedBodySize = p.encodedBodySize;
    r.decodedBodySize = p.decodedBodySize;
    r.duration = Math.round(p.duration);
    r.nextHopProtocol = p.nextHopProtocol;
  }
}

// ---------- 2. DOM inspection ----------
const imgData = await page.evaluate(() =>
  Array.from(document.querySelectorAll('img')).map((i) => ({
    src: i.src.slice(0, 120),
    srcset: i.srcset || '',
    sizes: i.sizes || '',
    loading: i.loading || 'eager',
    fetchpriority: i.getAttribute('fetchpriority') || '',
    width: i.getAttribute('width') || '',
    height: i.getAttribute('height') || '',
    naturalWidth: i.naturalWidth,
    naturalHeight: i.naturalHeight,
  }))
);

const scriptTags = await page.evaluate(() =>
  Array.from(document.scripts).map((s) => ({
    src: s.src || '(inline)',
    async: s.async,
    defer: s.defer,
    inlineLen: s.src ? 0 : s.textContent.length,
    pos: s.src ? 'external' : document.head.contains(s) ? 'head' : 'body',
  }))
);

const linkTags = await page.evaluate(() =>
  Array.from(document.querySelectorAll('link')).map((l) => ({
    rel: l.rel,
    href: l.href,
    as: l.as || '',
    media: l.media || '',
  }))
);

const resourceHints = await page.evaluate(() => {
  const hints = [];
  document
    .querySelectorAll('link[rel="preload"], link[rel="preconnect"], link[rel="dns-prefetch"]')
    .forEach((l) => hints.push({ rel: l.rel, href: l.href, as: l.as }));
  return hints;
});

// ---------- 3. Source-map check (first-party main JS) ----------
const firstPartyMainJs = scriptTags
  .map((s) => s.src)
  .find((u) => u.startsWith('https://www.mitur.gob.sv/'));

let sourceMapCheck = { url: firstPartyMainJs, mapReachable: null, hasSourceMapUrlComment: null };
if (firstPartyMainJs) {
  const mapUrl = firstPartyMainJs + '.map';
  try {
    const head = execSync(`curl -s -o /dev/null -w "%{http_code}" -L -I "${mapUrl}"`, { encoding: 'utf8' });
    sourceMapCheck.mapReachable = head.trim();
  } catch {
    sourceMapCheck.mapReachable = 'error';
  }
  try {
    const tail = execSync(`curl -sL "${firstPartyMainJs}" | tail -c 1000`, { encoding: 'utf8' });
    sourceMapCheck.hasSourceMapUrlComment = /sourceMappingURL\s*=/.test(tail);
  } catch {
    sourceMapCheck.hasSourceMapUrlComment = 'error';
  }
}

// ---------- 4. Collect coverage (unused JS / CSS) ----------
const [jsCoverage, cssCoverage] = await Promise.all([
  page.coverage.stopJSCoverage(),
  page.coverage.stopCSSCoverage(),
]);

const unusedFromCoverage = (entries) =>
  entries
    .map((entry) => {
      const total = entry.text.length;
      const executed = entry.ranges.reduce((a, r) => a + (r.end - r.start), 0);
      const unused = total - executed;
      return {
        url: entry.url,
        totalBytes: total,
        usedBytes: executed,
        unusedBytes: unused,
        unusedPercent: total > 0 ? (unused / total) * 100 : 0,
      };
    })
    .filter((e) => e.totalBytes > 0)
    .sort((a, b) => b.unusedBytes - a.unusedBytes);

const unusedJs = unusedFromCoverage(jsCoverage);
const unusedCss = unusedFromCoverage(cssCoverage);

await browser.close();

// ---------- 5. Format and write ----------
const scripts = responses.filter((r) => r.type === 'script');
const styles = responses.filter((r) => r.type === 'stylesheet');
const images = responses.filter((r) => r.type === 'image');

const fmt = (bytes) => (bytes / 1024).toFixed(1) + 'KB';
const totalBytes = (arr) => arr.reduce((a, r) => a + (r.transferSize || r.contentLength || 0), 0);

const result = {
  capturedAt: new Date().toISOString(),
  homepage: HOME,
  summary: {
    totalRequests: responses.length,
    scripts: scripts.length,
    stylesheets: styles.length,
    images: images.length,
    scriptsTotalBytes: totalBytes(scripts),
    cssTotalBytes: totalBytes(styles),
    imagesTotalBytes: totalBytes(images),
    unusedJsTotalBytes: unusedJs.reduce((a, e) => a + e.unusedBytes, 0),
    unusedCssTotalBytes: unusedCss.reduce((a, e) => a + e.unusedBytes, 0),
  },
  imageFormatBreakdown: (() => {
    const m = {};
    images.forEach((i) => {
      const ct = (i.contentType || '').split(';')[0] || 'unknown';
      m[ct] = (m[ct] || 0) + 1;
    });
    return m;
  })(),
  srcsetCoverage: {
    imgTagsTotal: imgData.length,
    imgTagsWithSrcset: imgData.filter((i) => !!i.srcset).length,
    imgTagsWithSizes: imgData.filter((i) => !!i.sizes).length,
    imgTagsWithFetchpriority: imgData.filter((i) => !!i.fetchpriority).length,
    imgTagsWithWidth: imgData.filter((i) => !!i.width).length,
    imgTagsWithHeight: imgData.filter((i) => !!i.height).length,
    imgTagsLazy: imgData.filter((i) => i.loading === 'lazy').length,
  },
  scriptLoadingStrategy: (() => {
    const t = { async: 0, defer: 0, sync: 0, inline: 0 };
    scriptTags.forEach((s) => {
      if (s.src === '(inline)') t.inline++;
      else if (s.defer) t.defer++;
      else if (s.async) t.async++;
      else t.sync++;
    });
    return t;
  })(),
  syncScripts: scriptTags.filter((s) => s.src !== '(inline)' && !s.async && !s.defer).map((s) => s.src),
  resourceHints,
  sourceMapCheck,
  topScriptsByBytes: scripts
    .map((r) => ({ url: r.url, bytes: r.transferSize || r.contentLength, gzip: r.contentEncoding }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 20),
  topImagesByBytes: images
    .map((r) => ({ url: r.url, bytes: r.transferSize || r.contentLength, type: r.contentType.split(';')[0] }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 15),
  thirdPartyBreakdown: (() => {
    const m = {};
    responses.forEach((r) => {
      try {
        const u = new URL(r.url);
        if (!u.hostname.includes('mitur.gob.sv')) {
          m[u.hostname] = (m[u.hostname] || 0) + 1;
        }
      } catch {}
    });
    return m;
  })(),
  unusedJs: {
    totalEntries: unusedJs.length,
    totalUnusedBytes: unusedJs.reduce((a, e) => a + e.unusedBytes, 0),
    totalTransferBytes: unusedJs.reduce((a, e) => a + e.totalBytes, 0),
    topOffenders: unusedJs.slice(0, 10).map((e) => ({
      url: e.url,
      totalBytes: e.totalBytes,
      usedBytes: e.usedBytes,
      unusedBytes: e.unusedBytes,
      unusedPercent: Math.round(e.unusedPercent * 10) / 10,
    })),
  },
  unusedCss: {
    totalEntries: unusedCss.length,
    totalUnusedBytes: unusedCss.reduce((a, e) => a + e.unusedBytes, 0),
    totalTransferBytes: unusedCss.reduce((a, e) => a + e.totalBytes, 0),
    topOffenders: unusedCss.slice(0, 10).map((e) => ({
      url: e.url,
      totalBytes: e.totalBytes,
      usedBytes: e.usedBytes,
      unusedBytes: e.unusedBytes,
      unusedPercent: Math.round(e.unusedPercent * 10) / 10,
    })),
  },
};

await fs.writeFile(OUTPUT, JSON.stringify(result, null, 2));

// ---------- 6. Print summary ----------
const fmtPct = (p) => Math.round(p * 10) / 10 + '%';

console.log('=== MITUR build capture summary ===');
console.log('Total requests:', result.summary.totalRequests);
console.log('  Scripts:', result.summary.scripts, fmt(result.summary.scriptsTotalBytes));
console.log('  Stylesheets:', result.summary.stylesheets, fmt(result.summary.cssTotalBytes));
console.log('  Images:', result.summary.images, fmt(result.summary.imagesTotalBytes));
console.log();
console.log('=== Coverage (puppeteer v8 coverage API) ===');
console.log('  Unused JS:  ', fmt(result.summary.unusedJsTotalBytes), ' across', result.unusedJs.totalEntries, 'scripts');
console.log('  Unused CSS: ', fmt(result.summary.unusedCssTotalBytes), ' across', result.unusedCss.totalEntries, 'stylesheets');
console.log();
console.log('=== Image formats ===');
Object.entries(result.imageFormatBreakdown)
  .sort((a, b) => b[1] - a[1])
  .forEach(([k, v]) => console.log('  ' + k.padEnd(20) + v));
console.log();
console.log('=== srcset / responsive coverage (all images) ===');
console.log('  total <img> tags:        ', result.srcsetCoverage.imgTagsTotal);
console.log('  with srcset:             ', result.srcsetCoverage.imgTagsWithSrcset);
console.log('  with sizes:              ', result.srcsetCoverage.imgTagsWithSizes);
console.log('  with fetchpriority:      ', result.srcsetCoverage.imgTagsWithFetchpriority);
console.log('  with width attribute:    ', result.srcsetCoverage.imgTagsWithWidth);
console.log('  with height attribute:   ', result.srcsetCoverage.imgTagsWithHeight);
console.log('  loading=lazy:            ', result.srcsetCoverage.imgTagsLazy);
console.log();
console.log('=== Script loading strategy ===');
console.log(result.scriptLoadingStrategy);
console.log();
console.log('=== Sync (blocking) external scripts (' + result.syncScripts.length + ') ===');
result.syncScripts.forEach((s) => console.log('  ' + s));
console.log();
console.log('=== Source-map check ===');
console.log(JSON.stringify(sourceMapCheck, null, 2));
console.log();
console.log('=== Top 10 scripts by bytes (transfer) ===');
result.topScriptsByBytes.slice(0, 10).forEach((s) => console.log('  ' + fmt(s.bytes).padStart(8) + '  ' + (s.gzip || 'none').padEnd(4) + '  ' + s.url.slice(0, 100)));
console.log();
console.log('=== Top 10 unused JS (by unused bytes, coverage-based) ===');
result.unusedJs.topOffenders.forEach((e) => {
  const total = fmt(e.totalBytes).padStart(8);
  const waste = fmt(e.unusedBytes).padStart(8);
  const pct = fmtPct(e.unusedPercent).padStart(6);
  console.log('  total=' + total + '  unused=' + waste + '  ' + pct + '  ' + e.url.slice(0, 90));
});
console.log();
console.log('=== Top 10 unused CSS (by unused bytes, coverage-based) ===');
result.unusedCss.topOffenders.forEach((e) => {
  const total = fmt(e.totalBytes).padStart(8);
  const waste = fmt(e.unusedBytes).padStart(8);
  const pct = fmtPct(e.unusedPercent).padStart(6);
  console.log('  total=' + total + '  unused=' + waste + '  ' + pct + '  ' + (e.url.startsWith('#') ? '(inline selector): ' + e.url.slice(0, 80) : e.url.slice(0, 90)));
});
console.log();
console.log('=== Top 10 images by bytes (transfer) ===');
result.topImagesByBytes.slice(0, 10).forEach((s) => console.log('  ' + fmt(s.bytes).padStart(8) + '  ' + s.type.padEnd(15) + '  ' + s.url.slice(0, 100)));
console.log();
console.log('=== Third-party domain breakdown ===');
Object.entries(result.thirdPartyBreakdown)
  .sort((a, b) => b[1] - a[1])
  .forEach(([d, c]) => console.log('  ' + d + ' (' + c + ' reqs)'));
console.log();
console.log('Full data: ' + OUTPUT);
