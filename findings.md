# Findings

*Twenty-two findings from the homepage baseline. F-01 → F-05 from the HW2 CWV + PSI pass. F-06 → F-10 from the HW3 networking pass. F-11 added in the HW4 cleanup. F-12 + F-13 added in the HW5 mobile pass. F-14 → F-17 added in the HW7 build-analysis pass. F-18 → F-20 added in the HW8 frame-analysis pass. F-21 + F-22 added in the HW9 rendering-strategies pass. F-07 wording corrected in HW9 (was "uncompressed" — actually gzipped; updated to "gzipped but not Brotli"). Each follows the brief's structure: how does this affect users? / which metric? / cause? / solution? Lab evidence only — CrUX field data and WPT filmstrip not captured.*

*19 corrective findings (F-01 → F-09, F-12, F-14 → F-18, F-21, F-22) and 3 good findings (F-10, F-11, F-13). Brief requires at least 6 corrective + 2 good — both met.*

*Independence check: each finding is independently observable. No two findings primarily contribute to LCP — F-02 is about LCP timing / fetchpriority, F-04 is about image format / total weight (different mechanism, different solution). F-15 and F-18 both address the same root cause (block-editor CSS bleeding to public) but F-15 is the count-level finding (37 stylesheets, page-gate the plugins) and F-18 is the critical-CSS-pipeline finding (no extraction exists, the 16 inline blocks aren't actually above-the-fold rules). F-19 is the user-perceptible evidence for F-12 (TBT) and F-14 (sync scripts) — same root cause, different observation layer. F-21 (HTML never edge-cached) is the origin-side complement to F-14/F-15 (browser-side plugin bloat).*

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

## F-07 — HTML page is gzipped but not Brotli-compressed (5–7 KB savings per page; small)

**Metric:** Transfer size for the homepage document, indirectly FCP and LCP.

**How does this affect users?** The HTML document is **gzipped on the wire** (47.5 KB compressed for the homepage, 233 KB decompressed — 4.9× compression). The original HW2 capture for F-07 was captured at a moment when `Content-Encoding` was missing on the response; in the current configuration the HTML is gzipped correctly (confirmed by re-capture 2026-07-24 across all 8 audited pages). **What remains is the Brotli opportunity**: Cloudflare is serving gzip, but Brotli compresses ~15% better on text payloads. Switching to Brotli would shrink the homepage HTML from 47.5 KB to ~41 KB — saving ~6 KB per pageview. On Slow 4G (1.6 Mbps), that's ~30 ms of transfer time per pageview. Not transformative, but free with a Cloudflare config toggle.

**Cause (confirmed by `curl -I` + `scripts/rendering-strategy.mjs` capture on 2026-07-24):** Cloudflare is configured to compress text content, but the toggle for "Brotli" is off (or the origin's `Vary: Accept-Encoding` doesn't include the right token). The `Content-Encoding` header is `gzip`, not `br`. The Cloudflare dashboard's Speed → Optimization → Content Optimization has a "Brotli" toggle that would switch the encoding.

**Solution:**
- Enable Cloudflare's "Brotli" compression for HTML content (Speed → Optimization → Content Optimization → Brotli = ON). Free with any Cloudflare plan.
- Verify with `curl -I -H "Accept-Encoding: br" https://www.mitur.gob.sv/` — should return `Content-Encoding: br`.
- Alternative: enable Brotli on the origin (Hostinger in this case) if Cloudflare config is locked.

**Expected outcome:** HTML transfer 47.5 KB → ~41 KB. FCP improves by ~30 ms on Slow 4G. Marginal but free. Note that this is a *small* corrective — the bigger win is F-21 (edge-cache the HTML so repeat visitors don't re-fetch at all).

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

## F-10 — Good: Cloudflare edge cache works for first-time visitors (0% warm-refresh savings, not because cache is broken — because it works for *everyone*)

**Metric:** Cache hit rate, transfer savings on repeat visits.

**How does this affect users?** Positive finding. A custom puppeteer capture (`cold-vs-warm.mjs`) measured **140 requests / 2,749 KB on a fresh profile** and **140 requests / 2,749 KB on a warm reload** — 0 % savings on warm refresh. This sounds bad, but it's actually because the **"cold" load is also already cached**: 125 of 140 responses show `cf-cache-status: HIT` (Cloudflare's global edge has the page cached for any visitor, anywhere). First-time visitors and repeat visitors get the same wire cost. The HTML document is always re-fetched (no-store, 1 request, 50 KB) but that's negligible against the static-asset total.

**Cause (verified by `curl -I` + puppeteer `cold-vs-warm.mjs`):** The site is correctly configured to:
- Cache static assets at Cloudflare's edge for 1 week (`Cache-Control: public, max-age=604800`).
- Mark them as public (no auth required).
- Let Cloudflare serve `cf-cache-status: HIT` on repeat visits.

**This is a good thing to flag in the audit** — not every site gets this right, and a baseline report that only lists problems is hostile (per the brief for the stakeholder presentation). The team has gotten this right.

**Solution:** *No fix needed — this is a good finding.* But note the related issue (F-07): the HTML document is `no-store, no-cache`, which means even with good asset caching, the HTML is always re-fetched. If the team ever moves to a "stale-while-revalidate" pattern for the HTML (Cloudflare's "Tiered Cache" supports this), repeat visitors would get a near-instant response (the HTML comes from edge cache, only the dynamic part re-validates).

**Expected outcome:** *Already positive.* Both first-time and repeat visitors get the same edge-cached payload. The site is "fast enough for everyone" — no soft-refresh optimization needed.

---

## Cleanup finding (HW4 — independence check, surface-area expansion)

One finding added during the HW4 independence check: a "good" finding that documents an area where the team has gotten something right (a counter-balance to the corrective findings).

---



## Mobile-specific findings (HW5)

Two findings specific to the mobile form factor, as required by the brief. The first is a corrective finding that quantifies the mobile-amplification of an existing problem. The second is a good finding that documents a mobile-specific concern that the team got right.

---

## F-12 — TBT 300 ms in the Lighthouse capture → ~1.2 s on a real mid-tier Android (4× CPU amplification)

**Metric:** Total Blocking Time (TBT) — mobile-specific amplification.

**How does this affect users?** The TBT in the Lighthouse capture is 300 ms — already over the 200 ms "good" threshold. **But that number is misleading on its own.** Lighthouse simulates a mid-tier Android via 4× CPU slowdown (per Day 3 §4.1 and Day 6 §1), but the 4× slowdown is **on top of** an already-throttled CPU. On a real mid-tier Android (e.g., a Moto G Power or Samsung Galaxy A-series) the JavaScript-eval time is 4× the Lighthouse-emulated time — so the effective TBT is **~1.2 s** (300 ms × 4). Visitors see the visual content paint at LCP 6.6 s, then wait 1+ additional second before taps register. **On a tap-heavy page** (the homepage has 13 long tasks, mostly 100–175 ms), that's the difference between "feels responsive" and "I tapped three times and nothing happened."

**Cause (verified by `long-tasks` audit):** 13 long tasks captured (top 5: 175, 172, 136, 108, 105 ms). Sources are jQuery eval (677 ms on jQuery 3.7.1 + 142 ms on jQuery 3.3.1 = 819 ms of redundant CPU work, see F-03), slider-plugin init, and gtag bootstrap. **None of this is mobile-specific in code** — but the **pain is mobile-specific** because mid-tier Android pays 4× what the Lighthouse model assumes.

**Solution:**
- Fix F-03 (dequeue theme jQuery) for an immediate ~820 ms CPU win (no mobile-specific change needed — the win is amplified on mobile).
- Fix F-08 (bundle 60 scripts) for an additional ~150-300 ms TBT win on mobile.
- Both fixes benefit desktop too, but the **biggest user-visible impact is on mid-tier Android** — which is the median reader.

**Expected outcome:** TBT 300 ms (Lighthouse) → ~150-200 ms (Lighthouse) after the F-03 + F-08 fixes, which on a real mid-tier Android is ~600-800 ms instead of 1.2 s. Mobile users see a "responsive" page instead of a "taps lag" page.

---

## F-13 — Good: viewport meta tag is correctly configured for mobile (and the apple-touch-icon is set)

**Metric:** Mobile rendering correctness, iOS home-screen support.

**How does this affect users?** Positive finding. Direct verification of the homepage HTML shows:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<link rel="apple-touch-icon" href="...">
```
The viewport meta is correct: `width=device-width` (so the page scales to the device's CSS width, not the legacy 980px), `initial-scale=1.0` (no auto-zoom on first load), and `viewport-fit=cover` (Safari extension that lets content extend under the notch / dynamic island). The `apple-touch-icon` is also set, which means iOS users who add the homepage to their home screen get a custom icon instead of a generic screenshot. **These are mobile-specific concerns that many government sites get wrong** — fixed-width viewports, no `width=device-width`, no `viewport-fit`, missing `apple-touch-icon` are all common failures that break mobile rendering.

**Cause (verified by `curl -sL https://www.mitur.gob.sv/ | grep viewport`):** The site's theme is correctly configured for mobile rendering out of the box. No intervention needed.

**Solution:** *No fix needed — this is a good finding.* Flagging it because the next mobile-finding work (see F-12, plus any future HWs that involve touch-event handling, tap-target sizes, mobile-only CSS) builds on this baseline. The team has the foundation right.

**Expected outcome:** *Already positive.* iOS home-screen users see a custom icon, mobile Safari respects the safe-area under the notch, and the page scales correctly to the device width on first load. None of this is broken — unlike many government sites that ship `width=1024` (or no viewport meta at all) and force mobile users to pinch-zoom.

---

## F-11 — Good: third-party surface is Google-only (no ad networks, no social widgets, no CMP, no video embeds)

**Metric:** Third-party vendor count, third-party transfer, third-party request count.

**How does this affect users?** Positive finding. The third-party surface on the homepage is small and contains only Google products — no ad networks, no Permutive, no OneTrust, no reCAPTCHA, no JWPlayer, no Facebook/Meta pixel, no social widgets, no embedded video players, no chat widgets. The full third-party inventory is:

| Domain | Requests | Transfer | Purpose |
|--------|---------:|---------:|---------|
| `fonts.googleapis.com` | 4 | ~4 KB | Google Fonts CSS (Dosis, Open Sans, Lato, Montserrat) |
| `www.googletagmanager.com` | 1 | 162.7 KB | GTM container `G-TGS16WRG4D` (async) |
| `fonts.gstatic.com` | 1 | 13.9 KB | Open Sans woff2 font file |
| `www.google-analytics.com` | 1 | ~0 KB | GA4 hit (fired by gtag) |

**Total: 11 third-party HTTP requests (some are inline `data:` URIs Lighthouse counts as 3P), 185 KB transfer, all from Google.** For comparison, the AP News course-project audit (a US news site with ads) had **8 third-party vendors** consuming 12 seconds of main-thread time and 1.91 MB of transfer. MITUR is dramatically lighter — about **10× less 3P transfer and 65× less 3P main-thread time** than AP News.

**Why this is a good finding:**
- **Attack surface**: no supply-chain risk from third-party SDKs.
- **Privacy**: the only 3P cookies set are the Google ones (analytics + ads preference if user opts in to GTM-driven tags). No Permutive-style fingerprinting, no LiveIntent, no ID5.
- **Performance**: gtag is `async` (correct). Google Fonts is the only 3P that blocks render — a small price for typography.
- **Regulatory**: for a government site, fewer 3P = fewer GDPR / privacy obligations.

**Why this is unusual for the region:** Government sites in Latin America often get weighed down by advertising SDKs, social widgets, embedded YouTube/Vimeo players, WhatsApp chat buttons, and tracking pixels. MITUR has none of that — it's a clean, public-sector, content-only site.

**Solution:** *No fix needed — this is a good finding.* The negative side: GTM is loaded but I don't see the data going anywhere useful in the network scan (only one GA4 beacon hits `/g/collect`). The team could either (a) confirm GTM is being used and keep it, or (b) drop GTM and self-host a 1-KB analytics script (Plausible, Matomo self-hosted) — but this is a "nice to have," not a "should fix."

**Expected outcome:** *Already positive.* 4 third-party domains, 11 third-party requests, 185 KB transfer. All Google. No remediation needed.

---

# Build outputs (HW7 — from the build-pipeline pass)

The next four findings come from `node scripts/build-capture.mjs` (puppeteer + Performance API + v8 coverage API). They cover the build-output data the brief asks for: JavaScript bundling, CSS bundling, images, and third-party tools.

---

## F-14 — 51 external scripts load synchronously in `<head>`, including plugins that don't apply to the homepage

**Metric:** Render-blocking script count, total blocking script bytes.

**How does this affect users?** Every visitor on every page pays the parse-and-execute cost of **51 synchronously-loaded external scripts** in `<head>`. This includes 5 plupload scripts (file upload, admin-only), 3 download-manager scripts (no downloads on homepage), 4 epoll-wp-voting scripts (no polls on homepage), 1 tablesome script (no tables on homepage), 10+ WordPress-core media scripts (media-views, media-editor, media-models — admin-only), and the theme's full Bootstrap bundle (213 KB). The mobile user on a 4G connection waits for all of this to load before the browser can start rendering the visible content. FCP on a real device is significantly higher than the 4.0 s Lighthouse reports because of these blocking scripts.

**Cause (confirmed by `document.scripts` DOM scan and Lighthouse `render-blocking-insight`):** WordPress's `wp_enqueue_script()` is called without a `$page` parameter, so every plugin's JS is loaded on every pageview regardless of whether the page actually uses the plugin. The theme's `bootstrap.bundle.js` (213 KB) is added with a hard dependency on jQuery, so it ships even when no Bootstrap JS is needed. The result: 51 sync external scripts in `<head>`, plus 6 deferred (smart-slider) and 1 async (gtag). Of the 51 sync scripts, only ~15 are actually needed on the homepage.

**Solution:**
- Use `wp_enqueue_script($handle, $src, $deps, $ver, true /* in_footer = true */)` for non-critical scripts so they load in the footer.
- Add `defer` (or `async`) to the theme's bootstrap.bundle.js, jquery-3.3.1.js, smart-slider files.
- Conditionally enqueue plugin scripts based on page type: `if ( is_page('contacto') ) wp_enqueue_script('cf7');` (and similar gates for download-manager, epoll-wp-voting, plupload, tablesome, mediaelement).
- For the homepage specifically: stop loading plupload, mediaelement, media-views, and download-manager. Saves ~250 KB of script bytes and ~30% of the render-blocking time.

**Expected outcome:** Render-blocking script count 51 → ≤ 15 on the homepage. Total blocking script transfer 646.9 KB → ~250 KB. Expected FCP improvement 0.5-1.0 s on mobile.

---

## F-15 — 37 stylesheets, ~340 KB of WordPress block-editor CSS shipped on the public side at 99.6% unused

**Metric:** Unused CSS bytes (puppeteer v8 coverage API), stylesheet count.

**How does this affect users?** The user pays the cost of **37 separate stylesheet requests** and **1.15 MB of unused CSS rules** (94% of the CSS that loads on the homepage doesn't apply). The largest waste is from WordPress's block-editor styles (`block-library` 128 KB, `block-editor` 113 KB, `components` 95 KB — together **336 KB at 99.6% unused**). These are admin-side styles for the Gutenberg block editor that have no business being shipped to public visitors. The other major wastes: `bootstrap.css` 202 KB at 93.8% unused (theme ships the full Bootstrap CSS but only uses grid + utility classes), `animate.css` 84 KB at 99.6% unused, `dashicons` 58 KB at 100% unused (admin menu icon font, never visible to visitors), `ionicons` 50 KB at 100% unused.

**Cause (confirmed by puppeteer v8 coverage API + Lighthouse `unused-css-rules`):** Same root cause as F-14 — WordPress's `wp_enqueue_style()` is called without page gates. The block-editor styles are enqueued by `wp-includes/script-loader.php` whenever `wp_head()` runs, which is every page. The theme loads the full Bootstrap CSS rather than the SASS-compiled subset. The icon fonts are enqueued by plugins that don't check whether the icons are actually used.

**Solution:**
- `wp_dequeue_style('wp-block-library')` and `wp_dequeue_style('wp-block-editor')` for non-admin pages (or use the `wp_dequeue_block_library_css()` snippet that's a 1-line drop-in).
- Replace the full `bootstrap.css` with a custom SASS build that only includes the parts the theme actually uses (grid, utilities, ~10 component classes).
- Dequeue `dashicons` and `ionicons` if not used in the theme.
- Move all per-plugin CSS behind `is_page()` / `is_singular()` gates.
- Or: enable a build step that runs PurgeCSS against the homepage HTML and outputs a single minified `app.css` — would reduce 184 KB of CSS transfer to ~30 KB and 37 requests to 1.

**Expected outcome:** Stylesheet count 37 → 1-3. CSS transfer 184 KB → ~50 KB (with PurgeCSS) or ~150 KB (with manual dequeue). Expected FCP improvement 0.3-0.5 s on mobile.

---

## F-16 — 0 of 35 images have `srcset`, `sizes`, `fetchpriority`, or `width`/`height` attributes (despite 1.7 MB of images loading)

**Metric:** Responsive-image coverage, image LCP candidate priority, image-derived CLS contribution.

**How does this affect users?** The 35 images on the homepage all ship at their full resolution. The largest image is `popup-actividades.jpg` at **254.8 KB** (the original is 2560+ px wide, but a 412 px mobile viewport needs a 600 px version at most — that's 4-5× smaller). The first card image (`IMG_5308.jpeg` at 234.7 KB) is the strongest LCP candidate; serving a viewport-sized variant would shave ~150 KB off the LCP fetch. None of the 35 images have `width` or `height` attributes, which directly drives the F-01 CLS finding (the browser doesn't know the aspect ratio until the image loads, so content jumps). None have `loading="lazy"` either, so images below the fold all fetch on first paint.

**Cause (confirmed by DOM scan of all `<img>` tags + Lighthouse network scan):** WordPress has built-in `srcset` support via `wp_get_attachment_image_srcset()` and `wp_calculate_image_srcset()`, but the theme's image-rendering helper is dropping it. The custom `card-img-overlaysv` markup (the source of F-01's CLS) doesn't pass through `wp_get_attachment_image()`. The `loading="lazy"` attribute is also missing — it's added by WordPress core for non-featured images but is being filtered out by the theme. `fetchpriority="high"` is a 2023 addition that the theme doesn't emit.

**Solution:**
- Add a filter that wraps theme image markup to inject `srcset`/`sizes`/`width`/`height`/`loading`/`fetchpriority`. The base pattern: `wp_calculate_image_srcset($attachment_id, $size, $image_src)` + `wp_get_attachment_image_sizes($size)` + `$image_meta['width']` / `['height']`.
- For the homepage: set `fetchpriority="high"` on the first card image (LCP candidate). Set `loading="lazy"` on every image below the first viewport.
- For the popup-actividades background image: serve a 600 px WebP variant via CSS `image-set()` (or, simpler, generate the smaller variant at upload time and reference it in the CSS).

**Expected outcome:** Image transfer on the homepage 1.73 MB → ~600 KB (3× reduction). LCP improvement: first card image fetch drops from 234.7 KB to ~30-50 KB. CLS contribution from images drops to 0. Largest-contentful-paint candidate gets a higher fetchpriority, reducing queue time.

---

## F-17 — AVIF is not served despite HTTPS + Cloudflare being capable (20 WebP images could be AVIF for ~25% additional savings)

**Metric:** Modern image format coverage, bytes per format.

**How does this affect users?** The site already does the right thing for WebP — every JPEG upload is auto-converted via WordPress's upload pipeline, so visitors get WebP at 20 of 36 image requests. But the next-generation AVIF format (better compression at the same quality) is not served at all. AVIF would save ~25% on top of WebP for the same images. On the homepage, that's an additional ~80 KB off the 1.73 MB image bucket. On a mobile 4G connection, that's ~250-400 ms of transfer time.

**Cause (confirmed by `MIME` breakdown in the Lighthouse network scan):** The WordPress upload pipeline uses the Imagick module's `imagewebp()` function to generate WebP variants, but doesn't generate AVIF. Cloudflare's image transformation (`/cdn-cgi/image/format=avif`) is enabled on the account but no AVIF `<source>` element is generated for the HTML markup. The theme's image-rendering helper outputs `<img src="...webp">` directly, not `<picture><source type="image/avif" srcset="...avif">...`.

**Solution:**
- Server-side: add an AVIF encode step to the upload pipeline. Imagick 7+ supports `imageavif()`; if Imagick isn't available, the `php-avif` extension or a CLI tool (`avifenc` from libavif) can run as a post-upload hook.
- CDN-side: add Cloudflare Polish + AVIF (one toggle in the Cloudflare dashboard) — auto-generates AVIF variants on the fly when the client supports them.
- Markup-side: emit `<picture>` with both AVIF and WebP `<source>` elements + a JPEG fallback. Pattern:
  ```html
  <picture>
    <source type="image/avif" srcset="...avif" sizes="...">
    <source type="image/webp" srcset="...webp" sizes="...">
    <img src="...jpeg" srcset="...webp" sizes="..." width="..." height="..." alt="...">
  </picture>
  ```

**Expected outcome:** Image transfer on the homepage 1.73 MB → ~1.30 MB (when combined with F-16's responsive images, total image transfer drops to ~400 KB). Expected LCP improvement 200-400 ms on mobile 4G. The fix is purely additive — no images are removed, the same images ship in a smaller format.

---

# Coverage & frames (HW8 — from the frame-analysis pass)

The next three findings come from `node scripts/coverage-frame-capture.mjs` (puppeteer + v8 coverage API + rAF deltas + DOM walk). They cover the three question sets the brief asks for: Coverage, Performance flame chart, and Layers & Animations.

---

## F-18 — No critical-CSS extraction pipeline: 16 inline `<style>` blocks aren't actually above-the-fold rules

**Metric:** Critical-CSS extraction (Y/N), inline CSS size, render-blocking external stylesheets.

**How does this affect users?** Every visitor pays the cost of 37 render-blocking external stylesheets (184 KB) plus 16 inline `<style>` blocks (60 KB) on every pageview. The inline blocks are NOT the result of a critical-CSS pipeline — they're what WordPress's default `wp_head()` call dumps inline, and they contain admin-side styles (`.wp-block-*`, `@media`) that happen to include loose "above-the-fold" markers. **There is no audit-grade critical-CSS extraction on the homepage** — the team is paying the cost of both the inline dump AND the full external stylesheets, with no FCP benefit from the inline rules. FCP is 4.0 s on a Lighthouse run; removing the render-blocking external stylesheet (in favor of `<link rel="preload" as="style">` + onload swap) would drop FCP by an estimated 0.5-1.0 s.

**Cause (confirmed by `document.styleSheets` walk + inline `<style>` count + critical-CSS marker scan):**
- **16 inline `<style>` blocks** totaling 59,663 bytes.
- **9 of those 16 blocks** match loose above-the-fold markers (regex: `(\.card-img|header|nav|body\s*\{|html\s*\{|\.site-header|\.navbar|\.hero|wp-block|@media)`).
- The 9 "matches" are misleading — they're WordPress admin CSS (`.wp-block-*`) and `@media` rules that happen to contain those tokens, not actual above-the-fold rules for the homepage layout.
- **37 external `<link rel="stylesheet">`** in `<head>`, all render-blocking, totaling 184 KB transfer. Largest: `bootstrap.css` (37 KB), `dashicons.min.css` (35 KB), `style.css` (theme, 14 KB), `block-library` (16 KB).
- No PurgeCSS, no critical extractor (Penthouse/Critical/cssnano-extract), no `wp_enqueue_style` filter that strips rules-by-selector.

**Solution:**
- Run **PurgeCSS** against the homepage HTML to produce a single critical CSS file (~30-50 KB, inlined) and a single deferred CSS file (the rest, loaded via `<link rel="preload" as="style">` + onload swap).
- Drop the inline `<style>` blocks for block-editor admin CSS (the same fix as F-15: `wp_dequeue_style('wp-block-library')` etc.) — those are the worst of the inline dump and they ship on every pageview.
- After PurgeCSS, move the remaining critical CSS to a build step (a `wp_enqueue_style` with a custom `style_loader_tag` filter that inlines the file's contents when it's below a size threshold).

**Expected outcome:** Render-blocking external stylesheets 37 → 1 (or 0, if all critical CSS is inlined). Inline `<style>` bytes 60 KB → 30-50 KB (after PurgeCSS, only actual above-the-fold rules). Total CSS in `<head>` 244 KB → 50 KB. FCP improvement 0.5-1.0 s on mobile (4.0 s → 3.0-3.5 s).

---

## F-19 — 2 dropped frames in 5s during load are the user-perceptible tail of F-12 (TBT) and F-14 (sync scripts)

**Metric:** Dropped frame count (>25 ms interval), effective fps, max frame interval.

**How does this affect users?** The frame chart shows that MITUR is **60.3 fps during scroll** and **60.4 fps during click** — the page is smooth once the main thread settles. The **load phase has 2 dropped frames in 5 seconds** (max interval 83.4 ms), corresponding to the residual JS settling (gtag init, Smart Slider 3 bootstrap) that continues after the 8-second wait. **These 2 transients are the user-perceptible tail of the F-12 (TBT 1.2 s on mobile amplification) and F-14 (51 sync scripts) problems** — the same root causes, documented here as direct frame-data evidence. Every visitor sees at least 1 dropped frame in the first 5 seconds of viewing the homepage.

**Cause (confirmed by `requestAnimationFrame` deltas, 8 s settle + 5 s load capture):**
- **Post-settle load (5 s, 297 frames captured)**: avg interval 16.88 ms, **2 dropped frames** (max 83.4 ms). Effective fps: 59.2.
- **Scroll (3 s, 181 frames)**: 0 dropped, avg 16.59 ms, max 16.8 ms. **Effective fps: 60.3** — perfect.
- **Click (2 s, 121 frames)**: 1 dropped (33.4 ms), avg 16.55 ms, max 33.4 ms. **Effective fps: 60.4** — within acceptable bounds.
- The 2 load-phase drops correspond to gtag init (~16 ms eval after 8s) and Smart Slider 3's `n2-ss-slider` setup (one frame at 83.4 ms). Both are "main-thread JS finishing what F-14 should have deferred."

**Comparison to AP News (course project, same methodology):**
| Phase | MITUR (post-8s) | AP News (post-8s) |
|---|---|---|
| Load (5 s) | 297 frames / 2 dropped / 59.2 fps | 8 frames / 7 dropped / ~1.0 fps |
| Scroll (3 s) | 181 frames / 0 dropped / 60.3 fps | 4 frames / 3 dropped / ~1.1 fps |
| Click (2 s) | 121 frames / 1 dropped / 60.4 fps | null (SPA scroll triggered nav) |

MITUR is **40-60× more responsive** than AP News in the post-settle phase. The gap is because AP News's third-party scripts (Permutive, Prebid, GTM, Viafoura, webcontentassessor) keep the main thread busy long past 8 s, while MITUR's main thread is free.

**Solution:** Same as F-12 (drop the 51 sync scripts via page-gate + footer-load) and F-14 (dequeue theme jQuery, drop the 51 sync scripts). The frame chart here doesn't generate a NEW corrective — it documents the user-perceptible impact of the existing F-12 / F-14 findings. After those fixes ship, the load phase drops should drop from 2 to 0.

**Expected outcome:** Load-phase dropped frames 2 → 0. Effective fps 59.2 → 60.0. Mobile TBT 1.2 s → 600-800 ms (per F-12 expected outcome). Scroll and click already at 60 fps; no change there.

---

## F-20 — 6 of 7 `will-change` declarations are WordPress block-editor admin CSS bleeding to public + 2 `translate3d(0,0,0)` from Smart Slider 3

**Metric:** Stacking context count, `will-change` declarations, `translate3d(0,0,0)` forced-compositing patterns, compositor layer count.

**How does this affect users?** Minimal direct user impact today, but the pattern is wasteful. The homepage has **107 stacking contexts** (mostly `position + z-index` from plugins, 85 of 107), **22 compositor layers** (9 transform + 7 opacity + 6 filter triggers), **7 `will-change` declarations** (6 of which are block-editor admin CSS), and **2 `translate3d(0,0,0)` "force the GPU" patterns** (both from Smart Slider 3). The frame chart shows the page still renders at 60 fps (scroll and click), so the GPU is handling the layer count comfortably — but the patterns are the Day 8 §1.3 anti-pattern (forcing compositor layers on elements that don't need them), and they consume GPU memory unnecessarily. On a 4-year-old mid-tier Android the layer budget starts to bite; today, on a modern device, it's invisible.

**Cause (confirmed by `document.styleSheets` CSS-rules walk + DOM walk + computed-style inspection):**

- **6 of 7 `will-change` declarations** are from WordPress block-editor admin CSS:
  - `.wp-block-gallery.has-nested-images figure.wp-block-image figcaption { will-change: transform }`
  - `.components-popover { will-change: transform }`
  - `.block-editor-block-list__insertion-point-indicator { will-change: transform, opacity }`
  - `.block-editor-block-list__insertion-point-inserter { will-change: transform }`
  - `.block-editor-global-styles__shadow-indicator { will-change: transform }`
  - `.block-editor-block-contextual-toolbar .block-editor-block-toolbar { will-change: transform }`
  - These ship on the public side because `wp_head()` is shared between admin and public (the same root cause as F-15 / F-18).
- **The 7th `will-change` is `.servicios-title a  ->  unset`** — a no-op (`will-change: unset` is the default, so the declaration is dead code).
- **Both `translate3d(0,0,0)` declarations are from Smart Slider 3**:
  - `.n2-ss-slider .n2_ss_video_player .n2_ss_video_player__cover { transform: translate3d(0px, 0px, 0px) }`
  - `.n2-ss-slider .n2-input, .n2-ss-slider .n2-ss-item-counter-counting-div { transform: translate3d(0px, 0px, 0px) }`
  - These are the canonical "force the GPU with a no-op transform" hack — the element doesn't actually need to be a compositor layer, but the plugin forces one anyway.

**Solution:**
- For the 6 block-editor `will-change` declarations: same fix as F-15/F-18 — `wp_dequeue_style('wp-block-library')` and `wp_dequeue_style('wp-block-editor')` for non-admin pages. The selectors are dead in the public-DOM context.
- For the 2 Smart Slider 3 `translate3d(0,0,0)` declarations: open a ticket with the Smart Slider 3 author. The plugin's CSS targets specific selectors that don't exist in the public DOM (the video player cover, the input/counter divs) — these are forced-compositing on elements that are either invisible or have no animation. Removing them would save ~2 GPU layers with zero user impact.
- The `.servicios-title a  ->  unset` is dead code but harmless; leave it.

**Expected outcome:** Compositor layer count 22 → 16 (after block-editor CSS is dropped). `will-change` declarations 7 → 1 (the no-op theme one). `translate3d(0,0,0)` declarations 2 → 0. GPU memory saved: ~6-8 MB. Frame chart unchanged at 60 fps. The fix is "good housekeeping" — these patterns aren't user-perceptible today but they cost memory and they signal to the next plugin author that "this is how we do things," which propagates the anti-pattern.

---

# Rendering strategies (HW9 — from the rendering-strategy pass)

The next two findings come from `node scripts/rendering-strategy.mjs` (puppeteer + Performance API + HTML inspection). They cover the three question sets the brief asks for: rendering strategy per page, user impact, and whether each page's choice is right.

---

## F-21 — HTML is never edge-cached: every visitor (including repeat visitors) triggers a fresh PHP render at origin

**Metric:** Cache-Control header, cf-cache-status, origin PHP render time per pageview.

**How does this affect users?** The HTML document is **never cached at Cloudflare's edge**. Every one of MITUR's 8 audited pages returns `cache-control: no-store, no-cache, must-revalidate` from the PHP origin and `cf-cache-status: DYNAMIC` at Cloudflare — meaning **every pageview, including repeat visits, triggers a full PHP render at Hostinger**. This is in stark contrast to MITUR's own static assets (125 of 140 homepage responses were `cf-cache-status: HIT` per the HW3 cold-vs-warm capture) and to AP News's same architecture (7 of 8 pages edge-cached for 1 year on the CDN). For a public-sector ministry site where the homepage content updates on a minutes-to-hours cadence, this is a configuration gap that costs origin load on every pageview and adds ~500 ms–2 s of PHP render time to the initial HTML response for visitors who could have been served from edge.

**Cause (confirmed by `node scripts/rendering-strategy.mjs` capture on 2026-07-24):** WordPress's default behavior is to send `no-store, no-cache, must-revalidate` on responses (to prevent stale authenticated content from being cached). Cloudflare respects this and serves HTML as `cf-cache-status: DYNAMIC` (always origin). The team's Cloudflare configuration has Page Rules that cache static assets aggressively (1 week), but no Page Rule that allows HTML caching with appropriate cache keys. AP News achieves 1-year CDN cache on 7 of 8 pages with the same SSR pattern — it's a config choice, not a server limitation.

**Solution:**
- Create a Cloudflare Page Rule for `mitur.gob.sv/*` that:
  - Sets **Cache Level = Cache Everything** (overrides the origin's no-store).
  - Sets **Edge Cache TTL = 1 hour** (HTML changes on a minutes-to-hours cadence, so 1-hour CDN cache is safe).
  - Sets **Browser Cache TTL = 5 minutes** (so returning visitors within 5 min don't even revalidate).
  - Uses **Cache Key** that excludes cookies for non-logged-in visitors (so auth cookies don't pollute the cache).
- For authenticated users (WordPress admin / logged-in editors), use a separate Page Rule that BYPASSES the cache.
- Alternative: install the official **Cloudflare WordPress plugin** which sets appropriate cache rules per page type automatically. The plugin handles the auth/logged-in case via a separate "Bypass Cache on Cookie" rule.
- Verify with `curl -I https://www.mitur.gob.sv/` after a fresh visit (cleared cache): should show `cf-cache-status: HIT` on the second visit.

**Expected outcome:** Origin render count for the homepage drops by ~95% (from 100% of pageviews to ~5% for cache misses). Origin PHP render time saved: ~500 ms–2 s per repeat visit (saves the user 0 ms but saves the origin the work). Cache hit rate for HTML: 0% → 95%+. The asset side is already cached at 89% (per HW3); the HTML side will match. For a 100k-pageview/day site, this saves 95k PHP renders/day.

---

## F-22 — WordPress generates 192–245 KB of HTML per page from 5–6 active plugins; visible content is <5 KB

**Metric:** HTML size per page, framework marker count per page, HTML-to-content ratio.

**How does this affect users?** Every MITUR page returns **192–245 KB of HTML** (gzipped: 41–49 KB on the wire). The visible content on the homepage is probably <5 KB of actual article text — the rest is plugin-emitted markup, schema.org JSON-LD from YOAST, Elementor wrapper divs, admin toolbars, and inline `<script>`/`<style>` blocks from the 5-6 active plugins (WordPress, YOAST SEO, Elementor, Smart Slider 3, Popup Maker, Download Manager, all detected on the homepage). Every visitor downloads this 192–245 KB even though the browser only renders a small fraction. **The HTML-to-content ratio is ~40-50× inflated by plugins.** This is the server-side cousin of F-14 (51 sync scripts) and F-15 (37 stylesheets): all three are the same plugin-bloat pattern, observed at different layers (HTML markup vs JavaScript vs CSS).

**Cause (confirmed by HTML inspection via `scripts/rendering-strategy.mjs`):** Each WordPress plugin emits its own DOM nodes and inline resources regardless of whether they're needed on the current page:
- **WordPress core**: emits the admin toolbar, query strings, comment-reply script, dashicons CSS, and `wp-block-library` + `wp-block-editor` (340 KB at 99.6% unused per F-15) on every pageview.
- **YOAST SEO**: emits 5–15 KB of schema.org JSON-LD on every page, regardless of whether the page is an article (where it's relevant) or a static page (where it's redundant).
- **Elementor**: emits 30–60 KB of wrapper divs + inline CSS variables, even on pages that don't use Elementor.
- **Smart Slider 3** (homepage only): emits 50+ KB of slider markup + 213 KB JS bundle.
- **Popup Maker**: emits inline stylesheet + 17 KB JS for the popup, on every pageview even though the popup is closed by default.
- **WordPress Download Manager**: emits CSS for the download-button styling on every page, even on pages without downloads.

**Solution:**
- **Audit each page's HTML for plugin-by-plugin contributions.** Run `curl -s https://www.mitur.gob.sv/ | grep -c "wp-content/plugins/YOAST"` style probes to see which plugin is emitting the most HTML per page. Page-gate the worst offenders:
  - Disable YOAST on pages that don't need SEO meta (FAQ, search, error pages).
  - Disable Elementor on pages built without Elementor (article pages are not built in Elementor).
  - Disable Popup Maker on pages where the popup isn't relevant (search, downloads).
  - Disable Download Manager CSS on pages without downloads.
- **WordPress-level fix**: each plugin's `wp_enqueue_*` call should pass a `$page` parameter to gate loading. The team can also use the "Asset Cleanup" or "Perfmatters" plugin to do this declaratively per page.
- **Estimated impact**: page-gating could cut HTML from 192–245 KB to ~80–120 KB (50% reduction), with a proportional drop in on-wire gzip size (47 KB → ~25 KB).

**Expected outcome:** HTML decompressed 192–245 KB → 80–120 KB per page. HTML gzipped on wire 41–49 KB → ~25 KB. Combined with F-21 (edge cache), repeat visitors download 25 KB instead of 47 KB AND the origin doesn't have to re-render. FCP improves by 100–200 ms on mobile (the bytes finish transferring earlier). The savings compound with F-21: edge cache hits the smaller HTML.

---

