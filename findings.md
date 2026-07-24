# Findings

*Seventeen findings from the homepage baseline. F-01 → F-05 from the HW2 CWV + PSI pass. F-06 → F-10 from the HW3 networking pass. F-11 added in the HW4 cleanup. F-12 + F-13 added in the HW5 mobile pass. F-14 → F-17 added in the HW7 build-analysis pass. Each follows the brief's structure: how does this affect users? / which metric? / cause? / solution? Lab evidence only — CrUX field data and WPT filmstrip not captured.*

*14 corrective findings (F-01 → F-09, F-12, F-14 → F-17) and 3 good findings (F-10, F-11, F-13). Brief requires at least 6 corrective + 2 good — both met.*

*Independence check: each finding is independently observable. No two findings primarily contribute to LCP — F-02 is about LCP timing / fetchpriority, F-04 is about image format / total weight (different mechanism, different solution).*

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

