# Findings

*Five findings from the homepage baseline. Each follows the brief's structure: how does this affect users? / which metric? / cause? / solution? Lab evidence only — CrUX field data and WPT filmstrip not captured.*

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

## F-03 — Two jQuery versions ship on the same page (~750 ms of redundant script-eval)

**Metric:** Time to Interactive (TTI), Total Blocking Time (TBT).

**How does this affect users?** Every visitor's browser parses and executes the same jQuery code twice on first paint. That doesn't block the user *visually* (TBT is only 300 ms — modest) but it adds ~750 ms of CPU work that delays Time to Interactive (11.5 s — "poor"). On a mid-tier Android device (the median reader), this is the difference between "page feels ready in 4 s" and "page feels ready in 7 s."

**Cause (confirmed by `bootup-time`):** WordPress core bundles jQuery 3.7.1 (`/wp-includes/js/jquery/jquery.min.js?ver=3.7.1`, 677 ms CPU work). The custom theme bundles jQuery 3.3.1 (`/wp-content/themes/instituciones/js/jquery-3.3.1.js?ver=2644`, 142 ms CPU work). Both are loaded as part of first-paint scripts. WordPress jQuery 3.3.1 was deprecated in 2017.

**Solution:**
- Dequeue the theme's jQuery via `wp_dequeue_script('jquery-3.3.1')` and rely on WordPress core's 3.7.1.
- Audit other plugins (Elementor, Smart Slider 3, photo-contest) for their own jQuery copies — common WordPress plugin bloat.

**Expected outcome:** ~750 ms less CPU work on first paint. TTI 11.5 s → ~10 s. Cumulative CPU savings as other plugins are dequeued.

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
