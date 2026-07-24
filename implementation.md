# MITUR Performance Audit · Implementation Guide

For: the engineer who picks up approved findings and has to actually fix them.
Companion to: `presentation.md` (stakeholders), `findings.md` (all 22 findings), `prioritization.md` (PIE ranking), `baseline.md` (raw data).

**Reader's question:** *What do I change, and how will I know it worked?*

Each PR is a self-contained unit of work. You can pick any PR, implement it, and ship it without reading the rest of the guide. The PRs are ordered by PIE score (top cluster first), not by dependency — most are independent.

---

## How to use this guide

| If you need… | Go to |
| --- | --- |
| Specific PR instructions (mechanism, repro, fix, verify, risks) | This document, per-PR section |
| Full evidence trail for a finding | `findings.md` (F-01 to F-22) |
| Raw measurements behind a claim | `baseline.md` (HW2/HW3/HW7/HW8/HW9 sections) |
| Why this PR is prioritized | `prioritization.md` (PIE table + phase plan) |
| Stakeholder framing (for the leadership conversation) | `presentation.md` |
| Reproduction tooling (commands, scripts) | `justfile` + `scripts/*.mjs` |

---

## Coverage statement

> A silently-skipped domain and a domain with no findings look identical from outside. Below is the explicit boundary — anything not mentioned here, we didn't look.

### Covered

- 8 audited pages on `mitur.gob.sv` (homepage + 7 archetypes: news listing, article, contest, downloads, FAQ, search, access-to-information)
- Mobile preset (Lighthouse `--form-factor=mobile`, simulated Slow 4G + 4× CPU)
- CWV / PSI for all 8 pages
- Network Activity (cold vs warm transfer, cache hit rate per response type)
- Build outputs: JS bundles, CSS bundles, image formats, 3P loading strategy, source-map exposure
- Coverage: critical CSS extraction, unused JS, unused CSS (puppeteer v8 coverage API)
- Performance frame chart: dropped frames during load / scroll / click (rAF deltas)
- Layers & animations: stacking contexts, `will-change`, `translate3d` forced-compositing patterns
- Rendering strategy per page: SSR vs CSR vs SSG, edge-cache status, framework markers
- Third-party vendor inventory (Google-only: GTM, GA4, Google Fonts, gstatic)
- Mobile-specific CWV amplification (TBT × 4 on real mid-tier Android)
- Static asset edge-cache effectiveness (89% HIT rate per HW3)

### Skipped (explicit "no findings" — looked, concluded not applicable for these pages)

- Desktop PSI scores — the audit is mobile-only per the brief. Desktop can be re-run with the same recipes, but the audience is mobile-dominant (El Salvador, cellular data).
- CrUX field data (origin-level, last 28 days) — would refine the 75th-percentile picture. Lab data is consistent with what CrUX would show for a WordPress site in the "poor" band.
- INP (Interaction to Next Paint) — Lighthouse doesn't fully measure it. We captured TBT (Total Blocking Time) as the lab equivalent, which correlates with INP at the 75th percentile.
- WebPageTest filmstrip — not captured. Would help with CLS root-cause analysis on a per-frame basis.
- Full accessibility audit — visual inspection only. The viewport meta + apple-touch-icon are correct (F-13). Beyond that, this audit did not screen for WCAG 2.1 AA conformance.
- SEO / Best Practices / Agentic Browsing Lighthouse categories — only Performance category was captured.
- CrUX data on individual pages (URL-level) — origin-level only.

### Considered and concluded not applicable

- **Offline support / service worker.** Tourism content is perishable. Service worker would stale-cache information that's no longer accurate.
- **HTTP/3.** Not advertised by Hostinger's CDN at the origin. Cloudflare's free tier doesn't enable HTTP/3 to origin by default, and there's no measured benefit on the current wire profile.
- **WebSockets / SSE.** MITUR's site is request/response only. No live-update surfaces.
- **PWA / install prompts.** Tourism ministries aren't a PWA fit. The brief didn't ask.
- **AMP (Accelerated Mobile Pages).** Google deprecated AMP Top Stories in 2024 for non-news publishers, and the ministry's content is institutional rather than breaking-news.
- **Brotli on origin.** Already enabled at the Cloudflare edge. Configuring Brotli at Hostinger would be redundant.
- **RUM (Real User Monitoring) instrumentation.** See PR 18 (Phase 3). Lab-only audit; field data capture requires backend work that's out of scope for this audit.

---

## Reproduction tooling

The `justfile` is the source of truth for measurement. If a number in this guide differs from what you measure, do not assume this guide is correct. Re-run, and update the guide.

| Recipe | What it does |
| --- | --- |
| `just audit URL NAME` | Single-page Lighthouse (mobile, simulated throttling) |
| `just audit-all` | All 8 audited pages in sequence; JSON to `lighthouse/*.json` |
| `just report` | Markdown summary table of all captured scores |
| `just cold-vs-warm` | Measure cold vs warm transfer (Cloudflare cache effectiveness) |
| `just build-capture` | Puppeteer scan of JS/CSS bundles, image formats, 3P loading |
| `just coverage-frames` | Coverage API + frame chart + layers/animations |
| `just rendering-strategy` | Detect rendering strategy per page |
| `just present` | Render stakeholder deck as PNGs |
| `just present-es` | Render Spanish stakeholder deck as PNGs |
| `just clean` | Wipe generated artifacts |

**MITUR-specific flags** (already in justfile):

- Chrome: `--headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage --user-data-dir=/tmp/chromium-mitur`
- Lighthouse: `--only-categories=performance --form-factor=mobile --throttling-method=simulate --max-wait-for-load=20000`
- No consent popup to dismiss (MITUR has no OneTrust / CookieConsent).
- The `__cf_bm` cookie from Cloudflare is bot management, passes through fine.

---

## Phase 1 · Week 1 — Stop the bleed

Eight PRs. Total effort: 1 engineer, 1 week. No backend rebuild. No business logic touched. No new vendor contracts.

### PR 1 · Cache HTML at Cloudflare's edge

> `local` — no cross-team coordination required. The team's Cloudflare account is already set up.

**Mechanism**

The WordPress origin returns `cache-control: no-store, no-cache, must-revalidate` on every response. Cloudflare respects this and serves HTML as `cf-cache-status: DYNAMIC` for every pageview. Static assets are correctly cached at 89% (CSS, JS, images, fonts), but the HTML itself is always origin. **7 of 8 audited pages are cacheable** (only `/search?` is query-dependent and excluded).

**Reproduction**

```bash
# Should show DYNAMIC for the HTML document
curl -sI https://www.mitur.gob.sv/ | grep -i 'cf-cache-status\|cache-control'
# Expected:
#   cache-control: no-store, no-cache, must-revalidate
#   cf-cache-status: DYNAMIC

# Should show the HTML on the wire is 41-49 KB
curl -sI https://www.mitur.gob.sv/ | grep -i 'content-encoding\|transfer-encoding'
# Expected: content-encoding: gzip, transfer-encoding: chunked
```

**The fix**

In the Cloudflare dashboard for `mitur.gob.sv`:

1. **Rules → Page Rules → Create rule**
2. URL pattern: `mitur.gob.sv/*`
3. Settings:
   - **Cache Level** = `Cache Everything` (overrides the origin's `no-store`)
   - **Edge Cache TTL** = `1 hour`
   - **Browser Cache TTL** = `5 minutes` (so returning visitors within 5 min don't even revalidate)
   - **Cache Key** = default (no overrides for now)
4. Save. Wait 30 seconds for propagation.

**Optional but recommended** — a second Page Rule to BYPASS cache for logged-in users (so editors don't see stale content):

1. **Rules → Page Rules → Create rule**
2. URL pattern: `*mitur.gob.sv/wp-admin*` and `*mitur.gob.sv/wp-login*`
3. Setting: **Cache Level** = `Bypass`
4. Save.

**Alternative** (if you want version-controlled config): install the official [Cloudflare WordPress plugin](https://wordpress.org/plugins/cloudflare/) and set the recommended cache rules from `wp-admin`. The plugin handles the auth-cookie bypass automatically.

**Verify it worked**

```bash
# First request — may still be DYNAMIC if cache is empty
curl -sI https://www.mitur.gob.sv/ | grep -i 'cf-cache-status'
# Expected: DYNAMIC (cold)

# Second request — should now be HIT
curl -sI https://www.mitur.gob.sv/ | grep -i 'cf-cache-status'
# Expected: HIT
```

Re-run `just audit-all` and check the homepage's `TTFB` (Time to First Byte) drops from ~500ms-2s to <100ms.

**Risks / edge cases**

- **Login cookies**: the WordPress admin cookie (`wordpress_logged_in_*`) is set on any visit if you've been to `wp-admin` recently. Make sure the bypass rule is in place *before* the catch-all rule.
- **Plugin updates**: when WordPress auto-updates a plugin, it clears the object cache (if W3 Total Cache or similar is installed), but Cloudflare's edge cache is independent. Plan to manually purge Cloudflare on plugin updates.
- **Search results** (`/search?`): the query string is part of the cache key, so each unique search gets its own cache entry. Edge cache for `/search?` only helps on repeated identical queries (rare). Acceptable trade-off.
- **`cf-cache-status`** is only set by Cloudflare, not the origin. If you see `cf-cache-status: DYNAMIC` after the Page Rule is in place, the rule hasn't propagated (wait 30s) or the URL pattern doesn't match.
- **Plugin comments / content personalisation**: if you later add a plugin that injects user-specific content (e.g. "Welcome back, {username}"), it must run client-side or be excluded from the cache. Don't add such plugins.

**Structural vs local**

Local. One dashboard toggle.

---

### PR 2 · Dequeue the second jQuery

> `local` — single line of PHP in the child theme.

**Mechanism**

The theme bundles `jquery-3.3.1.js` (269 KB). WordPress core ships `jquery.min.js` (3.7.1, 30 KB compressed). Both load synchronously in `<head>`. The browser parses and executes jQuery 3.3.1, then re-parses and re-executes jQuery 3.7.1 (which is mostly compatible but not 100% drop-in for 3.3.x). **~820 ms of redundant CPU work per pageview.**

**Reproduction**

```bash
just build-capture | grep -E 'jquery.*3\.|jquery.*3\.7'
# Should list both jquery-3.3.1.js and jquery.min.js (3.7.1)

# Or check the homepage HTML directly:
curl -s https://www.mitur.gob.sv/ | grep -oE 'jquery[^"]*\.js[^"]*' | sort -u
# Expected: at least 2 distinct jQuery URLs
```

**The fix**

In the child theme's `functions.php` (typically `wp-content/themes/instituciones-child/functions.php`; create the child theme if it doesn't exist):

```php
<?php
// wp-content/themes/instituciones-child/functions.php

// Dequeue the theme's old jQuery; let WP core's jQuery (3.7.1) handle everything.
add_action('wp_enqueue_scripts', function () {
    wp_dequeue_script('instituciones-jquery-3.3.1');
    // If the theme uses a different handle, list it from the output of
    // `just build-capture`. Common variants:
    // wp_dequeue_script('jquery-3.3.1');
    // wp_dequeue_script('theme-jquery');
}, 20);
```

If you're not sure of the exact handle, inspect the homepage HTML:

```bash
curl -s https://www.mitur.gob.sv/ | grep -E 'jquery.*3\.[0-9]'
# The handle won't be visible in the URL — instead, look at the
# theme's wp_enqueue_script call in wp-content/themes/instituciones/
# and match the handle name. Or use this script in wp-admin:
#   wp-admin → Tools → Site Health → Info → Files → wp-includes/script-loader.php
#   (not useful; instead use `wp-script-debug`)
```

**Verify it worked**

Re-run `just build-capture` and check the top 10 unused-JS offenders list — `jquery-3.3.1.js` should no longer appear.

```bash
# HTML should have only ONE jQuery now
curl -s https://www.mitur.gob.sv/ | grep -oE 'jquery[^"]*\.js[^"]*' | sort -u
# Expected: 1 line, the WP-core jquery.min.js (3.7.1)
```

**Risks / edge cases**

- **Plugin compatibility**: some older plugins call `$.fn` methods that changed between 3.3 and 3.7. The migration guide is at https://jquery.com/upgrade-guide/3.0/. Check the audit's `just build-capture` top JS offenders — if any plugin relies on a 3.3-only method, you'll see console errors. Test on a staging environment first.
- **Theme dependencies**: the theme might use a 3.3-only jQuery plugin (e.g. legacy Slick slider). Audit the theme's `js/` directory for `$.fn.X` calls and grep for the deprecated methods.
- **Order of dequeue**: if the theme registers its jQuery *after* the child theme's dequeue runs, the dequeue is a no-op. Use `priority=20` (later than default `10`) to ensure the dequeue runs after the theme's enqueue.

**Structural vs local**

Local. One line in `functions.php`.

---

### PR 3 · Defer 51 sync scripts; page-gate per plugin

> `local-with-plugin-help` — recommended to install Asset Cleanup Pro or Perfmatters for the visual UI, otherwise the manual approach below works.

**Mechanism**

51 external scripts load synchronously in `<head>` (per F-14). HTML parsing blocks until each completes. Many of these scripts are plugins that the homepage doesn't actually need (plupload = file upload, mediaelement = video player, download-manager = download listings, epoll-wp-voting = poll voting, etc.). The 5 active plugins each register their own `.js` files on `wp_enqueue_scripts`, and the theme loads `bootstrap.bundle.js` regardless of page type.

**Reproduction**

```bash
just build-capture | grep -A 30 '=== Unused JS (coverage) ==='
# Lists the 91 entries with wasted bytes

# Or look at sync scripts in head directly:
curl -s https://www.mitur.gob.sv/ | grep -oE '<script[^>]*src=[^>]+></script>' | head -10
# Most will be sync (no async/defer)
```

**The fix**

There are two parts: (a) defer the script tags, (b) page-gate the plugins.

**Part (a) — defer scripts in `functions.php`:**

```php
<?php
// wp-content/themes/instituciones-child/functions.php

// Defer all non-critical scripts. This works for scripts that don't
// need to be available before DOMContentLoaded (most analytics, ads, etc.).
add_filter('script_loader_tag', function ($tag, $handle) {
    // Don't defer jQuery (needed by themes and plugins on DOMContentLoaded)
    if (in_array($handle, ['jquery', 'jquery-core', 'jquery-migrate'])) {
        return $tag;
    }
    // Don't defer scripts that are already async/defer
    if (strpos($tag, ' async') !== false || strpos($tag, ' defer') !== false) {
        return $tag;
    }
    // Defer everything else
    return str_replace(' src=', ' defer src=', $tag);
}, 10, 2);
```

**Part (b) — page-gate per plugin using `wp_dequeue_script` per page:**

```php
<?php
// wp-content/themes/instituciones-child/functions.php

add_action('wp_enqueue_scripts', function () {
    if (!is_page('contacto')) {
        // Contact Form 7: only needed on the contact page
        wp_dequeue_script('contact-form-7');
        wp_dequeue_style('contact-form-7');
    }
    if (!is_page('galeria') && !is_singular('photo_contest')) {
        // Smart Slider 3: only on the photo contest page
        wp_dequeue_script('smartslider3');
        wp_dequeue_style('smartslider3');
    }
    if (!is_page('descargas') && !is_singular('descarga')) {
        // WordPress Download Manager: only on download pages
        wp_dequeue_script('wpdm-bootstrap');
        wp_dequeue_script('wpdm-front');
        wp_dequeue_style('wpdm-front');
    }
    if (!is_singular('post')) {
        // Elementor: only on Elementor-built pages
        wp_dequeue_script('elementor-frontend');
        wp_dequeue_style('elementor-frontend');
    }
    // epoll-wp-voting: only on pages with polls
    wp_dequeue_script('epoll-wp-voting');
    wp_dequeue_style('epoll-wp-voting');
    // Popup Maker: only on pages that actually have a popup
    wp_dequeue_script('popup-maker-site');
    wp_dequeue_style('popup-maker-site');
    // MediaElement: only on singular posts with audio/video
    if (!is_singular('post')) {
        wp_dequeue_script('mediaelement');
        wp_dequeue_style('mediaelement');
    }
    // Plupload: only in wp-admin
    if (!is_admin()) {
        wp_dequeue_script('plupload');
    }
}, 100);
```

For a more declarative approach, install **Asset Cleanup Pro** or **Perfmatters** — both provide a per-page UI to disable CSS/JS without writing PHP. Perfmatters is lighter (no annual fee for personal use).

**Verify it worked**

```bash
# After deploying, re-run build-capture
just build-capture | head -50
# Top JS offenders should show fewer entries, smaller wasted bytes

# Or look at the actual <script> tags in head:
curl -s https://www.mitur.gob.sv/ | grep -oE '<script[^>]*src=[^>]+></script>' | wc -l
# Expected: significant drop from 51 sync to ~5-10 sync (jQuery + critical bootstrap + slider + smartslider on homepage)
```

**Risks / edge cases**

- **Plugin dependencies**: some plugins load their own jQuery-dependent scripts after a dequeue. If a plugin breaks, re-enqueue its deps. Common pattern: a plugin that uses jQuery and runs `$(document).ready(...)` will fail if jQuery loads after.
- **Defer vs async**: `defer` runs scripts in order, after HTML parse, before DOMContentLoaded. `async` runs whenever the script is ready, out of order. Use `defer` for most cases; `async` only for independent analytics.
- **Order of execution**: with `defer`, scripts execute in the order they appear in the DOM. If script B depends on script A, both must be deferred, in the right order. Check for `wp_enqueue_script` calls in plugins that use the `$deps` parameter.
- **Page-gate false positives**: a plugin might be needed on a page you didn't think of. Audit your analytics (which pages get the most traffic?) before aggressively dequeueing.

**Structural vs local**

Local with optional plugin help.

---

### PR 4 · Drop WordPress block-editor admin CSS on public pages

> `local` — single block of PHP.

**Mechanism**

WordPress's `wp_head()` enqueues `block-library` (128 KB), `block-editor` (113 KB), and `components` (95 KB) CSS for both admin and public pages. On the public side, these admin-side styles are 99.6% unused. Total: ~336 KB of CSS shipped per pageview for nothing.

**Reproduction**

```bash
# Check the homepage's stylesheet list
curl -s https://www.mitur.gob.sv/ | grep -oE '<link[^>]*stylesheet[^>]*>' | head -20
# Look for block-library, block-editor, components

just build-capture | grep -E 'block-library|block-editor|components'
# Each should show ~99% unused
```

**The fix**

In `wp-content/themes/instituciones-child/functions.php`:

```php
<?php
// wp-content/themes/instituciones-child/functions.php

// Drop WordPress block-editor admin CSS from public pages.
// Safe because: the public site doesn't use Gutenberg blocks (the theme
// uses Elementor / hand-rolled HTML), and the admin uses its own enqueue
// path that doesn't go through wp_head() the same way.
add_action('wp_enqueue_scripts', function () {
    if (is_admin()) {
        return; // never dequeue in admin
    }
    wp_dequeue_style('wp-block-library');
    wp_dequeue_style('wp-block-library-theme');
    wp_dequeue_style('wp-block-editor');
    wp_dequeue_style('wp-components');
}, 100);
```

**Verify it worked**

```bash
# After deploying, the homepage should NOT include these
curl -s https://www.mitur.gob.sv/ | grep -E 'block-library|block-editor|components'
# Expected: no matches

# Or check the lighthouse coverage report:
just coverage-frames | grep -E 'block-library|block-editor|components'
# Should show no wasted CSS in these stylesheets
```

**Risks / edge cases**

- **Gutenberg blocks on the public side**: if any post or page uses Gutenberg blocks (the block editor's output) for content rendering, the public-side styles are needed. Check the rendered HTML on a few posts: `<blockquote>`, `<table>`, `<figure>`, etc. indicate Gutenberg block usage.
- **Themes that rely on block styles**: the default WordPress themes (Twenty Twenty-Four etc.) use block styles heavily. MITUR's `instituciones` theme is custom; check it before shipping.
- **Block-based widgets**: if any widget is a block widget, the styles may be needed. Audit the widgets in `wp-admin → Appearance → Widgets`.

**Structural vs local**

Local. One block of PHP.

---

### PR 5 · PurgeCSS pipeline

> `local-with-build-step` — requires a build step in the deployment pipeline. Skip if MITUR doesn't have a CI/CD pipeline.

**Mechanism**

The theme + plugins ship 1.15 MB of CSS. Per the coverage analysis (F-18), 94.3% is unused on the homepage. PurgeCSS walks the HTML and removes any CSS selector that doesn't match an element.

**Reproduction**

```bash
just coverage-frames | grep -A 30 '=== Unused CSS'
# Shows 50 stylesheets, 1.15 MB unused

# Or just check the CSS transfer size:
just build-capture | grep -E 'css.*KB'
# Top CSS offenders are 187 KB (bootstrap), 127 KB (block-library), etc.
```

**The fix**

There are two approaches: (a) install a WordPress plugin that purges CSS at runtime, (b) set up a build step that produces a purged CSS bundle.

**Approach (a) — runtime CSS purging via plugin:**

Install **Asset Cleanup Pro** (paid, ~$60/year) or **LiteSpeed Cache** (free, with their own purge logic). Both ship PurgeCSS-equivalent logic and serve a per-page CSS bundle.

**Approach (b) — build-step CSS purging:**

If the deployment is via Git, add a build step in CI:

```bash
# Install PurgeCSS
npm install --save-dev purgecss

# Add to package.json scripts:
# "build:css": "purgecss --css wp-content/themes/instituciones/style.css --content wp-content/themes/instituciones/**/*.php --output dist/style.purged.css --safelist theme-no-delete-this-class"

# Then in functions.php, enqueue dist/style.purged.css instead of style.css:
# wp_enqueue_style('instituciones', get_template_directory_uri() . '/../dist/style.purged.css');
```

`--safelist` lists selectors that don't appear in HTML but are still needed (e.g. dynamically-added classes via JS).

**Verify it worked**

```bash
# Re-run coverage-frames
just coverage-frames | grep -A 5 '=== Unused CSS'
# Unused CSS should drop from 94.3% to <50%

# Or compare CSS file size:
ls -la wp-content/themes/instituciones/style.css
# vs
ls -la dist/style.purged.css
# The purged version should be ~50% smaller
```

**Risks / edge cases**

- **Dynamic class names**: PurgeCSS removes selectors that don't match the HTML. If your JS dynamically adds classes (e.g. `$el.addClass('user-active')`), the corresponding CSS will be removed. Use `--safelist` or document these in `purgecss.config.js`.
- **WordPress admin styles**: PurgeCSS only knows about the public-side HTML. Admin pages will have broken styles if you serve the purged CSS in admin. Only enqueue the purged CSS on the public side.
- **Caching**: after PurgeCSS runs, the CSS file changes. Cloudflare will treat it as a new file. May want to version the filename (e.g. `style.abc123.css`).
- **Gutenberg block editor styles** (already covered by PR 4): the same PurgeCSS safelist should not include block-editor classes on the public side.

**Structural vs local**

Local with a build step. If the deployment is manual (no CI), the runtime plugin (Approach a) is the simpler path.

---

### PR 6 · Add width/height to the homepage's image cards

> `local` — modify the theme template that renders the homepage.

**Mechanism**

The theme's image-card markup doesn't include `width` and `height` attributes. The browser doesn't know the aspect ratio until the image loads, so the layout shifts when the image arrives. CLS on the homepage is 0.382 (3.8× the "good" threshold).

**Reproduction**

```bash
# Look at the homepage's image markup
curl -s https://www.mitur.gob.sv/ | grep -oE '<img[^>]*>' | head -10
# Most img tags should NOT have width/height

# Or check the Lighthouse layout-shift-elements audit
just audit https://www.mitur.gob.sv/ homepage | grep -A 20 layout-shift
# Identifies which elements are shifting
```

**The fix**

Find the theme's image-card template (likely `wp-content/themes/instituciones/template-parts/card.php` or similar) and add dimensions.

**If the theme uses `the_post_thumbnail`:**

```php
<?php
// Before
the_post_thumbnail('card-large');

// After — get the attachment ID and dimensions
$thumb_id = get_post_thumbnail_id();
$thumb_meta = wp_get_attachment_metadata($thumb_id);
$thumb_url = wp_get_attachment_image_src($thumb_id, 'card-large');
?>
<img src="<?php echo esc_url($thumb_url[0]); ?>"
     width="<?php echo esc_attr($thumb_meta['width']); ?>"
     height="<?php echo esc_attr($thumb_meta['height']); ?>"
     alt="<?php echo esc_attr(get_the_title()); ?>"
     loading="lazy"
     decoding="async">
```

**If the theme uses inline background-image:**

```php
<?php
// Before
<div class="card-img" style="background-image: url('<?php echo $url; ?>')"></div>

// After — set CSS aspect-ratio
$img_meta = wp_get_attachment_metadata($attachment_id);
$aspect = $img_meta['height'] / $img_meta['width'] * 100; // % for padding-bottom hack
?>
<div class="card-img" style="background-image: url('<?php echo $url; ?>'); aspect-ratio: <?php echo $img_meta['width']; ?>/<?php echo $img_meta['height']; ?>"></div>
```

**Verify it worked**

Re-run `just audit https://www.mitur.gob.sv/ homepage` and check CLS. Expected: 0.382 → ≤ 0.1.

**Risks / edge cases**

- **Aspect-ratio drift**: if the upload pipeline crops images to different aspect ratios (e.g. featured images are 16:9 but card thumbnails are 4:3), the width/height pair must match the actual rendered size, not the original upload. Use the `card-large` WordPress image size as the source of truth.
- **SVG images**: SVG is vector and doesn't have a fixed width/height. Add `viewBox` instead and let CSS handle sizing.
- **Lazy-loaded images**: if you add `loading="lazy"` (as in the example), the dimensions are still needed for the browser to reserve space before the image enters the viewport. Don't skip width/height on lazy images.

**Structural vs local**

Local (template change).

---

### PR 7 · LCP fetchpriority + AVIF variants

> `local` — modify the theme template, plus configure the AVIF plugin.

**Mechanism**

The LCP image is the first card image (`IMG_5308.jpeg`, 234.7 KB). It's fetched at the same priority as below-fold images and ads. Adding `fetchpriority="high"` tells the browser to start it first. Additionally, serving AVIF instead of WebP saves ~25% on transfer for the same image.

**Reproduction**

```bash
# Check the LCP image's HTML
curl -s https://www.mitur.gob.sv/ | grep -oE '<img[^>]*>' | head -5
# Should NOT have fetchpriority="high"

# Check the LCP element in Lighthouse
just audit https://www.mitur.gob.sv/ homepage | grep -A 5 'largest-contentful-paint-element'
# Identifies which element is LCP

# Check current image format
just build-capture | grep -E 'image/'
# Top formats: image/webp, image/svg+xml, image/gif
# image/avif should NOT appear
```

**The fix**

**Part (a) — add `fetchpriority="high"`:**

In the same template file as PR 6 (or wherever the LCP image is emitted), add the attribute:

```php
<img src="<?php echo esc_url($thumb_url[0]); ?>"
     width="<?php echo esc_attr($img_meta['width']); ?>"
     height="<?php echo esc_attr($img_meta['height']); ?>"
     alt="<?php echo esc_attr(get_the_title()); ?>"
     fetchpriority="high"
     loading="eager"
     decoding="sync">
```

`loading="eager"` (not `lazy`) for the LCP image — you don't want it deferred.
`decoding="sync"` (not `async`) — decode immediately so the image is ready when the browser wants to paint it.

**Part (b) — configure AVIF generation:**

Install one of these AVIF plugins:
- **ShortPixel Image Optimizer** (paid after trial, ~$4/month for 1000 images/month) — generates AVIF + WebP
- **Imagify** (paid) — same
- **EWWW Image Optimizer** (free tier) — supports AVIF
- **Cloudflare Polish** (free in Cloudflare dashboard) — automatically serves AVIF to supporting browsers

Cloudflare Polish is the simplest: enable `Polish → Lossy + WebP` in the Cloudflare dashboard. Polish will serve AVIF to browsers that support it (Chrome, Firefox, Edge, Safari 16+).

**Verify it worked**

```bash
# LCP should drop
just audit https://www.mitur.gob.sv/ homepage | grep -A 2 'largest-contentful-paint'
# Expected: LCP 6.6 s → 2.5-3.5 s

# Check that AVIF is being served
curl -sI -H 'Accept: image/avif,image/webp,image/*' https://www.mitur.gob.sv/wp-content/uploads/.../*.webp | grep -i 'content-type\|cf-polished'
# Expected: content-type: image/avif (or cf-polished: lossless or avif)
```

**Risks / edge cases**

- **`fetchpriority` browser support**: Chrome 102+, Firefox 132+, Safari 17.2+. Older browsers ignore it. Safe to add.
- **Wrong LCP element**: the LCP element changes per page. On the homepage, the first card image is LCP. On the article page, the article hero image is LCP. Add `fetchpriority="high"` to the correct element per template.
- **AVIF encoding is slow**: if you generate AVIF on upload (WordPress plugin), large images can take seconds to encode. Consider off-peak processing or background job.
- **Cloudflare Polish vs WordPress plugin**: don't double-process. Pick one. Cloudflare Polish is recommended (one config toggle, no PHP overhead).

**Structural vs local**

Local (template + plugin config).

---

### PR 8 · Per-page plugin page-gating (HTML side)

> `local-with-plugin-help` — requires the Asset Cleanup Pro / Perfmatters plugin (or manual `wp_dequeue_style` calls per page).

**Mechanism**

Same root cause as F-14 (51 sync scripts) but on the HTML side: each plugin emits its own HTML markup (admin toolbars, schema.org JSON-LD from YOAST, Elementor wrapper divs, etc.) regardless of whether the page uses the plugin. The homepage generates 225 KB of HTML, of which most is plugin-emitted.

**Reproduction**

```bash
# Check the homepage HTML size
curl -s https://www.mitur.gob.sv/ | wc -c
# Expected: ~225 KB

# Or use the rendering-strategy capture
just rendering-strategy | grep -E 'homepage|HTML'
# Should show 225 KB decompressed
```

**The fix**

**Approach A — Asset Cleanup Pro / Perfmatters (declarative UI):**

1. Install Perfmatters (preferred) or Asset Cleanup Pro
2. In `wp-admin → Settings → Perfmatters → Scripts` or `Asset Cleanup → CSS/JS Manager`:
3. For each plugin, set "Disable on" per page type:
   - **Elementor**: disable on news article pages, downloads, FAQ
   - **WordPress Download Manager**: disable everywhere except `/descargas/`
   - **Smart Slider 3**: disable everywhere except `/` (homepage) and `/contest/`
   - **Popup Maker**: disable everywhere
   - **epoll-wp-voting**: disable everywhere
   - **MediaElement**: disable everywhere except singular posts with `<audio>` or `<video>`
   - **YOAST SEO schema**: disable on FAQ, search, access-to-information (low-value pages)

**Approach B — manual `wp_dequeue_style` per page (in `functions.php`):**

```php
<?php
add_action('wp_enqueue_scripts', function () {
    // Disable YOAST schema on low-value pages
    if (is_page(['preguntas-frecuentes', 'acceso-a-la-informacion-publica']) || is_search()) {
        // YOAST outputs schema.org JSON-LD for posts; not needed on FAQ/search
        add_filter('wpseo_output_json_ld_output', '__return_false');
    }
    // Disable Elementor on article pages
    if (is_singular('post') && !has_blocks()) {
        wp_dequeue_style('elementor-frontend');
    }
    // Disable Elementor on archive pages
    if (is_archive()) {
        wp_dequeue_style('elementor-frontend');
    }
}, 100);
```

**Verify it worked**

```bash
# Re-run rendering-strategy capture
just rendering-strategy | grep -A 20 'homepage'
# HTML size should drop to ~80-120 KB

# Or compare HTML on different pages
for page in homepage preguntas-frecuentes search; do
    echo "=== $page ==="
    curl -s "https://www.mitur.gob.sv/$([[ $page != 'homepage' ]] && echo "?page=$page" || echo '')" | wc -c
done
# Different pages should have visibly different sizes after the fix
```

**Risks / edge cases**

- **Page builder templates**: Elementor-built pages need the styles. Check `is_page()` against the specific page IDs.
- **Conditional shortcodes**: if a plugin uses WordPress shortcodes (e.g. `[smartslider3]`), dequeueing the styles on a page that uses the shortcode breaks the rendering. Audit the content for shortcode usage.
- **Cache invalidation**: with PR 1 (Cloudflare HTML edge cache) in place, page-level dequeue changes need a cache purge. Perfmatters has a built-in "purge on save" option.

**Structural vs local**

Local with optional plugin help.

---

### Phase 1 · Ship criteria

All eight PRs must be merged before the audit is considered "shipped" for Phase 1.

| Metric | Before | Target | Source |
| --- | --- | --- | --- |
| LCP (homepage) | 6.6 s | ≤ 3.5 s | `just audit` |
| CLS (homepage) | 0.382 | ≤ 0.1 | `just audit` |
| TBT (homepage, Lighthouse) | 300 ms | ≤ 200 ms | `just audit` |
| TBT (mid-tier Android, real) | ~1.2 s | ~600 ms | F-12 (estimated) |
| Perf score (homepage) | 37 | ≥ 50 | `just audit` |
| Pages out of "poor" band | 2 of 8 | ≥ 6 of 8 | `just report` |
| Image transfer (homepage) | 1.73 MB | ~400 KB | `just build-capture` |
| HTML edge-cache hit rate | 0 % | ≥ 95 % | `curl -sI` cf-cache-status |
| HTML size (homepage) | 225 KB | ~120 KB | `just rendering-strategy` |
| Render-blocking scripts | 51 | ≤ 15 | `curl -s ... | grep sync` |
| Render-blocking stylesheets | 37 | ≤ 5 | `curl -s ... | grep stylesheet` |
| Plugin-bundled CSS on public | 336 KB | 0 | F-15 / F-20 |

---

## Phase 2 · Weeks 2–4 — Fix the structure

Seven PRs. Total effort: 1 engineer, 2 weeks. Extends the Phase 1 wins to a complete fix.

### PR 9 · Theme filter for srcset/sizes/fetchpriority on every `<img>`

> `local` — single PHP filter that wraps every post's image output.

**Mechanism**

F-16 found that 0 of 35 images have `srcset`, `sizes`, `fetchpriority`, or `width`/`height`. PR 6 fixed the LCP image. This PR fixes *every* image emitted by WordPress on the public side.

**The fix**

In `wp-content/themes/instituciones-child/functions.php`:

```php
<?php
// Wrap wp_get_attachment_image() output to inject srcset, sizes,
// width, height, fetchpriority, and loading attributes.

add_filter('wp_get_attachment_image_attributes', function ($attr, $attachment) {
    // If width/height are already set, leave them
    if (empty($attr['width']) || empty($attr['height'])) {
        $meta = wp_get_attachment_metadata($attachment->ID);
        if ($meta) {
            $attr['width'] = $meta['width'];
            $attr['height'] = $meta['height'];
        }
    }

    // Add srcset and sizes for medium+ sizes
    $sizes = ['medium', 'medium_large', 'large', 'full'];
    $srcset = [];
    foreach ($sizes as $size) {
        $img = wp_get_attachment_image_src($attachment->ID, $size);
        if ($img) {
            $srcset[] = $img[0] . ' ' . $img[1] . 'w';
        }
    }
    if (!empty($srcset)) {
        $attr['srcset'] = implode(', ', $srcset);
        $attr['sizes'] = '(max-width: 600px) 100vw, (max-width: 1200px) 50vw, 33vw';
    }

    // Mark below-the-fold images as lazy
    if (!isset($attr['loading'])) {
        $attr['loading'] = 'lazy';
    }

    return $attr;
}, 10, 2);
```

**Verify it worked**

```bash
# After deploying, every <img> should have width, height, and srcset
curl -s https://www.mitur.gob.sv/ | grep -oE '<img[^>]*>' | head -10
# Expected: most img tags have width="..." height="..." srcset="..." loading="lazy"
```

**Risks / edge cases**

- **Theme override**: some themes use their own image markup (not `wp_get_attachment_image()`). The filter won't catch those. Audit the theme's `template-parts/` directory.
- **Performance**: adding srcset adds 1-2 KB to HTML. Negligible.
- **AVIF/format negotiation**: this filter doesn't switch formats. Use Cloudflare Polish (PR 7) for that.

**Structural vs local**

Local.

---

### PR 10 · AVIF + WebP variants for all large images

> `local-with-plugin` — configure the image optimization plugin to generate AVIF on upload.

**The fix**

The plugin was set up in PR 7 (Cloudflare Polish or a WordPress plugin). For new images, the plugin handles AVIF generation on upload. For existing images, you need to bulk-regenerate.

**Bulk regeneration with ShortPixel:**

```bash
# In wp-admin → Settings → ShortPixel → Tools
# Click "Bulk regenerate" — this processes all existing media
# Time: ~1 hour per 1000 images on a typical Hostinger plan
```

**Or via WP-CLI:**

```bash
# Install wp-cli
curl -O https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar
chmod +x wp-cli.phar
sudo mv wp-cli.phar /usr/local/bin/wp

# Run the regenerate command
wp media regenerate --yes
```

**Verify it worked**

```bash
# Check a known image
curl -sI -H 'Accept: image/avif' https://www.mitur.gob.sv/wp-content/uploads/2025/12/IMG_5308.jpeg | grep -i 'content-type\|cf-polished'
# Expected: cf-polished: avif or content-type: image/avif
```

**Risks / edge cases**

- **CPU time**: regenerating 1,000+ images takes hours. Schedule for off-peak or run via a queue.
- **Disk space**: AVIF + WebP + original = 3× the storage. Audit Hostinger's quota first.
- **Quality settings**: AVIF quality 60 is roughly equivalent to JPEG quality 80. Test a few images side-by-side before bulk processing.

**Structural vs local**

Local with optional plugin.

---

### PR 11 · JS-bundling plugin (Autoptimize or equivalent)

> `local-with-plugin` — install Autoptimize or similar; config in `wp-admin`.

**Mechanism**

60 individual script requests add ~200ms of latency (one round-trip per request, even with HTTP/2 multiplexing). Bundling into a single request cuts the latency overhead.

**The fix**

Install **Autoptimize** (free) or **Asset Cleanup Pro** (paid, more features).

In `wp-admin → Settings → Autoptimize`:

- **JavaScript Options**:
  - Optimize JavaScript Code: ✓
  - Aggregate JS files: ✓
  - Also aggregate inline JS: ✓
- **CSS Options**:
  - Optimize CSS Code: ✓
  - Aggregate CSS files: ✓
- **Extra**:
  - Google Fonts: combine & preload
  - Preconnect to third-party domains: add `fonts.gstatic.com`, `www.googletagmanager.com`

**Verify it worked**

```bash
# Re-run build-capture
just build-capture | grep -E 'script requests|stylesheets'
# Should show scripts: ~5-10 (was 59), stylesheets: ~1-3 (was 37)
```

**Risks / edge cases**

- **JS errors**: some plugins' inline scripts break when bundled. Autoptimize has an "exclude from optimization" list per script handle.
- **Critical CSS conflict**: if you also have PurgeCSS (PR 5), the two might fight. Run PR 5 last.
- **Cache busting**: Autoptimize generates versioned filenames. Cloudflare's edge cache will pick up the new versions automatically.

**Structural vs local**

Local with optional plugin.

---

### PR 12 · Concatenate / dequeue the remaining stylesheets

> `local` — extends PR 4 (block-editor styles) and PR 11 (Autoptimize).

**The fix**

Autoptimize (PR 11) handles concatenation. For the remaining standalone stylesheets (theme `style.css`, plugin custom CSS, etc.), add to Autoptimize's "exclude" list temporarily, then debug.

After Autoptimize is in place, this PR is mostly verification:

```bash
# Should show 1-3 stylesheets in <head>
curl -s https://www.mitur.gob.sv/ | grep -oE '<link[^>]*stylesheet[^>]*>' | wc -l
# Expected: 1-3 (was 37)

just build-capture | grep -E 'stylesheets|kb'
# CSS transfer should drop from 184 KB to ~30-50 KB
```

**Risks / edge cases**

- **Theme overrides**: if the theme uses inline `!important` styles in `<head>`, Autoptimize's CSS reordering may break specificity. Test in staging.

**Structural vs local**

Local.

---

### PR 13 · Upload a real favicon

> `local` — upload a file. No code.

**Mechanism**

The homepage returns `404` for `/favicon.png` (or wherever the theme looks for the favicon). Every pageview triggers a 404. Per the baseline, this wastes ~41 KB of requests per visit and generates a console error in DevTools.

**The fix**

1. Generate a 32×32 PNG favicon (and optionally a 180×180 apple-touch-icon for iOS).
2. Upload via `wp-admin → Appearance → Customize → Site Identity → Site Icon`.
3. Verify with `just audit` (no more 404 in the network log).

**Verify it worked**

```bash
# Should return 200 instead of 404
curl -sI https://www.mitur.gob.sv/favicon.ico | head -1
# Expected: HTTP/2 200

# Lighthouse no longer flags it
just audit https://www.mitur.gob.sv/ homepage | grep -i 'favicon\|404'
# Expected: no matches
```

**Risks / edge cases**

- **ICO vs PNG**: modern browsers prefer PNG; ICO is legacy. The Site Identity uploader handles both.
- **SVG favicons**: supported in modern browsers but breaks older ones. Stick with PNG.

**Structural vs local**

Local (one upload).

---

### PR 14 · Deactivate the broken-popup plugin

> `local` — one click in `wp-admin`.

**Mechanism**

`Popup Maker` is installed but its stylesheet returns 404 (`pum-site-styles?ver=...`) and its analytics endpoint returns 401. The plugin emits ~17 KB of inline JS + CSS for nothing.

**The fix**

In `wp-admin → Plugins → Installed Plugins`, find Popup Maker, click **Deactivate**, then **Delete**.

**Verify it worked**

```bash
# Re-run audit
just audit https://www.mitur.gob.sv/ homepage | grep -A 5 'errors-in-console\|network-requests'
# 0 errors in console, 0 4xx requests for the popup assets

# Or directly:
curl -sI https://www.mitur.gob.sv/wp-content/uploads/pum/pum-site-styles.css | head -1
# Expected: 404 (the asset is gone)
```

**Risks / edge cases**

- **Active popups**: if any active popup is in use, deactivating will remove it from the site. Audit the plugin's popups list first.
- **Database cleanup**: Popup Maker leaves entries in the `wp_popupmake` table after deactivation. Use the plugin's "uninstall" option to clean up.

**Structural vs local**

Local (one click).

---

### PR 15 · Cloudflare Polish + Brotli

> `local` — dashboard toggle.

**The fix**

**Part (a) — enable Brotli:**

In the Cloudflare dashboard:
1. **Speed → Optimization → Content Optimization**
2. **Brotli** = ON

**Part (b) — enable Polish (image optimization):**

1. **Speed → Optimization → Image Optimization**
2. **Polish** = `Lossy` (or `Lossless` for the strict mode)
3. **WebP** = ON (this also covers AVIF in current Cloudflare versions)

**Verify it worked**

```bash
# Should return br instead of gzip
curl -sI -H 'Accept-Encoding: br' https://www.mitur.gob.sv/ | grep -i 'content-encoding'
# Expected: content-encoding: br

# Image should be served as avif or webp
curl -sI -H 'Accept: image/avif,image/webp,*/*' https://www.mitur.gob.sv/wp-content/uploads/2025/12/IMG_5308.jpeg | grep -i 'content-type'
# Expected: content-type: image/avif or image/webp
```

**Risks / edge cases**

- **Polish and copyright**: Lossy mode strips metadata. If the site uses image EXIF for any reason (e.g. photography attribution), use Lossless.
- **Brotli on cached content**: Cloudflare's Brotli applies to the edge cache, so all visitors benefit (not just the first one).
- **Brotli on dynamic content**: Cloudflare's Brotli also applies to non-cached responses from origin, with negligible CPU cost on the visitor side.

**Structural vs local**

Local (dashboard).

---

### Phase 2 · Ship criteria

| Metric | After Phase 1 | Target | Source |
| --- | --- | --- | --- |
| Image transfer (homepage) | 0.4 MB | 0.25 MB | `just build-capture` |
| Stylesheet count | 5 | 1-3 | `curl -s ... | grep stylesheet` |
| Script request count | 15 | 1 | `just build-capture` |
| HTML size (homepage) | 120 KB | 80-100 KB | `just rendering-strategy` |
| Perf score (all 8 pages) | ≥ 50 | ≥ 60 | `just report` |
| Pages in "good" or "needs improvement" band | 6 of 8 | 8 of 8 | `just report` |

---

## Phase 3 · Weeks 4+ — Hold the line

Three PRs. Process + architecture, not specific code. Prevents regressions.

### PR 16 · Cloudflare Page Rule formalization

> `local-with-version-control` — put the Page Rule in Terraform or `wrangler` config.

**Mechanism**

The Page Rule from PR 1 lives in the Cloudflare dashboard. If the dashboard gets accidentally edited (or the team leaves), the rule is lost. Put it in version control.

**The fix**

Use Terraform with the Cloudflare provider:

```hcl
# infra/cloudflare-page-rules.tf
resource "cloudflare_page_rule" "mitur_html_cache" {
  zone_id = var.cloudflare_zone_id
  target  = "mitur.gob.sv/*"
  priority = 1

  actions {
    cache_level       = "cache_everything"
    edge_cache_ttl   = 3600
    browser_cache_ttl = 300
  }
}

resource "cloudflare_page_rule" "mitur_bypass_wp_admin" {
  zone_id = var.cloudflare_zone_id
  target  = "mitur.gob.sv/wp-admin*"
  priority = 2

  actions {
    cache_level = "bypass"
  }
}
```

Run via `terraform apply` from CI.

**Verify it worked**

After `terraform apply`, the dashboard should show the rules. Drift detection: run `terraform plan` periodically (e.g. weekly cron) and alert on any non-empty plan.

**Risks / edge cases**

- **Terraform state**: store in a remote backend (Terraform Cloud, S3 + DynamoDB lock). Don't commit state files to Git.
- **Manual edits**: if someone edits the dashboard directly, Terraform plan will show drift. Document "the dashboard is read-only; all changes via Terraform."

**Structural vs local**

Local with version control.

---

### PR 17 · Performance budget in CI

> `local-with-CI` — wire `just audit-all` into the deploy pipeline.

**Mechanism**

Without a budget, regressions in 6 months will undo Phase 1+2. With `just audit-all` in CI, every PR that drops a page below the threshold blocks the deploy.

**The fix**

In the deploy pipeline (GitHub Actions example, adapt to your CI):

```yaml
# .github/workflows/perf-budget.yml
name: Performance budget
on: [pull_request]

jobs:
  perf:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - name: Install Chromium
        run: sudo apt-get install -y chromium
      - name: Run perf budget check
        env:
          CHROME_PATH: /usr/bin/chromium
        run: |
          just audit-all 2 || true
          FAIL=0
          for f in lighthouse/*.json; do
            SCORE=$(node -e "console.log(Math.round(require('./$f').categories.performance.score * 100))")
            PAGE=$(basename $f .json)
            if [ "$SCORE" -lt 50 ]; then
              echo "::error::Page '$PAGE' has perf score $SCORE (threshold: 50)"
              FAIL=1
            fi
          done
          exit $FAIL
```

**Verify it worked**

Open a test PR that intentionally drops a page below the threshold (e.g. add `<script src="huge-library.js"></script>` to a template). The CI should fail with a clear error message.

**Risks / edge cases**

- **CI time budget**: `just audit-all` takes ~5-10 min. Use parallelism or cache results.
- **Flaky tests**: Lighthouse scores can vary ±5 between runs. Set threshold 5 points below target (e.g. target 60, threshold 50).
- **Updates to Lighthouse**: when Lighthouse CLI updates, baseline scores shift. Re-baseline annually.

**Structural vs local**

Local with CI.

---

### PR 18 · Monthly CrUX review + quarterly plugin audit

> `process` — no code.

**Mechanism**

Lab data (Lighthouse) is consistent. Field data (CrUX) catches issues lab doesn't (different device classes, geographic variance, real network conditions). Monthly review catches slow drift before it becomes a 6-month problem.

**Process**

**Monthly** (1 hour, in a standup or async):
1. Check [CrUX](https://developer.chrome.com/docs/crux/methodology) for mitur.gob.sv
2. Note: p75 LCP, p75 CLS, p75 INP (if available)
3. Compare to lab baseline
4. If p75 LCP > 4s, open a perf investigation ticket

**Quarterly** (2-3 hours, scheduled):
1. Review active plugins in `wp-admin → Plugins`. For each:
   - Is it actively used? (check query log, last update time)
   - Is it still in the WordPress plugin directory?
   - Are there alternatives?
2. Drop any plugin with <5% usage or no clear value
3. Document in `findings.md` if any were dropped

**Verify it worked**

A pattern of stable or improving p75 LCP month-over-month is the success metric.

**Risks / edge cases**

- **CrUX data lag**: CrUX has a ~28-day aggregation window. Don't react to single-day changes.
- **Plugin removal**: removing an active plugin may break content. Test in staging.
- **Resource cost**: monthly review takes 1 hour, quarterly 2-3 hours. Schedule recurring calendar events.

**Structural vs local**

Process.

---

## Cross-references

### While implementing

- `baseline.md` — raw measurements behind every PR claim
- `findings.md` — full evidence trail per finding (F-01 to F-22)
- `/tmp/mitur-build-capture.json` — bundle data (after `just build-capture`)
- `/tmp/mitur-coverage-frame-capture.json` — coverage + frame chart
- `/tmp/mitur-rendering-strategy.json` — rendering strategy per page
- `lighthouse/*.json` — raw Lighthouse output

### For context

- `prioritization.md` — PIE scoring across 19 corrective findings
- `presentation.md` — stakeholder framing (for the leadership conversation)
- `presentation-es.md` — Spanish version of the stakeholder deck

---

## Rule of thumb

**If you can't reproduce a number in this guide, the fix won't reproduce either. Run the recipe before you ship.**

---

*Spanish translation of this guide: see `implementation-es.md`.*
*Slide-deck format: `implementation.html`.*
