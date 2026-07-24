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

## Why every page is poor (one-line summary)

WordPress + 6 plugins (YOAST, Elementor, Smart Slider 3, WordPress Download Manager, photo-contest plugin, theme bundle) ship 2.8 MB of HTML/CSS/JS/imagery on first paint. The headline image doesn't render until 6.6 s, the page shifts 0.382 mid-load, and the browser can't accept input until 11.5 s.
