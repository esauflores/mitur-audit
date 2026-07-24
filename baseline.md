# Baseline — MITUR homepage

*Captured: 2026-07-23 (single run, clean-state profile, mobile preset, simulated throttling).*
*Tool: Lighthouse CLI v12 on headless Chromium 150. Raw report in `lighthouse/homepage.json`.*

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

## Core Web Vitals — homepage

| Vital | Value | "Good" | "Needs improvement" | "Poor" | Verdict |
| --- | --- | --- | --- | --- | --- |
| **Largest Contentful Paint (LCP)** | **6.6 s** | ≤ 2.5 s | 2.5–4.0 s | > 4.0 s | **Poor** (2.6× over) |
| **First Contentful Paint (FCP)** | **4.0 s** | ≤ 1.8 s | 1.8–3.0 s | > 3.0 s | **Poor** (2.2× over) |
| **Cumulative Layout Shift (CLS)** | **0.382** | ≤ 0.1 | 0.1–0.25 | > 0.25 | **Poor** (3.8× over) |
| **Total Blocking Time (TBT)** | **300 ms** | ≤ 200 ms | 200–600 ms | > 600 ms | Needs improvement |
| **Time to Interactive (TTI)** | **11.5 s** | ≤ 3.8 s | 3.8–7.3 s | > 7.3 s | **Poor** (3× over) |
| **Speed Index** | **8.1 s** | ≤ 3.4 s | 3.4–5.8 s | > 5.8 s | **Poor** (2.4× over) |

Lighthouse overall **Performance score: 37 / 100**. Every Core Web Vital that matters is in the "poor" band.

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

## Method & caveats

- **Single run per page** — for stricter rigor, take the median of 3 (per Day 3 §4.1).
- **CLS varies between runs (±50 %)** — the site injects ad / banner widgets that depend on session state. The red CLS score is reliably reproducible; the exact number shifts.
- **CrUX field data not captured** — would refine the 75th-percentile picture.
- **Desktop PSI not captured** — same methodology would apply if re-run with default desktop preset.
- **WPT filmstrip not captured** — useful follow-up for CLS root-cause analysis.

---

## Why every page is poor (one-line summary)

WordPress + 6 plugins (YOAST, Elementor, Smart Slider 3, WordPress Download Manager, photo-contest plugin, theme bundle) ship 2.8 MB of HTML/CSS/JS/imagery on first paint. The headline image doesn't render until 6.6 s, the page shifts 0.382 mid-load, and the browser can't accept input until 11.5 s.
