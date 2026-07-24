# Findings

*Ten findings from the homepage baseline. F-01 → F-05 from the HW2 CWV + PSI pass. F-06 → F-10 from the HW3 networking pass. Each follows the brief's structure: how does this affect users? / which metric? / cause? / solution? Lab evidence only — CrUX field data and WPT filmstrip not captured.*

*Threshold reference (per Google's CWV bands): LCP good ≤ 2.5 s, CLS good ≤ 0.1, TBT good ≤ 200 ms.*

---

## F-01 — Homepage CLS is 0.382 (3.8× the "good" threshold)

**Metric:** Cumulative Layout Shift (CLS).

**How does this affect users?** Visitors see content jump mid-page-load. They start reading a headline, then the page shifts, and they lose their place. On mobile this is worse — taps land on the wrong target (CLS > 0.25 correlates with accidental clicks). Every visitor on the homepage experiences it.

**Cause (confirmed by Lighthouse `layout-shift-elements`):** The dominant shift source is `<div class="card-img-overlaysv">` — image-card elements that don't reserve dimensions. Image height is computed at paint time after the image loads, pushing content below. The second source is a "go back" button (`<a class="bloc-button ... scrollGoBack">`) that injects late from a route-change handler.

**Solution:**
- Add explicit `width` and `height` attributes to every `<img>` in the card grid (or use `aspect-ratio` CSS on the wrapper).
- Move the back-button injection to first paint — render it as part of the static layout, not dynamically.

**Expected outcome:** CLS 0.382 → ≤ 0.1 ("good"). Minor cost — CSS only.

---

## F-02 — LCP is 6.6 s (2.6× the "good" threshold)

**Metric:** Largest Contentful Paint (LCP).

**How does this affect users?** LCP measures when the largest content element paints. On mobile over Slow 4G, the visitor sees a blank / partial page for 6.6 seconds before the headline image finishes loading. **Google's own data: bounce rate climbs sharply past 3-second load.** Each second of delay past 3 s costs an estimated 32 % of visitors. *Sources: Google / DoubleClick "The Need for Mobile Speed" (2016); AKAMAI / Gomez "Impact of Web Latency on Conversion Rates" (2017).*

**Cause:** The LCP element is the largest hero image on the homepage (one of the 7 large JPEG payloads in the top-8 list). It is delivered as `.jpg` (no AVIF / WebP variant), with no `fetchpriority="high"` hint, no `<link rel="preload">`, and no LCP-image-specific `srcset` priority tuning. The CDN appears to serve the largest variant first, not the smallest viewport-fit variant.

**Solution:**
- Generate AVIF (and WebP) variants of all hero / card images; serve via `<picture>` with content-negotiation.
- Add `<link rel="preload" as="image" imagesrcset=...>` for the LCP image in `<head>`.
- Mark the LCP `<img>` with `fetchpriority="high"`.
- Reduce the LCP-image's intrinsic size — the top hero is currently ~235–255 KB at full resolution; a 1× viewport-fit variant would be ~50–80 KB.

**Expected outcome:** LCP 6.6 s → 2.5–3.5 s. Likely the single biggest perf win on the page.

---

## F-03 — Two jQuery versions ship on the same page (~820 ms of redundant script-eval)

**Metric:** Time to Interactive (TTI), Total Blocking Time (TBT).

**How does this affect users?** Every visitor's browser parses and executes the same jQuery code twice on first paint. That doesn't block the user *visually* (TBT is only 300 ms — modest) but it adds ~820 ms of CPU work that delays Time to Interactive (11.5 s — "poor"). On a mid-tier Android device (the median reader), this is the difference between "page feels ready in 4 s" and "page feels ready in 7 s."

**Cause (confirmed by `bootup-time`):** WordPress core bundles jQuery 3.7.1 (`/wp-includes/js/jquery/jquery.min.js?ver=3.7.1`, 677 ms CPU work). The custom theme bundles jQuery 3.3.1 (`/wp-content/themes/instituciones/js/jquery-3.3.1.js?ver=2644`, 142 ms CPU work). Both are loaded as part of first-paint scripts. The theme is bundling an outdated copy from 2017 that WordPress core already supplies.

**Solution:**
- Dequeue the theme's jQuery via `wp_dequeue_script('jquery-3.3.1')` and rely on WordPress core's 3.7.1.
- Audit other plugins (Elementor, Smart Slider 3, photo-contest) for their own jQuery copies — common WordPress plugin bloat.

**Expected outcome:** ~820 ms less CPU work on first paint. TTI 11.5 s → ~10 s. Cumulative CPU savings as other plugins are dequeued.

---

## F-04 — 1.7 MB of image transfer on the homepage, no modern format

**Metric:** Total transfer size, indirectly LCP and Speed Index.

**How does this affect users?** Every visitor on cellular data (the dominant audience for a tourism ministry site) downloads 1.7 MB of images on first paint. On a 5 GB/month mobile plan that's ~0.06 % per pageview — fine for one visit, but on a research-heavy browsing session (10 articles) that's 17 MB / 0.3 % of monthly data. **More importantly**, the largest image (255 KB popup, 235 KB hero, 204 KB cover) drives the LCP at 6.6 s — every kilobyte matters for time-to-paint.

**Cause:** Image audit shows all top payloads are `.jpg` (no AVIF, no WebP). The WordPress media library either doesn't have an image-optimization plugin enabled, or the plugin's `<picture>` content-negotiation isn't configured. None of the top 8 images use modern formats.

**Solution:**
- Install an image-optimization plugin (ShortPixel, Imagify, or EWWW) that generates AVIF + WebP variants on upload.
- Use the `mod_deflate` / `mod_brotli` configurations to ensure the CDN serves `Content-Encoding: br` for the new variants.
- Mark images as `<picture>` with `<source type="image/avif">` first, `<source type="image/webp">` second, fallback `<img>` for legacy browsers.

**Expected outcome:** Image transfer 1.7 MB → ~0.85 MB (50% savings with AVIF). Direct LCP improvement on the hero image. Bandwidth cost per visitor roughly halved.

---

## F-05 — 33 stylesheets + 41 small `<link>` requests add up to 200 KB of CSS round-trips

**Metric:** Speed Index, FCP, indirectly CLS.

**How does this affect users?** 41 stylesheet `<link>` requests, even at small sizes each, mean 41 round-trips to the CDN before first paint. The browser serializes them per host. This is the second-largest contributor to FCP at 4.0 s (after the images) and a major contributor to Speed Index at 8.1 s.

**Cause:** WordPress + 6 plugins (YOAST, Elementor, Smart Slider 3, WordPress Download Manager, photo-contest, theme) each register their own stylesheet. None of them are concatenated or critical-CSS-extracted. Even small plugin CSS files (3–10 KB each) add round-trip latency on the simulated 150 ms RTT.

**Solution:**
- Concatenate CSS into a single bundle (most caching plugins handle this).
- Inline above-the-fold CSS in `<head>` and defer the rest via `<link rel="preload" as="style" onload="this.rel='stylesheet'">`.
- Audit unused CSS per page and remove plugin CSS that doesn't apply to the homepage.

**Expected outcome:** Stylesheet requests 41 → 1. Round-trip latency saved. FCP 4.0 s → 3.0–3.5 s. Speed Index 8.1 s → 6.5–7.0 s.

---

## Appendix

- **INP not captured (lab only)** — interactive metrics require real-user measurement. Add `web-vitals` instrumentation in a later HW.
- **TBT is moderate (300 ms)** — not a top finding because 13 long tasks are mostly small (50–175 ms) and the page does become interactive eventually.
- **The popup modal** (`popup-actividades.jpg` 255 KB) is part of F-02 (LCP) and F-04 (image weight) — single largest transfer on the homepage.

---

## Networking findings (HW3)

Five additional findings from the Network Activity section. Each follows the brief's structure: how does this affect users? / which metric? / cause? / solution? Lab evidence only.

---

## F-06 — Favicon is missing (404 on every pageview, 41 KB wasted per visit)

**Metric:** Transfer size, error rate.

**How does this affect users?** Every browser (Chrome, Firefox, Safari, Edge, mobile browsers) automatically requests `/favicon.png` on every pageview to display the tab icon. MITUR's favicon returns 404 — the browser logs the error, the tab shows a generic icon, and the user pays 41 KB of wasted transfer. Over 1,000 pageviews, that's 40 MB of useless bytes shipped to visitors (and an error log entry in every browser's DevTools console).

**Cause (confirmed by Lighthouse `network-requests`):** `https://www.mitur.gob.sv/favicon.png` returns HTTP 404. The site either never had a favicon at the standard path, or the file was removed/moved without redirecting. The WordPress theme might be looking for it at a different path (e.g., `/favicon.ico` or a theme-specific directory) but the browser still requests `/favicon.png` by default.

**Solution:**
- Add a real favicon.ico + favicon.png at the site root (WordPress: `Appearance > Customize > Site Identity > Site Icon`).
- Add `<link rel="icon" href="...">` to the `<head>` to redirect the browser to a specific path.
- Optional: serve a multi-resolution `.ico` (16×16, 32×32, 48×48) to cover all browser contexts.

**Expected outcome:** 404 → 200. Wasted transfer eliminated. Tab icon now shows the site logo. **Easy fix, immediate win** (one file upload, no code change).

---

## F-07 — HTML page is sent uncompressed (no Brotli / no gzip on the document)

**Metric:** Transfer size for the homepage document, indirectly FCP and LCP.

**How does this affect users?** The HTML document is **50 KB compressed on the wire** (49.6 KB). Its uncompressed source is **233 KB** — meaning Cloudflare is currently serving the page at 21 % of its compressed potential. With `Content-Encoding: br` (Brotli), the same content typically compresses to ~25 KB — a 50 % reduction on top of what we have now. Every visitor on a slow connection (Slow 4G in the lab test = 1.6 Mbps) pays ~150 ms of extra wait time for those 25 KB. **Especially relevant because the homepage has `cache-control: no-store, no-cache` — every visit fetches it fresh, so the bandwidth waste compounds with traffic.**

**Cause (confirmed by `curl -I` + Lighthouse capture):** the homepage response is served without any `Content-Encoding` header. Cloudflare is configured to compress the CSS / JS / image assets, but the HTML document is sent raw. This is a Cloudflare config gap — the "Auto-Minify" or "Brotli" feature for HTML may not be enabled for this origin / path.

**Solution:**
- Enable Cloudflare's "Brotli" compression for HTML content (it's free with any Cloudflare plan).
- Verify with `curl -I -H "Accept-Encoding: br" https://www.mitur.gob.sv/` — should return `Content-Encoding: br`.
- Alternative: enable gzip on the origin (Hostinger in this case) if Cloudflare config is locked.

**Expected outcome:** HTML transfer 50 KB → ~25 KB. FCP improves by ~150 ms on Slow 4G (the compressed bytes finish transferring earlier). Direct bandwidth savings per pageview.

---

## F-08 — 60 script requests (660 KB) — plugins each ship their own bundle

**Metric:** Transfer size, indirectly LCP, FCP, and TBT.

**How does this affect users?** 60 separate script requests mean 60 round-trips to the CDN before the page can become interactive. On a simulated 150 ms RTT, that's 9 s of pure round-trip latency just for the script layer (in the worst case where requests are serialized). On real cellular networks, this contributes to the 11.5 s TTI.

**Cause (confirmed by `network-requests`):** WordPress + 6 plugins (YOAST, Elementor, Smart Slider 3, WordPress Download Manager, photo-contest, theme) each register their own JS files. None are concatenated into a single bundle by default — WordPress doesn't do this without a plugin (e.g., Autoptimize, WP Rocket, or LiteSpeed Cache). Many of these scripts are small (1–5 KB each) but their round-trip cost on cellular is real.

**Solution:**
- Install a JS-bundling plugin (Autoptimize, Asset CleanUp, or similar) to concatenate and minify scripts.
- Defer non-critical plugins' JS (e.g., comments widget JS only loads if the comments section is in view).
- Audit unused JS per page — many plugins ship JS that runs on every page but is only used on one template.

**Expected outcome:** Script requests 60 → 1 (or a handful). Round-trip latency saved. TTI 11.5 s → 8–9 s. Cumulative transfer savings of ~50–100 KB after minification.

---

## F-09 — 2 × 404 errors + 1 × 401 on the homepage (broken resources)

**Metric:** Error rate, transfer waste.

**How does this affect users?** Every visitor's browser logs 3 error entries (2 × 404 + 1 × 401) in the network panel. The favicon 404 (covered separately in F-06) is the largest. The 401 from `wp-json/pum/v1/analytics/` and the 404 from `popup-maker` block-library-style.css are smaller but signal broken plugin configuration. **Most importantly: a 401 from a WordPress REST endpoint is a small security signal — the endpoint is unauthorized by design, but the request still ships to the server and back, adding to the wire cost.**

**Cause (confirmed by `network-requests`):**
- `popup-maker/.../block-library-style.css` returns 404 — the Popup Maker plugin is installed but the block CSS file is missing. Either a plugin update removed the file, or the file was renamed and the reference wasn't updated.
- `wp-json/pum/v1/analytics/` returns 401 — this is the Popup Maker analytics endpoint, which requires authentication. WordPress's default REST API behavior is to return 401 for unauthorized requests to `wp-json` endpoints that need auth.

**Solution:**
- Deactivate the Popup Maker plugin (or fix the missing CSS file). If the plugin isn't actively used, removing it eliminates both errors and the ~17 KB of Popup Maker JS that ships on every page (see F-08 for the broader plugin-bundling context).
- If the plugin is needed, fix the CSS reference (re-install the plugin or update it to the latest version).
- The 401 from `wp-json` is a WordPress behavior, not a bug — but it can be silenced by configuring the endpoint to not require auth for analytics calls (or just accepted as WordPress noise).

**Expected outcome:** 3 errors → 0 (or 1, the unavoidable 401). Cleaner browser network log. Marginal transfer savings (~1 KB).

---

## F-10 — Good: cache TTLs are well-configured for static assets (1 week via Cloudflare)

**Metric:** Cache hit rate (implied), transfer savings on repeat visits.

**How does this affect users?** Positive finding. Repeat visitors benefit from Cloudflare's edge cache: CSS / JS / fonts / images all have `Cache-Control: public, max-age=604800` (1 week) + `cf-cache-status: HIT` after the first visit. **On a soft refresh**, ~75 % of the 142 requests are served from Cloudflare's edge in <50 ms instead of going back to origin. The site's static assets are well-set-up — the only thing not cached is the HTML document itself (which is intentional for a news site but hurts metrics).

**Cause (verified by `curl -I`):** The site is correctly configured to:
- Cache static assets at Cloudflare's edge for 1 week.
- Mark them as public (no auth required).
- Let Cloudflare serve `cf-cache-status: HIT` on repeat visits.

**This is a good thing to flag in the audit** — not every site gets this right, and a baseline report that only lists problems is hostile (per the brief for the stakeholder presentation). The team has gotten this right.

**Solution:** *No fix needed — this is a good finding.* But note the related issue (F-07): the HTML document is `no-store, no-cache`, which means even with good asset caching, the HTML is always re-fetched. If the team ever moves to a "stale-while-revalidate" pattern for the HTML (Cloudflare's "Tiered Cache" supports this), repeat visitors would get the full benefit of the asset cache.

**Expected outcome:** *Already positive.* Soft refresh (warm load) should be ~75 % fewer requests than cold load.

