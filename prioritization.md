# Prioritization

This file documents a prioritization system applied to all current corrective findings, plus a ranked order. The system is **PIE** (Potential × Importance × Ease), different from the course project's RICE/ICE/WSJF and from the instructor's RICE. Score range 1-1000.

## Why PIE (not RICE / ICE / WSJF)

| System | Used by | Why not here |
| --- | --- | --- |
| **RICE** (Reach × Impact × Confidence ÷ Effort) | Instructor + course project (primary) | Reach is a *forward-projection* metric — for a single-page audit, there's no rollout to project. The "reach" is the same for every homepage finding. |
| **ICE** (Impact × Confidence × Ease) | Course project (secondary) | Already used; brief asks for a *different* system. |
| **WSJF** (Cost of Delay ÷ Job Size) | Course project (tertiary, added in HW6) | WSJF assumes time-sensitive value decay, which doesn't apply to a static-site audit. |
| **PIE** (Potential × Importance × Ease) | **This audit** | Distinct dimensions: Potential is forward-looking (max improvement possible), Importance is user-experience severity, Ease is shipping cost. No denominator, no Reach — appropriate for a single-page audit where every fix has the same audience. |

## PIE system documentation

- **P (Potential)** — 1–10. How much *measurable* improvement is possible if this is fixed? Quantified against the homepage baseline. Example: a 1.7 MB image transfer with no modern format has Potential = 8 (50 % savings → ~0.85 MB; concrete and large). A favicon 404 has Potential = 9 (one-file fix, no more errors). A 41-byte favicon 404 has Potential = 9 (fixed = zero impact).
- **I (Importance)** — 1–10. How much does this affect the *user*? Subjective but anchored to CWV impact: hitting a "poor" band gets +2; mobile amplification gets +2; revenue risk (donate, search) gets +2. Example: CLS 0.382 gets Importance = 8 (mobile tap accuracy risk). 1 favicon 404 gets Importance = 3 (no user-visible impact).
- **E (Ease)** — 1–10. How easy is it to ship? 10 = trivial config change, 1 = multi-quarter refactor. Example: dequeue a script (1 PR, 1 line) = 9. Concatenating CSS via plugin = 4. Critical-CSS extraction pipeline = 4.
- **Score = P × I × E** (range 1–1000). Multiplicative, not additive. A finding needs all three to score well — high Potential alone doesn't matter if the fix is hard, and high Importance alone doesn't matter if the fix is trivial (because the gain is small).

### Why PIE suits a single-page audit

RICE and WSJF were designed for *roadmap* prioritization across many features. PIE was designed for *CRO / experiment* prioritization, where the unit of work is a single change to a single page. That maps cleanly to a single-page performance audit: each finding is one fix to one page, and the prioritization is about *which fix to ship first*. Reach is degenerate (every fix hits the same homepage audience), and Cost-of-Decay is irrelevant (the page doesn't get worse over time — it just stays slow).

## 14 corrective findings, PIE-scored

Sorted by score, descending. **Good findings (F-10, F-11, F-13) are not PIE-scored** — they document what's already working; there's nothing to ship.

| # | Finding | Potential (P) | Importance (I) | Ease (E) | **Score (P×I×E)** | Phase |
| ---: | --- | ---: | ---: | ---: | ---: | --- |
| 1 | **F-12** — TBT 300 ms × 4 = ~1.2 s on a real mid-tier Android (4× CPU amplification) | 9 | 8 | 7 | **504** | Phase 1 |
| 1 | **F-01** — Homepage CLS 0.382 (3.8× the "good" threshold) | 9 | 8 | 7 | **504** | Phase 1 |
| 3 | **F-02** — LCP 6.6 s (2.6× the "good" threshold) | 10 | 9 | 5 | **450** | Phase 1 |
| 4 | **F-03** — Two jQuery versions (~820 ms redundant script-eval) | 7 | 7 | 9 | **441** | Phase 1 |
| 5 | **F-14** — 51 sync external scripts in `<head>`, including plugins that don't apply to the homepage | 9 | 9 | 5 | **405** | Phase 1 |
| 6 | **F-15** — 37 stylesheets / 1.15 MB unused CSS, 99.6% of block-editor CSS ships on the public side | 8 | 7 | 7 | **392** | Phase 1 |
| 7 | **F-07** — HTML page sent uncompressed (50 KB on wire, ~25 KB with br) | 8 | 6 | 8 | **384** | Phase 1 |
| 8 | **F-04** — 1.7 MB of image transfer, no modern format | 8 | 7 | 6 | **336** | Phase 2 |
| 9 | **F-16** — 0 of 35 images have `srcset`/`sizes`/`fetchpriority`/`width`/`height` (despite 1.7 MB loading) | 9 | 8 | 4 | **288** | Phase 2 |
| 10 | **F-08** — 60 script requests (660 KB) — plugins each ship their own bundle | 8 | 7 | 5 | **280** | Phase 2 |
| 11 | **F-06** — Favicon is missing (404, 41 KB wasted per visit) | 9 | 3 | 10 | **270** | Phase 2 |
| 12 | **F-17** — AVIF not served despite HTTPS + Cloudflare being capable (~25% additional savings possible) | 7 | 6 | 6 | **252** | Phase 2 |
| 13 | **F-05** — 33 stylesheets + 41 `<link>` round-trips | 6 | 6 | 4 | **144** | Phase 2 |
| 14 | **F-09** — 2×404 + 1×401 broken-plugin errors | 7 | 2 | 8 | **112** | Phase 2 |

### Per-finding scoring rationale (selected)

- **F-12 (504)**: P=9 (1.2 s on mobile), I=8 (mobile amplification is the user's actual experience), E=7 (solved by fixing F-03 + F-14 — same fixes, biggest user-visible win is on mobile). The high E reflects "1 PR but 2 different findings depend on it."
- **F-01 (504)**: P=9 (CLS 0.382 → ≤ 0.1 is a "good → good" transition; images with explicit dimensions fix most of it), I=8 (mobile taps land wrong; revenue impact on donate; brand), E=7 (add width/height to existing `<img>` tags — CSS-only).
- **F-02 (450)**: P=10 (LCP 6.6 s → 2.5 s is the single biggest page-speed win), I=9 (LCP is Google's CWV ranking signal), E=5 (AVIF variants + `<link rel="preload">` + `fetchpriority` + smaller viewport-fit variant = 1-2 weeks of work).
- **F-03 (441)**: P=7 (820 ms CPU win, no CWV directly), I=7 (TTI 11.5 s "poor"; mobile amplifies), E=9 (one `wp_dequeue_script` line).
- **F-14 (405)**: P=9 (51 sync scripts → ≤ 15 saves ~400 KB blocking and 0.5-1.0 s FCP), I=9 (every visitor on every page pays the cost), E=5 (page-gate enqueue + footer-load = 1-2 weeks of plugin-by-plugin audit). E is the only dimension holding this back from top.
- **F-15 (392)**: P=8 (1.15 MB unused CSS → 30 KB PurgeCSS output is a real win), I=7 (Lighthouse flags it as a 0-score), E=7 (`wp_dequeue_style` for the easy ones + 1 PR for PurgeCSS).
- **F-16 (288)**: P=9 (1.7 MB → 0.6 MB on the image bucket alone), I=8 (image is the LCP candidate), E=4 (theme's image-rendering helper needs a filter — touches every image template).
- **F-09 (112)**: P=7 (3 broken resources → 0 broken resources is a clean diff), I=2 (only 1 KB of transfer waste; no user-visible impact), E=8 (deactivate plugin).

## Phase plan (PIE-ranked)

### Phase 1 (week 1) — score ≥ 384, top cluster

Seven findings cluster in the upper end of the table. They share a common property: P ≥ 7 AND I ≥ 5 AND E ≥ 5 (a balanced high-scoring profile — all three dimensions need to be ≥ 5 to break 384 with PIE). Ship all seven in one week:

1. **F-12** (504) — fix the underlying F-03 + F-14, but report as "mobile TBT" for stakeholder visibility
2. **F-01** (504) — add `width`/`height` to image cards, fix the dynamic back-button injection
3. **F-02** (450) — AVIF + preload + `fetchpriority` for the LCP image
4. **F-03** (441) — dequeue theme jQuery
5. **F-14** (405) — page-gate + footer-load all non-critical scripts
6. **F-15** (392) — `wp_dequeue_style('wp-block-library')` + drop unused Bootstrap CSS
7. **F-07** (384) — enable Cloudflare Brotli for HTML

**Phase 1 outcome:** CLS 0.382 → ≤ 0.1, LCP 6.6 s → 2.5–3.5 s, TBT 300 ms → 150–200 ms (Lighthouse) / 600–800 ms (real mid-tier Android), favicon 404 → 200, HTML 50 KB → ~25 KB, blocking scripts 51 → ≤ 15, blocking CSS 37 → ≤ 5, image transfer 1.7 MB → 0.4 MB. Estimated impact: 4 of 5 CWV move from "poor" to "needs improvement" or better.

### Phase 2 (weeks 2–4) — score 112–336, mid quartile

- **F-04** (336) — install image-optimization plugin, generate AVIF + WebP variants
- **F-16** (288) — add theme filter to inject `srcset`/`sizes`/`width`/`height`/`fetchpriority` on every `<img>`
- **F-08** (280) — install JS-bundling plugin (Autoptimize or similar)
- **F-06** (270) — upload a real favicon
- **F-17** (252) — enable Cloudflare Polish + AVIF, or add `<picture>` markup
- **F-05** (144) — concatenate CSS into a single bundle (or run PurgeCSS)
- **F-09** (112) — deactivate Popup Maker plugin (eliminates 2×404 + 1×401)

**Phase 2 outcome:** image transfer 1.7 MB → 0.4 MB (with F-16), script requests 60 → 1, stylesheet round-trips 41 → 1, broken-plugin errors 3 → 0, AVIF served for all large images.

### Why F-09 ranks last (112) despite being easy

F-09 is a real bug, but the user impact is negligible (1 KB of transfer waste, no visible behavior). PIE correctly down-ranks it — high Potential (clean diff) × low Importance (no user pain) × high Ease (deactivate plugin) = middling score. The right call: ship it last, not first.

## Sensitivity: what would change the ranking?

PIE is stable in the top cluster. Below the median, scores cluster and a one-point shift in any dimension moves findings around. Specifically:

- F-01 ↔ F-12 (both 504): could swap if you rate mobile-amplification (I) higher for F-12 or tap-accuracy (I) higher for F-01. Either ordering is defensible.
- F-05 (144) vs F-09 (112): could swap if you weight "consistency with broader optimization" higher for F-05. Not material.
- F-06 (270) vs F-04 (336) vs F-08 (280): all 3 cluster in the 270-336 range, and 1-point shifts in any dimension could move them around. F-04 should ship before F-06 because the image transfer is the larger absolute saving (1.7 MB → 0.85 MB vs 0.04 KB), but PIE only differs by 66 points.
- F-14 (405) vs F-15 (392): near-tied. F-14 wins on Importance (51 sync scripts touch every visitor on every page) but F-15 wins on Ease (one-liner for the easy parts). Either ordering is defensible.

This is the value of PIE over RICE for a single-page audit: the multiplicative formula makes trivial-impact findings like F-06 (favicon 404) drop below the top cluster because of low Importance, even though Ease is 10.

## Comparison to the course project (AP News)

The AP News audit used RICE + ICE + WSJF triangulation. PIE for MITUR reaches substantially the same Phase 1 conclusions:

| MITUR PIE top cluster (PIE ≥ 384) | AP News consensus top tier (RICE / ICE / WSJF) | Overlap |
| --- | --- | --- |
| F-12 TBT on mobile | TBT defer scripts (RICE 100) | Same root cause, mobile framing |
| F-01 CLS on cards | Donate CLS reserve (RICE 40) | Different mechanism, same family |
| F-02 LCP image preload | LCP image pipeline (RICE 33) | Same recommendation |
| F-03 Two jQuery | — (AP News had no equivalent) | MITUR-specific |
| F-14 / F-15 Plugin-bundling / unused CSS | First-party bundle ships page-type-specific code (RICE 80) | Same family: stop shipping code nobody uses |
| F-07 HTML uncompressed | — (AP News uses br) | MITUR-specific gap |

## Good findings (not PIE-scored)

These are documented in `findings.md` and flagged as already-working. No shipping work needed.

- **F-10** — Cloudflare edge cache works for first-time visitors (0 % warm-refresh savings because the cache is global)
- **F-11** — Third-party surface is Google-only (4 domains: GTM, GA4, Google Fonts, gstatic) — no ad networks, no social widgets, no CMP, no video embeds
- **F-13** — Viewport meta correctly configured for mobile (with apple-touch-icon)
