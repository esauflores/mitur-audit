// coverage-frame-capture.mjs
// Capture the three metrics sets from the HW8 spec:
//   1. Coverage  — critical CSS presence, unused JS/CSS, source attribution
//   2. Performance frame chart — dropped frames during load / scroll / interaction
//   3. Layers & animations — paint-layer count, will-change / transform3d use
//
// MITUR-adapted (vs apnews-audit/scripts/coverage-frame-capture.mjs):
// - Mobile viewport (412×915), not desktop
// - No consent popup to dismiss (MITUR has no OneTrust)
// - Classify sources for MITUR's third-party surface (Google-only) instead
//   of AP News's ad-bidder / Permutive / Viafoura / webcontentassessor
// - Above-the-fold rule patterns match MITUR's theme (Bootstrap + theme classes)
//
// Run:  node scripts/coverage-frame-capture.mjs
// Output: stdout summary + writes /tmp/mitur-coverage-frame-capture.json

import puppeteer from 'puppeteer-core';
import { setTimeout as sleep } from 'node:timers/promises';
import fs from 'node:fs/promises';

const PROFILE = '/tmp/chromium-mitur';
const HOME = 'https://www.mitur.gob.sv/';
const OUTPUT = '/tmp/mitur-coverage-frame-capture.json';

// ---------- 1. Launch + start coverage + start tracing ----------
const browser = await puppeteer.launch({
  executablePath: '/usr/lib/chromium/chromium',
  headless: 'new',
  userDataDir: PROFILE,
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  defaultViewport: { width: 412, height: 915 },
});

const page = await browser.newPage();
const client = await page.createCDPSession();

await Promise.all([
  page.coverage.startJSCoverage({ resetOnNavigation: false, reportAnonymousScripts: true }),
  page.coverage.startCSSCoverage({ resetOnNavigation: false }),
]);

await client.send('Tracing.start', {
  traceConfig: { includedCategories: ['disabled-by-default-devtools.timeline', 'devtools.timeline'] },
  bufferUsageReportingIntervalMs: 1000,
});

// ---------- 2. Navigate + measure load frames ----------
await page.goto(HOME, { waitUntil: 'domcontentloaded', timeout: 60000 });
await sleep(8000);

async function captureFrames(label, durationMs) {
  try {
    const result = await page.evaluate(async (label, durationMs) => {
      const frames = [];
      let last = performance.now();
      const next = last + durationMs;
      while (last < next) {
        await new Promise((r) => requestAnimationFrame((t) => {
          const dt = t - last;
          frames.push({ t, dt, dropped: dt > 16.67 * 1.5 });
          last = t;
          r();
        }));
      }
      return {
        label,
        totalFrames: frames.length,
        droppedFrames: frames.filter((f) => f.dropped).length,
        avgDt: frames.reduce((a, f) => a + f.dt, 0) / frames.length,
        maxDt: Math.max(...frames.map((f) => f.dt)),
        frames: frames.slice(0, 200),
      };
    }, label, durationMs);
    return result;
  } catch (e) {
    console.error(`captureFrames(${label}) failed:`, e.message);
    return null;
  }
}

const loadFrames = await captureFrames('load', 5000);

// ---------- 3. Scroll-trigger frames ----------
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await sleep(1000);
const scrollFrames = await captureFrames('scroll', 3000);
await page.evaluate(() => window.scrollTo(0, 0));
await sleep(500);

// ---------- 4. Click-trigger frames ----------
// Pick a clickable target that is actually visible and not the homepage logo /
// a hidden skip-link. Strategy: first <button>, then <a> with non-empty text
// and on-screen position (top in [10, 800], not a 0×0 link).
const clickResult = await page.evaluate(() => {
  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.top >= 0 && r.top < 800 && r.left >= 0;
  };
  const candidates = [
    ...document.querySelectorAll('button'),
    ...document.querySelectorAll('a[href]'),
  ];
  for (const el of candidates) {
    if (!isVisible(el)) continue;
    const text = (el.textContent || '').trim();
    if (!text) continue;
    if (/^(logo|skip)$/i.test(text)) continue;
    const r = el.getBoundingClientRect();
    return { found: true, tag: el.tagName, top: r.top, left: r.left, text: text.slice(0, 40) };
  }
  return { found: false };
});

let clickFrames = null;
if (clickResult.found) {
  await page.mouse.click(Math.max(5, clickResult.left + 10), Math.max(5, clickResult.top + 10));
  await sleep(500);
  clickFrames = await captureFrames('click', 2000);
}

// ---------- 5. Layer + animation introspection ----------
await client.send('LayerTree.enable').catch(() => {});

const willChangeInfo = await page.evaluate(() => {
  const matches = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules || [])) {
        if (!rule.style) continue;
        const wc = rule.style.getPropertyValue('will-change');
        const t = rule.style.transform || '';
        if (wc && wc !== 'auto') matches.push({ selector: rule.selectorText || '(media)', willChange: wc, type: 'will-change' });
        if (/transform3d|translate3d|matrix3d/.test(t)) matches.push({ selector: rule.selectorText || '(media)', transform: t, type: 'translate3d' });
      }
    } catch (e) { /* cross-origin sheet, skip */ }
  }
  return matches;
});

// Inspect inline <style> blocks for critical-CSS markers
const inlineStyles = await page.evaluate(() => {
  const styles = Array.from(document.querySelectorAll('style'));
  return styles.map((s) => ({
    len: s.textContent.length,
    hasAboveFoldRules: /(\.card-img|header|nav|body\s*\{|html\s*\{|\.site-header|\.navbar|\.hero|wp-block|@media)/i.test(s.textContent),
    preview: s.textContent.slice(0, 200),
  }));
});

// Enumerate stacking contexts via DOM walk + computed-style inspection.
const stackingContexts = await page.evaluate(() => {
  const creates = (el, cs) => {
    const pos = cs.position;
    const zi = cs.zIndex;
    const opacity = parseFloat(cs.opacity || '1');
    const transform = cs.transform || '';
    const filter = cs.filter || '';
    const willChange = cs.willChange || '';
    const isolation = cs.isolation || '';
    const mixBlend = cs.mixBlendMode || '';
    const contain = cs.contain || '';
    if (pos === 'fixed' || pos === 'sticky') return `position:${pos}`;
    if ((pos === 'absolute' || pos === 'relative') && zi && zi !== 'auto') return `position:${pos} z-index:${zi}`;
    if (opacity < 1) return `opacity:${opacity}`;
    if (transform && transform !== 'none') return `transform:${transform.slice(0, 40)}`;
    if (filter && filter !== 'none') return `filter:${filter.slice(0, 40)}`;
    if (willChange && /(transform|opacity|filter|will-change)/.test(willChange)) return `will-change:${willChange}`;
    if (isolation === 'isolate') return 'isolation:isolate';
    if (mixBlend && mixBlend !== 'normal') return `mix-blend-mode:${mixBlend}`;
    if (/paint|strict|content/.test(contain)) return `contain:${contain}`;
    return null;
  };
  const ctxs = [];
  document.querySelectorAll('*').forEach((el) => {
    const cs = window.getComputedStyle(el);
    const r = creates(el, cs);
    if (r) ctxs.push({ tag: el.tagName.toLowerCase(), id: el.id || null, classes: (el.className?.toString() || '').slice(0, 60) || null, reason: r });
  });
  return ctxs;
});

const compositedCount = await page.evaluate(() => {
  const animated = document.getAnimations ? document.getAnimations().length : 0;
  const iframes = document.querySelectorAll('iframe').length;
  const canvas = document.querySelectorAll('canvas').length;
  const videos = document.querySelectorAll('video').length;
  return { animationsActive: animated, iframes, canvas, videos };
});

let scrollAnimations = { before: 0, after: 0, started: 0 };
try {
  scrollAnimations = await page.evaluate(async () => {
    const before = document.getAnimations ? document.getAnimations().length : 0;
    window.scrollTo(0, document.body.scrollHeight / 2);
    await new Promise((r) => setTimeout(r, 200));
    const after = document.getAnimations ? document.getAnimations().length : 0;
    return { before, after, started: after - before };
  });
} catch (e) {
  console.error('scrollAnimations failed:', e.message);
}

// ---------- 6. Coverage stop + collect ----------
await client.send('Tracing.end').catch(() => {});
const [jsCoverage, cssCoverage] = await Promise.all([
  page.coverage.stopJSCoverage(),
  page.coverage.stopCSSCoverage(),
]);

await browser.close();

// ---------- 7. Summarize coverage ----------
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

function classifySource(url) {
  if (!url) return 'inline';
  if (url.includes('mitur.gob.sv')) return 'first-party';
  if (url.includes('googleapis.com') || url.includes('gstatic.com') || url.includes('googletagmanager') || url.includes('google-analytics')) return 'google';
  if (url.includes('w3.org')) return 'w3c';
  if (url.includes('cloudflare') || url.includes('cf-')) return 'cdn';
  return 'third-party';
}

const result = {
  capturedAt: new Date().toISOString(),
  homepage: HOME,
  criticalCss: {
    inlineStyles,
    totalInlineBytes: inlineStyles.reduce((a, s) => a + s.len, 0),
    inlineBlocksWithAboveFoldRules: inlineStyles.filter((s) => s.hasAboveFoldRules).length,
    observation:
      inlineStyles.length === 0 || inlineStyles.every((s) => !s.hasAboveFoldRules)
        ? 'No above-the-fold critical CSS detected in inline <style> blocks'
        : 'Some inline styles present; verify above-the-fold selectors',
  },
  unusedJs: {
    totalEntries: unusedJs.length,
    totalBytes: unusedJs.reduce((a, e) => a + e.totalBytes, 0),
    totalUnusedBytes: unusedJs.reduce((a, e) => a + e.unusedBytes, 0),
    totalUnusedPct: unusedJs.reduce((a, e) => a + e.totalBytes, 0)
      ? Math.round((unusedJs.reduce((a, e) => a + e.unusedBytes, 0) / unusedJs.reduce((a, e) => a + e.totalBytes, 0)) * 1000) / 10
      : 0,
    topOffenders: unusedJs.slice(0, 10).map((e) => ({
      url: e.url,
      unusedBytes: e.unusedBytes,
      unusedPercent: Math.round(e.unusedPercent * 10) / 10,
      source: classifySource(e.url),
    })),
  },
  unusedCss: {
    totalEntries: unusedCss.length,
    totalBytes: unusedCss.reduce((a, e) => a + e.totalBytes, 0),
    totalUnusedBytes: unusedCss.reduce((a, e) => a + e.unusedBytes, 0),
    totalUnusedPct: unusedCss.reduce((a, e) => a + e.totalBytes, 0)
      ? Math.round((unusedCss.reduce((a, e) => a + e.unusedBytes, 0) / unusedCss.reduce((a, e) => a + e.totalBytes, 0)) * 1000) / 10
      : 0,
    topOffenders: unusedCss.slice(0, 10).map((e) => ({
      url: e.url,
      unusedBytes: e.unusedBytes,
      unusedPercent: Math.round(e.unusedPercent * 10) / 10,
      source: classifySource(e.url),
    })),
  },
  frameChart: {
    load: loadFrames
      ? { totalFrames: loadFrames.totalFrames, droppedFrames: loadFrames.droppedFrames, avgDtMs: Math.round(loadFrames.avgDt * 100) / 100, maxDtMs: Math.round(loadFrames.maxDt * 100) / 100, effectiveFps: Math.round((1000 / loadFrames.avgDt) * 10) / 10 }
      : null,
    scroll: scrollFrames
      ? { totalFrames: scrollFrames.totalFrames, droppedFrames: scrollFrames.droppedFrames, avgDtMs: Math.round(scrollFrames.avgDt * 100) / 100, maxDtMs: Math.round(scrollFrames.maxDt * 100) / 100, effectiveFps: Math.round((1000 / scrollFrames.avgDt) * 10) / 10 }
      : null,
    click: clickFrames
      ? { totalFrames: clickFrames.totalFrames, droppedFrames: clickFrames.droppedFrames, avgDtMs: Math.round(clickFrames.avgDt * 100) / 100, maxDtMs: Math.round(clickFrames.maxDt * 100) / 100, effectiveFps: Math.round((1000 / clickFrames.avgDt) * 10) / 10 }
      : null,
    clickTarget: clickResult,
    droppedThresholdMs: 25,
  },
  layersAndAnimations: {
    willChangeMatches: willChangeInfo.filter((m) => m.type === 'will-change'),
    translate3dMatches: willChangeInfo.filter((m) => m.type === 'translate3d'),
    compositedIndicators: compositedCount,
    scrollAnimationsStarted: scrollAnimations.started,
    stackingContexts: {
      total: stackingContexts.length,
      byReason: (() => {
        const m = {};
        stackingContexts.forEach((c) => { const k = c.reason.split(':')[0]; m[k] = (m[k] || 0) + 1; });
        return m;
      })(),
      sample: stackingContexts.slice(0, 15),
    },
  },
};

await fs.writeFile(OUTPUT, JSON.stringify(result, null, 2));

// ---------- 8. Print summary ----------
const fmtKb = (bytes) => (bytes / 1024).toFixed(1) + 'KB';

console.log('=== Critical CSS ===');
console.log('Inline <style> blocks:', inlineStyles.length);
console.log('Total inline CSS bytes:', result.criticalCss.totalInlineBytes);
console.log('Blocks with above-the-fold rules:', result.criticalCss.inlineBlocksWithAboveFoldRules);
console.log();
console.log('=== Unused JS (coverage) ===');
console.log('Total entries:', result.unusedJs.totalEntries);
console.log('Total bytes:', fmtKb(result.unusedJs.totalBytes));
console.log('Unused bytes:', fmtKb(result.unusedJs.totalUnusedBytes));
console.log('Unused %:', result.unusedJs.totalUnusedPct + '%');
console.log('Top 10 by unused bytes:');
result.unusedJs.topOffenders.forEach((e) => console.log('  ' + fmtKb(e.unusedBytes).padStart(8) + ' (' + e.unusedPercent + '%)  ' + e.source.padEnd(15) + '  ' + e.url.slice(0, 90)));
console.log();
console.log('=== Unused CSS (coverage) ===');
console.log('Total entries:', result.unusedCss.totalEntries);
console.log('Total bytes:', fmtKb(result.unusedCss.totalBytes));
console.log('Unused bytes:', fmtKb(result.unusedCss.totalUnusedBytes));
console.log('Unused %:', result.unusedCss.totalUnusedPct + '%');
console.log('Top 10 by unused bytes:');
result.unusedCss.topOffenders.forEach((e) => console.log('  ' + fmtKb(e.unusedBytes).padStart(8) + ' (' + e.unusedPercent + '%)  ' + e.source.padEnd(15) + '  ' + (e.url.startsWith('#') ? '(inline selector)' : e.url.slice(0, 90))));
console.log();
console.log('=== Frame chart (dropped = >25ms frame interval) ===');
console.log('Load  :', JSON.stringify(result.frameChart.load));
console.log('Scroll:', JSON.stringify(result.frameChart.scroll));
console.log('Click :', JSON.stringify(result.frameChart.click));
console.log('Click target:', clickResult);
console.log();
console.log('=== Layers & animations ===');
console.log('Stacking contexts (DOM-walk):', result.layersAndAnimations.stackingContexts.total);
console.log('  by trigger:');
Object.entries(result.layersAndAnimations.stackingContexts.byReason).forEach(([k, v]) => console.log('    ' + k + ': ' + v));
console.log('will-change selectors:', result.layersAndAnimations.willChangeMatches.length);
console.log('translate3d / transform3d selectors:', result.layersAndAnimations.translate3dMatches.length);
console.log('Composited indicators:', result.layersAndAnimations.compositedIndicators);
console.log('Animations started on scroll:', result.layersAndAnimations.scrollAnimationsStarted);
console.log();
console.log('Top 15 stacking-context sources:');
result.layersAndAnimations.stackingContexts.sample.slice(0, 15).forEach((c) => console.log('  ' + c.tag + (c.id ? '#' + c.id : '') + (c.classes ? '.' + c.classes.split(' ').slice(0, 2).join('.') : '') + '  via ' + c.reason));
console.log();
console.log('Full data: ' + OUTPUT);
