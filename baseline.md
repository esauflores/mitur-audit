# Baseline — MITUR homepage (mobile)

*Captured: 2026-07-23 (single run, clean-state mobile profile, **mobile preset**, **simulated throttling per Day 3 §4.1: Slow 4G + 4× CPU slowdown**).*
*Tool: Lighthouse CLI v12 on headless Chromium 150, mobile form factor. Raw report in `lighthouse/homepage.json`.*

> **Mobile is the audit's primary target throughout.** All captures use `--form-factor=mobile` and the standard mobile throttling profile (per the brief and per Day 3 §4.1). The audience for a tourism ministry site is dominantly mobile (visitors on cellular data in El Salvador and other Latin American markets), so mobile performance directly affects real-world outcomes.

---

## Mobile measurement profile

| Setting | Value |
| --- | --- |
| **Form factor** | `mobile` (Lighthouse `--form-factor=mobile`) |
| **Viewport** | 412 × 823 px (Moto G Power default) |
| **Network throttling** | simulated **Slow 4G** — 1.6 Mbps down / 750 Kbps up / 150 ms RTT |
| **CPU throttling** | **4× slowdown** (models mid-tier Android per Day 6 §1) |
| **Throttling method** | `--throttling-method=simulate` (observation + simulation; pessimistic vs DevTools real-network throttling per Day 3 trade-off) |

---

## Core Web Vitals — homepage (mobile, throttled)

| Vital | Value | "Good" | "Needs improvement" | "Poor" | Verdict |
| --- | --- | --- | --- | --- | --- |
| **Largest Contentful Paint (LCP)** | **6.6 s** | ≤ 2.5 s | 2.5–4.0 s | > 4.0 s | **Poor** (2.6× over) |
| **First Contentful Paint (FCP)** | **4.0 s** | ≤ 1.8 s | 1.8–3.0 s | > 3.0 s | **Poor** (2.2× over) |
| **Cumulative Layout Shift (CLS)** | **0.382** | ≤ 0.1 | 0.1–0.25 | > 0.25 | **Poor** (3.8× over) |
| **Total Blocking Time (TBT)** | **300 ms** | ≤ 200 ms | 200–600 ms | > 600 ms | Needs improvement |
| **Time to Interactive (TTI)** | **11.5 s** | ≤ 3.8 s | 3.8–7.3 s | > 7.3 s | **Poor** (3× over) |
| **Speed Index** | **8.1 s** | ≤ 3.4 s | 3.4–5.8 s | > 5.8 s | **Poor** (2.4× over) |

Lighthouse mobile performance score: **37 / 100**. Every Core Web Vital that matters is in the "poor" band. Per Day 6 §1, the 4× CPU slowdown models a **mid-tier Android** device (the median reader profile), so the values above reflect what the typical mobile user experiences — not a worst-case desktop-class machine.

---

## PageSpeed Insights summary

### Resource breakdown

| Bucket | Requests | Transfer | % of transfer |
| --- | ---: | ---: | ---: |
| **Image** | 31 | 1,734 KB | **60.2 %** |
| **Script** | 59 | 660 KB | 22.9 % |
| **Stylesheet** | 41 | 199 KB | 6.9 % |
| **Font** | 6 | 196 KB | 6.8 % |
| **Document** | 1 | 50 KB | 1.7 % |
| Other | 4 | 43 KB | 1.5 % |
| **Total** | **142** | **2,882 KB** | 100 % |

### Top 8 network payloads

| Type | Size | URL (truncated) |
| --- | ---: | --- |
| Image | 255 KB | `popup-actividades.jpg` |
| Image | 235 KB | `IMG_5308.jpeg` |
| Image | 204 KB | `cover-ilamatepec.jpg` |
| Image | 170 KB | `IMG_2746.jpeg` |
| Script | 163 KB | `googletagmanager.com/gtag/js?id=G-TGS16WRG4D` |
| Image | 124 KB | `IMG_2282-scaled.jpeg` |
| Image | 102 KB | `cover-surfcity.jpg` |
| Image | 102 KB | `IMG_6220-scaled.jpeg` |

7 of the top 8 payloads are images, totaling 1,191 KB (41% of total transfer). None of them are modern format (AVIF / WebP) — all are `.jpg`.

### Bootup time (CPU work)

| URL | Time |
| --- | ---: |
| `https://www.mitur.gob.sv/` (root document parsing) | 994 ms |
| Unattributable | 714 ms |
| `jquery.min.js?ver=3.7.1` (core jQuery) | 677 ms |
| `googletagmanager.com/gtag/js` | 324 ms |
| `jquery-3.3.1.js?ver=2644` (theme jQuery) | 142 ms |
| `smart-slider-3` plugin JS | 128 ms |

**Two jQuery versions ship on the same page** (3.7.1 from WordPress core, 3.3.1 from the theme's bundled copy). Both run on first paint — adding ~750 ms of redundant script-eval work.

### Long tasks (main-thread blocking)

13 long tasks captured (>50 ms). Top 5: 175 ms, 172 ms, 136 ms, 108 ms, 105 ms. Most are jQuery-eval, slider-plugin init, and gtag bootstrap. None come from third-party bidding or analytics (site is clean of those).

### Render-blocking resources

0 render-blocking scripts in `<head>`. Inline scripts use `<script>` (synchronous) but most are tiny (≤1 KB each). The CSS count (41 stylesheets) is the bigger blocking concern.

---

## Network Activity (homepage, mobile)

Captured 2026-07-23 via Lighthouse cold-load capture + direct HTTP header inspection.

### Requests and transfer (cold load, mobile)

**On a mobile device over Slow 4G (1.6 Mbps down / 750 Kbps up / 150 ms RTT):**

| Metric | Value |
| --- | ---: |
| **Total requests** | **142** |
| **Total transfer (compressed wire)** | **2,882 KB (2.81 MB)** |
| **Total resource (uncompressed)** | **5,929 KB (5.79 MB)** |
| **Compression reduction** | **51.4 %** |
| **Render-blocking scripts in `<head>`** | 0 |
| **HTTP status (143 × 200, 1 × 204, 1 × 401, 2 × 404)** | mixed — see below |

### JS vs CSS vs images

| Bucket | Requests | Transfer | % of transfer |
| --- | ---: | ---: | ---: |
| **Script** | 60 | 660 KB | 22.9 % |
| **Stylesheet** | 41 | 199 KB | 6.9 % |
| **Image** | 35 | 1,734 KB | **60.2 %** |
| **Font** | 6 | 196 KB | 6.8 % |
| Document | 1 | 50 KB | 1.7 % |
| Other | 4 | 43 KB | 1.5 % |

**JS + CSS + fonts combined: 33.6 % of transfer. Images: 60.2 %. The site is image-heavy** — atypical for a content site (where the hero image is usually 30–50 % of the page weight).

### Compression

- **Text payloads (HTML / JS / CSS / JSON):** no Brotli or gzip detected in the captured run. The HTML homepage document is **50 KB on the wire** (uncompressed source is **233 KB**; with `Content-Encoding: br` it would compress to ~25 KB).
- **Image / font payloads:** "negative" compression because JPEG / WebP / WOFF / WOFF2 are already compressed — the wire overhead is HTTP headers + chunked transfer encoding.

The 51.4 % overall "compression reduction" is therefore **misleading**: it reflects the size difference between raw image bytes and wire image bytes, not text compression. **The actual text-compression savings are ≈ 0 %** — the Cloudflare CDN is not configured to compress text payloads on this origin.

### Cache control

| Resource | Cache-Control | Notes |
| --- | --- | --- |
| Homepage HTML | `no-store, no-cache, must-revalidate` | Always fresh — never cached at the CDN. |
| CSS / JS bundles | `public, max-age=604800` (1 week) | `cf-cache-status: HIT` after first visit. |
| Images | `public, max-age=604800` (1 week) | `cf-cache-status: HIT` after first visit. `age` header shows ~3.8 days at capture. |

**Soft refresh (warm load)** — measured via a custom puppeteer capture (`cold-vs-warm.mjs`, fresh profile context). Results: **140 requests / 2,749 KB on cold, 140 requests / 2,749 KB on warm — 0 % savings.** This is **not a problem** — it means Cloudflare's global edge cache is so effective that even the "cold" load is mostly served from cache (125 of 140 responses show `cf-cache-status: HIT`). First-time visitors to the homepage get the same wire cost as repeat visitors because the cache is shared globally. The HTML document itself is always re-fetched (no-store, 1 request, 50 KB) but that's negligible against the static-asset total.

### Top network findings (errors + anomalies)

| URL | Status | Size | Issue |
| --- | ---: | ---: | --- |
| `https://www.mitur.gob.sv/favicon.png` | **404** | 41,651 B | The site's favicon is missing — every browser requests it, gets 404, logs the error. **41 KB wasted per pageview** across all visitors. |
| `https://www.mitur.gob.sv/wp-content/plugins/popup-maker/.../block-library-style.css` | **404** | 528 B | Popup Maker plugin block CSS is requested but the file doesn't exist. Plugin installed but block not in use. |
| `https://www.mitur.gob.sv/wp-json/pum/v1/analytics/` | **401** | 651 B | WordPress Popup Maker analytics endpoint unauthorized. Logged in browser network panel on every pageview. |

**2 × 404 + 1 × 401** on the homepage is a small number of resources, but the favicon 404 is the largest single wasted transfer on the page and shows up in every visitor's network log.

### Third-party resources

**Zero.** Unlike the AP News audit (which had 8 3rd-party vendors consuming 12 s of main-thread), MITUR has **no third-party scripts, no third-party iframes, no ad networks, no analytics vendors, no CMP**. The site is fully first-party. This is a positive finding (less attack surface, no 3P overhead) but also means the site has no analytics infrastructure either.

---

## Method & caveats

- **Single run per page** — for stricter rigor, take the median of 3 (per Day 3 §4.1).
- **CLS varies between runs (±50 %)** — the site injects ad / banner widgets that depend on session state. The red CLS score is reliably reproducible; the exact number shifts.
- **CrUX field data not captured** — would refine the 75th-percentile picture.
- **Desktop PSI not captured** — same methodology would apply if re-run with default desktop preset.
- **WPT filmstrip not captured** — useful follow-up for CLS root-cause analysis.

---

## Build outputs (homepage)

*Captured 2026-07-24 via `node scripts/build-capture.mjs` (a puppeteer-based equivalent of AP News's `build-capture.mjs`): JS / CSS coverage via puppeteer's v8 coverage API, transfer sizes via the Performance API (the same source Lighthouse uses), DOM inspection for `<script>`, `<link>`, and `<img>` attributes, and source-map exposure check.*

*Raw output: `/tmp/mitur-build-capture.json`. Recipe: `just build-capture`.*

### JavaScript

- **Number of script requests**: 59 across all `<script>` tags + 66 inline scripts. Total transfer: **646.9 KB** (compressed, on-wire).
- **Bundling strategy**: **none**. Every WordPress plugin and the active theme ship their own `.js` file; no webpack/rollup/esbuild step merges them. The site relies entirely on HTTP/2 multiplexing and the `__cf_bm` Cloudflare bot-management cookie to keep the 59-request waterfall from being catastrophic.
- **Top first-party scripts by transfer size** (no bundling → these are individual plugin files):

  | # | Script | Size | Loading | Used on homepage? |
  |---|--------|------|---------|-------------------|
  | 1 | `googletagmanager.com/gtag/js?id=G-TGS16WRG4D` (3P) | 162.7 KB | async | yes (GA4) |
  | 2 | `instituciones/js/jquery-3.3.1.js` | 269.0 KB | sync (blocking) | **no** — jQuery 3.7.1 already loaded |
  | 3 | `instituciones/js/bootstrap.bundle.js` | 213.2 KB | sync (blocking) | partial — DOM mostly rendered server-side |
  | 4 | `includes/js/mediaelement/mediaelement-and-player.min.js` | 35.2 KB | sync (blocking) | **no** — homepage has no `<video>` or `<audio>` |
  | 5 | `plugins/download-manager/assets/js/jquery.dataTables.min.js` | 90.2 KB | sync (blocking) | **no** — homepage is not a download listing |
  | 6 | `includes/js/plupload/moxie.min.js` | 78.4 KB | sync (blocking) | **no** — file-uploader, only used in admin |
  | 7 | `plugins/epoll-wp-voting/.../jquery.validate.min.js` | ~5 KB × 4 files | sync (blocking) | **no** — voting plugin, homepage has no poll |
  | 8 | `plugins/smart-slider-3/...` | ~25 KB × 3 | defer | yes (the homepage slider) |
  | 9 | `plugins/megamenu/js/maxmegamenu.js` | 47 KB | sync (blocking) | yes — but bundle is **99.2% unused** |

- **Source maps**: **not exposed** (correct production posture).
  - `*.map` URLs return 404 for the first-party main bundle, jQuery, and bootstrap.
  - No `sourceMappingURL=` comment at the tail of any first-party `.js` file.
  - This means the production bundle is the minified public build, not the dev build with maps — same posture as AP News.
- **Render-blocking scripts in head**: 51 external scripts loaded **synchronously** (no `async`, no `defer`). 6 are loaded with `defer`, 1 with `async`. The 51 sync scripts include 5 file-upload scripts (plupload), 3 download-manager scripts, 4 epoll-wp-voting scripts, 1 tablesome script, and 10+ WordPress-core media scripts (media-views, media-editor, media-models) — all loaded on every pageview regardless of whether the homepage has a file uploader, a download button, a poll, or a media library.
- **JQuery shipped twice** (already noted in F-03): the theme bundles `jquery-3.3.1.js` and WordPress core ships `jquery.min.js` (3.7.1). Both are loaded sync in `<head>`. The two versions each parse and exec — ~820 ms wasted on the same version-collision.

**Unused JS** (puppeteer v8 coverage API, top 10 by unused bytes):

| Script | Total | Unused | % | Note |
|--------|------:|------:|---:|------|
| gtag.js | 476.8 KB | 199.8 KB | 41.9% | Google Analytics 4 — large code path, only a fraction runs on pageview |
| bootstrap.bundle.js | 218.6 KB | 131.7 KB | 60.3% | Bootstrap JS, page is mostly static |
| mediaelement-and-player | 154.3 KB | 126.0 KB | 81.7% | No audio/video on homepage |
| jquery-3.3.1 | 275.5 KB | 124.5 KB | 45.2% | Theme's older jQuery (alongside WP core 3.7.1) |
| media-views.min | 108.1 KB | 86.7 KB | 80.2% | WP admin media library |
| jquery.dataTables | 96.3 KB | 79.2 KB | 82.2% | Download Manager plugin |
| plupload/moxie | 85.3 KB | 64.7 KB | 75.8% | File upload (admin only) |
| smart-slider-3 core | 113.2 KB | 61.4 KB | 54.3% | Slider widget — only slider parts run |
| asl.min (ajax-search-lite) | 79.4 KB | 52.4 KB | 65.9% | Search widget |
| maxmegamenu | 47.0 KB | 46.6 KB | 99.2% | Mega-menu plugin (not used) |

**Total wasted JS on the homepage: 1.42 MB across 91 scripts.**

### CSS

- **Number of stylesheet requests**: 37 across `<link rel="stylesheet">` + the inline `<style>` blocks. Total transfer: **183.8 KB** (compressed).
- **Bundling strategy**: **none**. WordPress core, every active plugin, and the theme each ship their own `.css` file. There is no merge, no critical-CSS extraction, no PurgeCSS.
- **Preload / preconnect**: 1 preloaded stylesheet (`style.css?ver=1.0.0` — the theme's main sheet), 1 preconnect (`fonts.gstatic.com`).
- **Source maps**: not exposed (same posture as JS).

**Unused CSS** (puppeteer v8 coverage API, top 10 by unused bytes):

| Stylesheet | Total | Unused | % | Note |
|------------|------:|------:|---:|------|
| bootstrap.css | 201.9 KB | 189.3 KB | 93.8% | Most rules not matched on homepage |
| block-library | 128.1 KB | 127.5 KB | 99.6% | WP block editor styles (admin-side) |
| block-editor | 113.3 KB | 112.9 KB | 99.6% | WP block editor (admin-side) |
| components | 95.1 KB | 94.8 KB | 99.6% | WP reusable components (admin-side) |
| animate.css | 83.5 KB | 83.2 KB | 99.6% | Animate.css — only used if data-animate appears |
| dashicons | 57.6 KB | 57.6 KB | 100% | WordPress admin menu icon font — never needed for visitors |
| download-manager | 54.6 KB | 54.6 KB | 100% | Plugin CSS, homepage has no downloads |
| ionicons | 50.1 KB | 50.1 KB | 100% | Icon font, may not be used at all |
| media-views | 48.3 KB | 48.3 KB | 100% | WP admin media library |
| style.css (theme) | 44.7 KB | 33.7 KB | 75.3% | Theme CSS — most rules not matched |

**Total wasted CSS on the homepage: 1.15 MB across 50 stylesheets.** WordPress ships block-editor styles (block-library, block-editor, components — ~340 KB total, 99.6% unused on a public page) on the public side because the same `wp_head()` call powers admin and public. The theme is loading `animate.css` and `ionicons` even on pages that don't trigger animations.

### Images

- **Number of image requests**: 35 (from `<img>` tag DOM scan) or 36 (Lighthouse network scan — includes 1 background-image fetch). Total transfer: **1.73 MB** (compressed, on-wire).
- **Format breakdown**:

  | Format | Count | Notes |
  |--------|------:|-------|
  | `image/webp` | 20 | All large photos are auto-converted to WebP at upload (good). |
  | `image/svg+xml` | 12 | Icons, logos, the line-art decorations. |
  | `image/gif` | 2 | Animated GIFs (used as static images — could be WebP). |
  | `image/png` | 1 | The MITUR logo (1 transparency alpha channel — could be WebP for the same look). |
  | `image/jpeg` | 0 | None served; originals are WebP after the upload pipeline. |
  | `image/avif` | 0 | **AVIF is not served** despite HTTPS + Cloudflare being capable. |

- **Responsive images (`srcset`, `sizes`)**:

  | Metric | Count | Of 35 <img> tags |
  |--------|------:|-----------------:|
  | with `srcset` | **0** | 0% |
  | with `sizes` | **0** | 0% |
  | with `width` attribute | 2 | 6% |
  | with `height` attribute | 2 | 6% |
  | with `fetchpriority` | **0** | 0% |
  | with `loading="lazy"` | 0 | 0% |

  Despite the `-scaled` filename pattern being a WordPress hint that the upload pipeline already generated multiple resolutions, **no `<img>` tag actually ships a `srcset`**. The 254 KB hero image is served at the `-scaled` (2560-ish px wide) resolution even on a 412 px mobile viewport. This is the same root-cause as the F-01 CLS finding (no width/height → layout shift when the image loads) and a major driver of the F-02 LCP finding (full-size image fetched instead of viewport-sized one).

- **Top 10 images by transfer**:

  | # | Size | File | Notes |
  |---|------:|------|-------|
  | 1 | 254.8 KB | `popup-actividades.jpg` | Served as a CSS background on a below-the-fold widget — full 2560 px. |
  | 2 | 234.7 KB | `IMG_5308.jpeg` | First card image — strong LCP candidate. |
  | 3 | 203.3 KB | `cover-ilamatepec.jpg` | Article card image. |
  | 4 | 169.3 KB | `IMG_2746.jpeg` | Article card image. |
  | 5 | 123.3 KB | `IMG_2282-scaled.jpeg` | Already has `-scaled` suffix but no `srcset` actually emitted. |
  | 6 | 101.8 KB | `cover-surfcity.jpg` | Article card image. |
  | 7 | 101.4 KB | `IMG_6220-scaled.jpeg` | Article card image. |
  | 8 | 71.8 KB | Card image | |
  | 9 | 60.2 KB | `Surf-City-y-Antigua-scaled.jpeg` | |
  | 10 | 56.0 KB | `popupdatosestadisticos.jpg` | Stats popup background. |

### Third-party resources

- **Total third-party requests**: 7 (down from 11 in the network scan — some 3P are pulled in by inline scripts and only show up in the network log).
- **Third-party domains**:

  | Domain | Requests | Notes |
  |--------|---------:|-------|
  | `fonts.googleapis.com` | 4 | Google Fonts CSS — serves the Open Sans family used by the theme. |
  | `www.googletagmanager.com` | 1 | GTM container `G-TGS16WRG4D` — async (correct). |
  | `fonts.gstatic.com` | 1 | The actual font files (woff2). |
  | `www.google-analytics.com` | 1 | The GA4 beacon fired by gtag. |

- **No ad networks, no Permutive, no OneTrust, no reCAPTCHA, no JWPlayer.** MITUR is a content-only public-sector site — it doesn't monetize via ads and doesn't run experiments. The third-party surface is small (≈ 1.5% of total transfer) and is mostly a single vendor (Google) for fonts and analytics.
- **Loading posture**: gtag is `async` (correct). Google Fonts CSS blocks render — but fonts are not visible until CSS is loaded, so this is hard to avoid without going self-hosted + preload.
- **No third-party tools flagged as inappropriate or unnecessary** — this is a clean third-party surface for a WordPress site.

### What this means

The homepage is shipped with **2.55 MB of first-party code/images** and **0.21 MB of third-party**. The first-party breakdown is:
- 647 KB JS (59 requests) — 1.42 MB unused per coverage
- 184 KB CSS (37 requests) — 1.15 MB unused per coverage
- 1.73 MB images (35 requests) — full-resolution, no `srcset`/`fetchpriority`/dimensions

The non-trivial part of the build-pipeline findings is **not the third-party surface (it's clean) — it's the first-party plugin-bloat pattern**: WordPress + 6 active plugins each ship their own JS/CSS, and the theme's older jQuery + Bootstrap bundle sits alongside WordPress core's modern equivalents. The fixes are:

1. Stop loading plugins on pages that don't use them (WordPress has `wp_enqueue_script`/`wp_enqueue_style` with a `$page` arg — most plugins ignore it).
2. De-duplicate jQuery (drop the theme's `jquery-3.3.1.js`; let WP core 3.7.1 handle it).
3. Drop unused block-editor styles from the public side (`wp_dequeue_style('wp-block-library')` for non-admin pages).
4. Add `srcset`/`sizes`/`fetchpriority`/`width`/`height` to image markup (WordPress has `wp_calculate_image_srcset()`; the theme's image-rendering helper is dropping it).
5. Enable AVIF in the upload pipeline (Cloudflare Polish + `format=avif` URL flag, or a server-side re-encode).

---

## Coverage (homepage)

*Captured 2026-07-24 via `node scripts/coverage-frame-capture.mjs` (HW8): puppeteer's v8 coverage API for unused-JS / unused-CSS, DOM walk for inline `<style>` blocks, and CSS rules introspection for critical-CSS extraction. Raw data: `/tmp/mitur-coverage-frame-capture.json`. Recipe: `just coverage-frames`.*

### Critical CSS

- **Inline `<style>` blocks**: **16**, totaling **59,663 bytes** (~58 KB).
- **9 of those 16 blocks** match loose "above-the-fold" markers (e.g. `body { ... }`, `html { ... }`, `header`, `nav`, `.card-img`, `.wp-block-*`, `@media`).
- **First-party external stylesheets**: **37 `<link rel="stylesheet">`** entries in `<head>`, all render-blocking, totaling **~184 KB transfer**. Top blockers: `bootstrap.css` (37 KB), `dashicons.min.css` (35 KB), `style.css` (theme, 14 KB), `block-library` (16 KB).
- **Observation**: there is no audit-grade critical-CSS extraction pipeline. The 9 inline blocks that match "above-the-fold" markers do so because they include WordPress admin styles (`.wp-block-*`, `@media`) that happen to contain those tokens — they are not actually above-the-fold rules for the homepage. The 37 external stylesheets ship in full regardless of viewport. **The "critical" inline CSS is what WordPress's default enqueue pipeline dumps inline, not what an extraction tool would select.**

### Unused JavaScript

| Bucket | Entries | Total bytes | Unused bytes | Unused % |
|---|---:|---:|---:|---:|
| **Total** | **91** | **2,341.6 KB** | **1,454.6 KB** | **62.1%** |

Top 10 unused-JS offenders:

| Script | Unused | % | Source |
|---|---:|---:|---|
| `googletagmanager.com/gtag/js?id=G-TGS16WRG4D` | 239.3 KB | 50.2% | google |
| `instituciones/js/bootstrap.bundle.js` | 130.5 KB | 59.7% | first-party |
| `mediaelement/mediaelement-and-player.min.js` | 126.0 KB | 81.7% | first-party (plugin) |
| `instituciones/js/jquery-3.3.1.js` | 123.0 KB | 44.6% | first-party (theme) |
| `media-views.min.js` | 86.7 KB | 80.2% | first-party (WordPress core) |
| `download-manager/.../jquery.dataTables.min.js` | 79.2 KB | 82.2% | first-party (plugin) |
| `plupload/moxie.min.js` | 64.7 KB | 75.8% | first-party (WordPress core) |
| `smart-slider-3/.../ss-core.min.js` | 61.4 KB | 54.2% | first-party (plugin) |
| `ajax-search-lite/.../asl.min.js` | 52.2 KB | 65.7% | first-party (plugin) |
| `megamenu/js/maxmegamenu.js` | 46.6 KB | 99.2% | first-party (plugin) |

**Pattern**: the most unused JS is first-party plugin/theme code (not third-party ad scripts, as on AP News). Mediaelement (no audio/video on homepage), dataTables (no download listing), plupload (no file upload), and the older theme jQuery (alongside WP core 3.7.1) are all loaded but never executed. **Same root cause as F-14** (51 sync scripts in `<head>` regardless of page context) — the coverage data shows *how much* of those scripts never runs, not just that they block render.

### Unused CSS

| Bucket | Entries | Total bytes | Unused bytes | Unused % |
|---|---:|---:|---:|---:|
| **Total** | **50** | **1,210.7 KB** | **1,141.8 KB** | **94.3%** |

Top 10 unused-CSS offenders:

| Stylesheet | Unused | % | Source |
|---|---:|---:|---|
| `instituciones/css/bootstrap.css` | 187.4 KB | 92.8% | first-party (theme) |
| `block-library/style.min.css` | 127.5 KB | 99.6% | first-party (WordPress core, admin) |
| `block-editor/style.min.css` | 112.9 KB | 99.6% | first-party (WordPress core, admin) |
| `dist/components/style.min.css` | 94.8 KB | 99.6% | first-party (WordPress core, admin) |
| `instituciones/css/animate.css` | 83.2 KB | 99.6% | first-party (theme) |
| `dashicons.min.css` | 57.6 KB | 100% | first-party (WordPress core, admin) |
| `download-manager/assets/css/front.min.css` | 54.6 KB | 100% | first-party (plugin) |
| `instituciones/css/ionicons.min.css` | 50.1 KB | 100% | first-party (theme) |
| `media-views.min.css` | 48.3 KB | 100% | first-party (WordPress core, admin) |
| `instituciones/style.css` (theme) | 32.4 KB | 72.5% | first-party (theme) |

**Pattern**: 94.3% of all CSS bytes ship but never match. The single biggest category is **WordPress block-editor admin CSS** (`block-library` + `block-editor` + `components` = 335.2 KB at 99.6% unused) shipping on the public side because WordPress's `wp_head()` call enqueues these for admin and public alike. The theme loads the full `bootstrap.css` (202 KB) when only a fraction of the grid + utility classes is used, plus the full `animate.css` (84 KB) and `ionicons` font (50 KB) regardless of whether any animation or icon is in viewport. **Same root cause as F-15** (37 stylesheets in `<head>`, mostly unused) — this coverage data is the *quantified* version of that finding.

---

## Performance frame chart (homepage, post-settle)

*Captured 2026-07-24 via `requestAnimationFrame` deltas in the browser, 8 s after navigation + 5 s of load capture + 3 s of scroll capture + 2 s of click capture. A "dropped frame" is defined as >25 ms between consecutive frames (the 60-fps threshold is 16.67 ms; >25 ms means the browser missed a paint). Raw data: `/tmp/mitur-coverage-frame-capture.json`.*

_Note: the capture happens **8 s after navigation** to let scripts run. The "load" phase thus measures **post-load settling**, not initial load. The initial-load jank (TBT 1.2 s on mobile amplification, F-12) is captured in the TBT finding; the frame chart here is the "show your work" artifact for paint/composite cost after the main thread has settled._

| Phase | Total frames | Dropped frames | Avg frame interval | Max frame interval | Effective fps |
|---|---:|---:|---:|---:|---:|
| **Load** (5 s, post-8s-settle) | 297 | 2 | 16.88 ms | 83.4 ms | **59.2 fps** |
| **Scroll** to bottom (3 s) | 181 | **0** | 16.59 ms | 16.8 ms | **60.3 fps** |
| **Click** on visible button (2 s) | 121 | 1 | 16.55 ms | 33.4 ms | **60.4 fps** |
| Click target | `<button>` at (376, 251) — popup close button (`×`) | | | | |

**Observations**:
- **Scroll is perfect**: 0 of 181 frames dropped, max interval 16.8 ms. The page never janks during scroll.
- **Click has 1 transient drop**: 1 of 121 frames dropped (33.4 ms), corresponding to the popup-close transition. Within acceptable bounds.
- **Load has 2 transient drops** (out of 297 frames, max 83.4 ms): the post-settle window still catches the tail of gtag init and Smart Slider 3 bootstrap. These are the user-perceptible symptoms of F-12 (TBT) and F-14 (51 sync scripts) — the existing findings cover the root cause; the frame chart here documents the *visible* impact.

**Comparison to AP News** (course project, same methodology, 8 s settle + 5/3/2 s captures): AP News's frame chart shows **0.9 fps effective during load** (8 frames in 5 s, max interval 783 ms) and **1.3 fps during scroll** (4 frames in 3 s, max interval 2,167 ms). MITUR is **40-60× more responsive** in the post-settle phase. The gap is because AP News's third-party scripts (Permutive, Prebid, GTM, Viafoura, webcontentassessor) keep the main thread busy long past the 8 s settle, while MITUR's main thread is free.

**This is direct user-perceptible evidence that the bottleneck on MITUR is *initial-load JS blocking* (TBT / sync scripts), not paint or composite cost.** A fix to F-12 / F-14 will improve the load phase; the scroll and click phases are already healthy.

---

## Layers & animations (homepage)

*Captured 2026-07-24 via `node scripts/coverage-frame-capture.mjs`: DOM walk (`document.querySelectorAll('*')` + `getComputedStyle` for stacking-context detection), CSS rules introspection (`document.styleSheets` walk), and a count of `document.getAnimations()` / `<iframe>` / `<canvas>` / `<video>`.*

| Metric | Value |
|---|---|
| **Stacking contexts on the homepage** | **107** |
| ↳ by `position + z-index` | 85 |
| ↳ by `transform` | 9 |
| ↳ by `opacity` | 7 |
| ↳ by `filter` | 6 |
| **`will-change` selectors** (forced layer creation) | **7** |
| **`translate3d` / `transform3d` selectors** (forced compositing) | **2** |
| `document.getAnimations()` count on first paint | **0** |
| Animations started on scroll | **4** |
| `<canvas>` elements | 0 |
| `<video>` elements on first paint | 0 |
| `<iframe>` elements | 0 |

**Estimated paint-layer count on the homepage**: ~22 (9 transform + 7 opacity + 6 filter compositor triggers). The 85 `position + z-index` stacking contexts are DOM-level only — they do not create GPU layers, just z-axis ordering.

**The 7 `will-change` declarations — full list:**

| Selector | Property | Source |
|---|---|---|
| `.wp-block-gallery.has-nested-images figure.wp-block-image figcaption` | `transform` | WordPress block-library (admin CSS bleeding to public) |
| `.components-popover` | `transform` | WordPress block-editor (admin CSS bleeding to public) |
| `.block-editor-block-list__insertion-point-indicator` | `transform, opacity` | WordPress block-editor (admin CSS bleeding to public) |
| `.block-editor-block-list__insertion-point-inserter` | `transform` | WordPress block-editor (admin CSS bleeding to public) |
| `.block-editor-global-styles__shadow-indicator` | `transform` | WordPress block-editor (admin CSS bleeding to public) |
| `.block-editor-block-contextual-toolbar .block-editor-block-toolbar` | `transform` | WordPress block-editor (admin CSS bleeding to public) |
| `.servicios-title a` | `unset` | Theme (effectively a no-op) |

**The 2 `translate3d(0,0,0)` "force the GPU" declarations — full list:**

| Selector | Property | Source |
|---|---|---|
| `.n2-ss-slider .n2_ss_video_player .n2_ss_video_player__cover` | `translate3d(0px, 0px, 0px)` | Smart Slider 3 (active plugin) |
| `.n2-ss-slider .n2-input, .n2-ss-slider .n2-ss-item-counter-counting-div` | `translate3d(0px, 0px, 0px)` | Smart Slider 3 (active plugin) |

**Observations**:
- **6 of 7 `will-change` declarations are from WordPress block-editor admin CSS** — they ship on the public side because `wp_head()` is shared between admin and public. The 7th (`.servicios-title a  ->  unset`) is a no-op (`will-change: unset` is the default, so the declaration is dead code).
- **The 2 `translate3d(0,0,0)` declarations are from Smart Slider 3** — this is the Day 8 §1.3 anti-pattern: forcing a compositor layer with a no-op transform. The plugin uses it on the video player cover and the input/counter elements.
- **Despite 22 compositor layers + 85 stacking contexts + 7 will-change + 2 transform3d, the frame chart shows 60 fps across scroll and click.** The GPU can handle the layer count on modern devices. On a 4-year-old mid-tier Android, the layer budget becomes more constrained (Chromium's soft limit is ~200 layers per page) but MITUR stays well under that.
- **No animations start on first paint, and 4 start on scroll** (the Smart Slider 3 slide-transition + the menu dropdown reveal). These are CSS `@keyframes` triggered by class changes, not the Web Animations API.
- **Net: paint cost is healthy**. The frame-chart smoothness is not a fluke — the 22-layer composition is comfortably within the GPU budget. The wasteful patterns (admin CSS shipping to public, no-op `translate3d`) are real but not yet causing user-perceptible issues. Same conclusion as AP News: a layer-cost optimization will not move the needle for MITUR. The bottleneck is main-thread JS, not composite.

---

## Rendering strategies (8 audited pages)

*Captured 2026-07-24 via `node scripts/rendering-strategy.mjs` (puppeteer + Performance API + HTML inspection). For each page, the script captures the initial HTML (before any JS runs), response headers (cache-control, x-powered-by, cf-cache-status, transfer-encoding), and framework markers. Raw data: `/tmp/mitur-rendering-strategy.json`. Recipe: `just rendering-strategy`.*

### Strategy used

**MITUR uses server-side rendering (SSR) via PHP on every audited page, served by WordPress on Hostinger with Cloudflare in front.** All 8 pages return substantial HTML in the initial response (192–245 KB decompressed, 41–49 KB gzipped on the wire), with 5–10 text-indicator matches against Spanish news-page markers (`ministerio`, `turismo`, `noticias`, `descargas`, `preguntas`, etc.). This means the content is server-rendered, not a client-side shell hydrated after JS. The browser sees real content immediately.

| Page | HTML (decompressed) | HTML (gzipped) | Strategy | Cache-Control | cf-cache-status | Cacheable | Frameworks |
|---|---:|---:|---|---|---|---|---|
| Homepage | 225 KB | 47.5 KB | SSR (PHP 8.2.30) | `no-store, no-cache, must-revalidate` | **DYNAMIC** | ✓ | WordPress, YOAST SEO, Elementor, Smart Slider 3, Popup Maker, Download Manager |
| Noticias (`/category/noticias/`) | 206 KB | 43.2 KB | SSR (PHP 8.2.30) | `no-store, no-cache, must-revalidate` | **DYNAMIC** | ✓ | WordPress, YOAST, Elementor, Popup Maker, Download Manager |
| Article-turismo-2026 | 195 KB | 42.1 KB | SSR (PHP 8.2.30) | `no-store, no-cache, must-revalidate` | **DYNAMIC** | ✓ | WordPress, YOAST, Elementor, Popup Maker, Download Manager |
| Contest (`/contest/`) | 203 KB | 42.3 KB | SSR (PHP 8.2.30) | `no-store, no-cache, must-revalidate` | **DYNAMIC** | ✓ | WordPress, YOAST, Elementor, Popup Maker, Download Manager |
| Descargas (`/descargas/`) | 245 KB | 45.3 KB | SSR (PHP 8.2.30) | `no-store, no-cache, must-revalidate` | **DYNAMIC** | ✓ | WordPress, YOAST, Elementor, Popup Maker, Download Manager |
| FAQ (`/preguntas-frecuentes/`) | 218 KB | 49.0 KB | SSR (PHP 8.2.30) | `no-store, no-cache, must-revalidate` | **DYNAMIC** | ✓ | WordPress, YOAST, Elementor, Popup Maker, Download Manager |
| Search (`?s=turismo`) | 203 KB | 42.3 KB | SSR (PHP 8.2.30) | `no-store, no-cache, must-revalidate` | **DYNAMIC** | ✗ (query-dependent) | WordPress, YOAST, Elementor, Popup Maker, Download Manager |
| Acceso-informacion | 192 KB | 41.4 KB | SSR (PHP 8.2.30) | `no-store, no-cache, must-revalidate` | **DYNAMIC** | ✓ | WordPress, YOAST, Elementor, Popup Maker, Download Manager |

**Common headers** (all 8 pages):
- `server: cloudflare` — Cloudflare CDN in front of origin
- `x-powered-by: PHP/8.2.30` — WordPress on Hostinger PHP 8.2.30 at origin
- `content-encoding: gzip` — text compression on (Cloudflare gzip, not Brotli)
- `cache-control: no-store, no-cache, must-revalidate` — origin PHP tells all caches to skip
- `cf-cache-status: DYNAMIC` — Cloudflare respects origin's no-store and never caches the HTML

### How this affects users

**Benefits of the WordPress SSR + Cloudflare-CDN strategy:**

1. **Fast initial paint** — the LCP image, headline text, navigation, and footer are present in the initial HTML, so the browser can paint meaningful content immediately. Google's CWV measures FCP and LCP against the initial HTML render, not against JS hydration. The 6.6 s LCP on the homepage is bounded by render-blocking scripts in `<head>` (see F-14), not by SSR cost.
2. **No flash-of-empty-content** — even on slow networks, the user sees content within ~1 s of the HTML arriving.
3. **Static-asset CDN cache works** — confirmed by HW3 cold-vs-warm capture: 125 of 140 responses show `cf-cache-status: HIT` on the homepage. CSS, JS, images, and fonts are served from Cloudflare's edge in <100 ms for repeat visitors. The asset side of the stack is correctly cached.
4. **SEO-friendly** — search engine crawlers (which often don't run JS) see the full article content in the initial HTML. This is critical for a public-sector site where search discoverability matters.

**Trade-offs and costs:**

1. **HTML is never edge-cached** — `cache-control: no-store, no-cache, must-revalidate` from the PHP origin + `cf-cache-status: DYNAMIC` at Cloudflare means **every visitor, including repeat visitors, triggers a fresh PHP render at origin.** This is in stark contrast to the static assets (which are heavily cached) and to AP News's same architecture (7 of 8 pages edge-cached for 1 year). For MITUR's homepage, every pageview costs ~500 ms–2 s of PHP work (WordPress render time with 6+ active plugins), even though the content barely changes between visits.
2. **Each page generates 192–245 KB of HTML** — WordPress + 5-6 active plugins each emits its own `<script>`, `<style>`, and `<link>` tags inline (the basis for F-14, F-15, F-18, F-20). The actual visible text on the homepage is probably <5 KB; the rest is plugin-emitted markup, schema.org JSON-LD from YOAST, Elementor wrapper divs, and admin toolbars.
3. **No streaming SSR** — the HTML responses are fully buffered (the entire 192–245 KB arrives in one PHP render, then sent to the browser). Streaming SSR would let the browser begin rendering the above-the-fold content while PHP is still generating the footer, but WordPress's PHP render is not streaming-friendly.
4. **Brotli not enabled** — Cloudflare is serving gzip, which is ~15% larger than Brotli on text payloads. The opportunity (5–7 KB per page) is small but free with a Cloudflare config toggle.
5. **No stale-while-revalidate** — even if the HTML were cacheable, there's no SWR fallback. A cache miss on a popular page would still trigger an origin render while serving stale content from edge.

### Is this the right choice for these pages?

| Page type | Current strategy | Best fit | Verdict |
|---|---|---|---|
| Homepage | SSR, no cache | SSR + edge cache (1-hr s-maxage) | **Suboptimal** — content updates on a minutes-to-hours cadence, not seconds. Edge caching would cut origin load by 95 %+ for repeat visitors |
| Section hubs (noticias, descargas, faq) | SSR, no cache | SSR + edge cache | **Suboptimal** — same as homepage, but with even less frequent updates |
| Single article (article-turismo-2026) | SSR, no cache | SSR + edge cache (1-day s-maxage) | **Suboptimal** — articles don't change once published; safe to edge-cache for the lifetime of the article |
| Contest (`/contest/`) | SSR, no cache | SSR + edge cache (5-min s-maxage) | **Suboptimal** — vote counts change but not the page structure |
| Search (`?s=turismo`) | SSR, no cache | SSR (results are query-dependent) | **Right choice** — query parameter is part of the cache key, so edge cache would only help on the exact same query (rare). For popular search terms, edge cache is possible but low-value |
| Static (acceso-informacion) | SSR, no cache | SSG (static file) or SSR + edge cache | **Suboptimal** — content changes rarely; could be SSG'd with a WordPress static-site generator or even just aggressively edge-cached |

**Summary** — the SSR pattern itself is **the right choice for MITUR** (WordPress is naturally PHP-rendered, and the content is dynamic enough that SSG would be a heavy lift). But the **HTML cache is misconfigured**: every page is set to `no-store, no-cache, must-revalidate` despite being perfectly cacheable (7 of 8 pages). Cloudflare's HTML caching could be enabled with a simple page-rule or Worker, and the static asset side already works that way. The **fundamental issue isn't the rendering strategy — it's the missing edge cache**, which is one config change away from AP News's 1-year CDN TTL pattern.

---

## Why every page is poor (one-line summary)

WordPress + 6 plugins (YOAST, Elementor, Smart Slider 3, WordPress Download Manager, photo-contest plugin, theme bundle) ship 2.8 MB of HTML/CSS/JS/imagery on first paint. The headline image doesn't render until 6.6 s, the page shifts 0.382 mid-load, and the browser can't accept input until 11.5 s.
