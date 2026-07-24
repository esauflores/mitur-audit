// rendering-strategy.mjs
// Detect rendering strategy for each audited MITUR page by inspecting:
//   - HTML size + content presence BEFORE any JS executes
//   - Response headers (cache-control, x-powered-by, cf-cache-status, age)
//   - Framework markers in HTML (WordPress: wp-content, wp-includes, wp-json)
//
// MITUR-adapted (vs apnews-audit/scripts/rendering-strategy.mjs):
// - Targets read from scripts/targets.tsv (8 audited pages)
// - WordPress/Cloudflare framework markers (not Next.js/Astro/Brightspot)
// - Mobile viewport (412x915) to match the rest of the audit
// - MITUR has no consent popup, no pre-click needed
// - Cloudflare HTML cache status is the key metric (cf-cache-status: HIT
//   means edge-cached; DYNAMIC means always origin)
//
// Run:  node scripts/rendering-strategy.mjs
// Output: stdout summary + /tmp/mitur-rendering-strategy.json

import puppeteer from 'puppeteer-core';
import { setTimeout as sleep } from 'node:timers/promises';
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';

const PROFILE = '/tmp/chromium-mitur';
const OUTPUT = '/tmp/mitur-rendering-strategy.json';

// Read targets from scripts/targets.tsv (name<TAB>url per line)
const targetsContent = readFileSync('scripts/targets.tsv', 'utf8');
const TARGETS = targetsContent
  .trim()
  .split('\n')
  .filter((l) => l && !l.startsWith('#') && !l.startsWith('name'))
  .map((l) => {
    const [name, url] = l.split('\t');
    return [name, url];
  });

// MITUR/WordPress framework markers
const FRAMEWORK_MARKERS = [
  { name: 'WordPress', html: [/wp-content\//, /wp-includes\//, /wp-json\//, /<meta name="generator" content="WordPress/i], js: [/wp-content\/themes/, /wp-includes\/js/] },
  { name: 'Cloudflare', html: [/__cf_bm/, /cf-cache-status/], js: [] },
  { name: 'YOAST SEO', html: [/yoast|wp-seo/i, /yoast-schema-graph/i], js: [/yoast/i] },
  { name: 'Elementor', html: [/elementor/i, /data-elementor-type/i], js: [/elementor/i] },
  { name: 'Smart Slider 3', html: [/smartslider3|n2-ss-slider|nextend/i], js: [/smartslider|nextend/i] },
  { name: 'Popup Maker', html: [/popup-maker|pum-site-styles/i, /pum-/], js: [/popup-maker|pum-/i] },
  { name: 'Download Manager', html: [/wpdm-/i, /download-manager/i], js: [/download-manager|wpdm/i] },
];

const analyzeHtml = (html) => {
  const textIndicators = [
    /\bministerio\b/i, /\bturismo\b/i, /\bel salvador\b/i, /\bnoticias?\b/i, /\bart[íi]culo/i,
    /\bbuscar\b/i, /\bdescargas?\b/i, /\bcont[áa]ctanos\b/i, /\bpreguntas?\b/i, /\binstitucional\b/i,
    /\bactividad(es)?\b/i, /\beventos?\b/i, /\bservicios?\b/i,
  ];
  const matches = textIndicators.filter((re) => re.test(html)).length;
  const detectedFrameworks = FRAMEWORK_MARKERS.filter((f) => f.html.some((re) => re.test(html))).map((f) => f.name);
  // WordPress always SSR (PHP renders HTML before any client JS).
  // looksLikeSSR = HTML > 50 KB and has actual content text (not just a shell).
  return {
    htmlLength: html.length,
    textIndicatorMatches: matches,
    detectedFrameworks,
    looksLikeSSR: html.length > 50_000 && matches >= 3,
    looksLikeShell: html.length < 15_000,
    hasWordPressMarker: /wp-content\//.test(html) && /wp-includes\//.test(html),
  };
};

const fetchViaPuppeteer = async (page, url) => {
  let headers = null;
  let initialHtml = null;
  page.removeAllListeners('response');
  page.on('response', async (resp) => {
    if (resp.url() === url && resp.request().resourceType() === 'document') {
      try {
        headers = resp.headers();
        initialHtml = await resp.text();
      } catch {}
    }
  });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(1500);

  // Get on-wire transfer size from Performance API (handles chunked
  // transfer encoding where Content-Length header is absent).
  const transferSize = await page.evaluate((u) => {
    const entry = performance.getEntriesByType('navigation').find((e) => e.name === u)
      || performance.getEntriesByType('resource').find((e) => e.name === u);
    return entry ? { transferSize: entry.transferSize, encodedBodySize: entry.encodedBodySize, decodedBodySize: entry.decodedBodySize, nextHopProtocol: entry.nextHopProtocol } : null;
  }, url).catch(() => null);

  return { headers, initialHtml, transferSize };
};

const browser = await puppeteer.launch({
  executablePath: '/usr/lib/chromium/chromium',
  headless: 'new',
  userDataDir: PROFILE,
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  defaultViewport: { width: 412, height: 915 },
});

const results = [];
for (const [name, url] of TARGETS) {
  const page = await browser.newPage();
  try {
    const { headers, initialHtml, transferSize } = await fetchViaPuppeteer(page, url);
    const analysis = initialHtml ? analyzeHtml(initialHtml) : null;

    // Detect streaming: 'transfer-encoding: chunked' means body is sent in chunks
    const isStreamed = (headers?.['transfer-encoding'] || '').includes('chunked');
    // Detect HTML edge-cache
    const cacheControl = headers?.['cache-control'] || '';
    const cfCacheStatus = headers?.['cf-cache-status'] || '';
    const xPoweredBy = headers?.['x-powered-by'] || '';
    const server = headers?.['server'] || '';
    const contentEncoding = headers?.['content-encoding'] || '';
    const age = headers?.['age'] || '';

    results.push({
      name,
      url,
      httpStatus: 200,
      htmlSize: analysis?.htmlLength ?? null,
      compressedSize: transferSize?.transferSize ?? (parseInt(headers?.['content-length'] || '0', 10) || null),
      textIndicatorMatches: analysis?.textIndicatorMatches ?? null,
      detectedFrameworks: analysis?.detectedFrameworks ?? [],
      hasWordPressMarker: analysis?.hasWordPressMarker ?? false,
      looksLikeSSR: analysis?.looksLikeSSR ?? false,
      looksLikeShell: analysis?.looksLikeShell ?? false,
      server,
      xPoweredBy,
      cacheControl,
      cfCacheStatus,
      age,
      contentEncoding,
      isStreamed,
      strategy: (() => {
        if (!analysis) return 'unknown';
        if (analysis.looksLikeShell) return 'CSR (client shell)';
        if (analysis.looksLikeSSR) return `SSR (${xPoweredBy || 'server-rendered'})`;
        return 'partial SSR';
      })(),
      edgeCached: cfCacheStatus === 'HIT' || cfCacheStatus === 'STALE' || cfCacheStatus === 'REVALIDATED',
      // Coarse classification of whether HTML could safely be edge-cached
      // (everything except search and dates/dynamic endpoints)
      cacheable: !url.includes('?s=') && !url.includes('?p=') && !url.includes('admin-ajax'),
    });
  } catch (e) {
    results.push({ name, url, error: e.message });
  }
  await page.close();
}

await browser.close();

await fs.writeFile(OUTPUT, JSON.stringify({ capturedAt: new Date().toISOString(), pages: results }, null, 2));

// Summary table
console.log('=== MITUR rendering strategy (8 audited pages, mobile) ===');
console.log();
console.log('| Page | HTML | Compressed | Strategy | cf-cache | Cacheable | Frameworks |');
console.log('|------|-----:|-----------:|----------|----------|-----------|------------|');
for (const r of results) {
  if (r.error) {
    console.log('| ' + r.name + ' | ERR: ' + r.error + ' |');
    continue;
  }
  const html = (r.htmlSize / 1024).toFixed(0) + ' KB';
  const comp = r.compressedSize ? (r.compressedSize / 1024).toFixed(1) + ' KB' : '?';
  const strat = r.looksLikeSSR ? 'SSR (PHP)' : (r.looksLikeShell ? 'CSR shell' : 'partial');
  const edge = r.cfCacheStatus || '-';
  const cached = r.edgeCached ? '✓' : '✗';
  const cacheable = r.cacheable ? '✓' : '✗';
  console.log('| ' + r.name + ' | ' + html + ' | ' + comp + ' | ' + strat + ' | ' + edge + ' | ' + cached + ' / ' + cacheable + ' | ' + r.detectedFrameworks.join(', ') + ' |');
}
console.log();
console.log('=== Common headers (all 8 pages) ===');
const first = results.find((r) => r.headers || r.server);
if (first) {
  console.log('  server:           ' + first.server);
  console.log('  x-powered-by:     ' + first.xPoweredBy);
  console.log('  content-encoding: ' + first.contentEncoding);
  console.log('  transfer-encoding:' + (first.isStreamed ? ' chunked (streamed)' : ' not chunked'));
  console.log('  cache-control:    ' + first.cacheControl);
  console.log('  cf-cache-status:  ' + first.cfCacheStatus);
}
console.log();
console.log('=== Verdict ===');
const allDYNAMIC = results.every((r) => r.cfCacheStatus === 'DYNAMIC');
const allSSR = results.every((r) => r.looksLikeSSR);
const allPHP = results.every((r) => r.xPoweredBy?.includes('PHP'));
const allChunked = results.every((r) => r.isStreamed);
const cacheableHits = results.filter((r) => r.cacheable && !r.edgeCached).length;
console.log('  All 8 SSR (PHP):     ' + (allSSR ? 'yes' : 'no'));
console.log('  All 8 PHP/8.2.30:    ' + (allPHP ? 'yes' : 'no'));
console.log('  All 8 chunked:       ' + (allChunked ? 'yes' : 'no'));
console.log('  All 8 DYNAMIC:       ' + (allDYNAMIC ? 'yes' : 'no'));
console.log('  Cacheable but DYNAMIC: ' + cacheableHits + ' of 8');
console.log();
console.log('Full data: ' + OUTPUT);
