# MITUR Performance Audit — Personal Project

**Course:** FE413 — Web Performance
**Project type:** Personal Project (independent site audit)
**Audit target:** [Ministerio de Turismo de El Salvador](https://www.mitur.gob.sv/) (MITUR)
**Status:** HW3 complete — Network Activity section added to baseline.md (142 req / 2.88 MB cold, 51.4% compression, 0 Brotli on HTML, favicon 404, 2×404 + 1×401 errors, 0 third-party). findings.md now has 10 findings total (5 from HW2 + 5 new networking findings).

---

## The site

**Name:** Ministerio de Turismo de El Salvador (Ministry of Tourism of El Salvador)
**URL:** [https://www.mitur.gob.sv/](https://www.mitur.gob.sv/)

## Why this is a good candidate for an audit

MITUR is a strong audit target for several reasons:

- **Non-tech organization with public-facing web presence.** The brief explicitly calls out "non-tech companies" as a good source for performance audits — government ministries are the canonical example. Their web team optimizes for content delivery, not performance.
- **Wide variety of content** — WordPress + YOAST SEO + WordPress Download Manager + custom post types (events, programs, photo contests). The site mixes static pages (FAQ, institutional info), dynamic listings (news, downloads), interactive features (search, accordion FAQs, photo contest voting), and image-heavy content (news articles with photos, contest gallery).
- **High-traffic, public-sector reach** — tourism ministry sites see seasonal traffic spikes (holidays, events, news announcements). Slow performance during peak events affects real-world outcomes.
- **Image-heavy, multilingual candidate** — tourism promotion is image-first. The site carries many large hero images, gallery photos, and document downloads.
- **Mixed CMS strategy** — WordPress with multiple plugins and shortcodes creates natural opportunities for render-blocking assets, late-injecting widgets, and unused CSS/JS — exactly the audit dimensions the course covers.
- **Publicly accessible, no auth required for primary pages** — easy to capture PageSpeed Insights, Lighthouse, and CrUX data without coordination.
- **Different from the Course Project site** — Course Project audits apnews.com (English, news-heavy, US traffic). MITUR (Spanish, tourism, Latin American traffic) gives a different perspective: government CMS patterns, slower network conditions for the audience, and a different content-publishing cadence.

## PageSpeed Insights scores (mobile)

*Captured 2026-07-23, Lighthouse CLI v12, mobile preset, simulated throttling (Slow 4G + 4× CPU), headless Chromium. Single run per page — for stricter rigor, take the median of 3.*

_Note: CLS values vary significantly between runs (±50% or more) because the site injects ads/banners and lazy-loaded widgets that depend on session state. The red CLS scores below are reliably reproducible across runs._

| # | Page | Perf | FCP | LCP | TBT | CLS | Speed Index | TTI |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | Homepage | **37** | 4.0 s | 6.6 s | 300 ms | **0.382** | 8.1 s | 11.5 s |
| 2 | News listing (`/category/noticias/`) | 66 | 3.8 s | 4.6 s | 330 ms | 0.002 | 4.5 s | 8.4 s |
| 3 | News article (image-heavy) | **43** | 3.8 s | 4.9 s | 230 ms | **1.855** | 4.6 s | 8.5 s |
| 4 | Photo contest (`/contest/`) | **45** | 3.8 s | 6.3 s | 220 ms | **0.359** | 4.6 s | 7.8 s |
| 5 | Downloads (`/descargas/`) | 64 | 4.0 s | 5.0 s | 260 ms | 0.002 | 5.9 s | 7.8 s |
| 6 | FAQ (`/preguntas-frecuentes/`) | **45** | 3.8 s | 4.7 s | 220 ms | **0.928** | 4.3 s | 8.5 s |
| 7 | Search results (`/?s=turismo`) | **34** | 3.7 s | 6.7 s | 240 ms | **2.236** | 6.4 s | 10.9 s |
| 8 | Access to public information (`/acceso-a-la-informacion-publica/`) | **36** | 3.7 s | 6.5 s | 280 ms | **1.855** | 4.7 s | 7.4 s |

**Threshold check** (mobile, per Lighthouse bands):

| Vital | "Good" | "Needs improvement" | "Poor" | Pages in poor band |
| --- | --- | --- | --- | --- |
| Perf score | ≥ 90 | 50–89 | < 50 | 6 of 8 (homepage, contest, article, FAQ, search, acceso-informacion) |
| LCP | ≤ 2.5 s | 2.5–4.0 s | > 4.0 s | 8 of 8 |
| CLS | ≤ 0.1 | 0.1–0.25 | > 0.25 | 6 of 8 (homepage, contest, article, FAQ, search, acceso-informacion) |
| TBT | ≤ 200 ms | 200–600 ms | > 600 ms | 0 of 8 |

**At least one page scores in the red band on every metric that matters.** The search page is the worst overall (perf 34, CLS 2.236) — meaningful because search is interactive and users expect results fast.

_Statistics page excluded from "data-heavy" classification — it's a single manually-updated image (`estadisticas-abril.jpeg`), not live data. Captured separately for completeness; replaced in the 8-page audit by the photo contest (`/contest/`) which actually has dynamic interactive content._

**CrUX field data (origin level, last 28 days):** not captured in this run — will be added in a later HW.
**Methodology, per-page Lighthouse JSON, and full per-audit breakdown** — see `lighthouse/*.json`.

## Target pages

The audit focuses on **8 pages** chosen to cover the breadth of content types MITUR serves.

### 1. Homepage — [https://www.mitur.gob.sv/](https://www.mitur.gob.sv/)
The highest-traffic entry point. **Why include:** dynamic carousel/hero, news preview, navigation, and language switcher all compete for above-the-fold attention. The homepage sets the first impression for every visitor and reflects the worst CLS of any audited page after search. Tests the rendering strategy for the most-shared link.

### 2. News listing — [https://www.mitur.gob.sv/category/noticias/](https://www.mitur.gob.sv/category/noticias/)
Dynamic WordPress category archive. **Why include:** tests the archive / pagination pattern that news sites use heavily. Shows how well WordPress + YOAST SEO render repeated listings and whether the site lazy-loads off-screen posts.

### 3. News article (image-heavy) — [https://www.mitur.gob.sv/el-salvador-sera-sede-del-dia-mundial-del-turismo-2026/](https://www.mitur.gob.sv/el-salvador-sera-sede-del-dia-mundial-del-turismo-2026/)
A single news post. **Why include:** tourism articles are image-first (hero photo, in-body gallery, captions). Tests the typical reading experience — does the article render the lead photo before scripts block, do related-post widgets inject late and shift layout, does the share bar add CLS?

### 4. Photo contest (`/contest/`) — [https://www.mitur.gob.sv/contest/](https://www.mitur.gob.sv/contest/)
Live tourism photo contest / voting feature. **Why include:** tests the only truly dynamic, interactive feature on the site — the gallery loads fresh content, voting triggers a form submission, and the layout shifts as more entries load. Real perf impact on a feature that visitors actually interact with. Also the *new* red page in the audit (perf 45) — was not in the original 8.

### 5. Downloads — [https://www.mitur.gob.sv/descargas/](https://www.mitur.gob.sv/descargas/)
WordPress Download Manager listing. **Why include:** tests a dynamic plugin (WPDM) that loads file metadata, sizes, and download buttons. Tests how third-party plugin code integrates with the site's main bundle.

### 6. FAQ — [https://www.mitur.gob.sv/preguntas-frecuentes/](https://www.mitur.gob.sv/preguntas-frecuentes/)
Static content with accordion-style interactions. **Why include:** tests the most common "static" page type. The accordion interaction likely uses JavaScript that may or may not be deferred — a quick check on whether interactivity comes at a perf cost.

### 7. Search results — [https://www.mitur.gob.sv/?s=turismo](https://www.mitur.gob.sv/?s=turismo)
WordPress native search results. **Why include:** the **worst-scoring page** in the audit (perf 34, CLS 2.236). Search is interactive — the page changes every time, has different layouts per query, and renders dynamic results in the URL. Tests the interactive content requirement from the brief.

### 8. Access to public information — [https://www.mitur.gob.sv/acceso-a-la-informacion-publica/](https://www.mitur.gob.sv/acceso-a-la-informacion-publica/)
Legal/institutional page (transparency portal). **Why include:** tests static legal content and the largest CLS of any institutional page (1.855). Also tests the `datos-estadisticos-de-turismo` cluster — adjacent pages share template overhead.

## Content-type coverage (per the HW brief)

The brief asks for: *static, dynamic, interactive, in-page loaders, authentication, etc.*

| Content type | Covered by |
| --- | --- |
| **Static** | FAQ (`/preguntas-frecuentes/`), access to public information (`/acceso-a-la-informacion-publica/`), statistics (`/datos-estadisticos-de-turismo/` — single image, manually updated) |
| **Dynamic listing** | News listing (`/category/noticias/`), downloads (`/descargas/`) |
| **Image-heavy single article** | News article (image-heavy) (`/el-salvador-sera-sede-del-dia-mundial-del-turismo-2026/`) |
| **Live interactive feature** | Photo contest (`/contest/` — gallery + voting) |
| **Interactive / search** | Search results (`/?s=turismo`) |
| **Hero / carousel** | Homepage (`/`) |
| **In-page loaders** (lazy-load, dynamic widgets) | Homepage (CLS evidence), search (CLS 2.236), contest (CLS 0.359), FAQ (accordion) |
| **Authentication** | Not applicable — site does not require login for primary content. The WordPress Download Manager may have a download-token flow, but it is not user-visible from the homepage. |

**At least one page scores in the red band** — yes, 6 of 8 pages score < 50 on performance; 6 of 8 score > 0.25 on CLS. The search page is the worst-scoring at perf 34.

---

## What's in this repo

- `README.md` — this file (HW1 deliverable)
- `baseline.md` — CWV + PSI for the homepage (HW2 deliverable)
- `findings.md` — 10 findings from the homepage baseline (5 from HW2, 5 from HW3 networking)
- `justfile` — automation: `just audit URL NAME` · `just audit-all` · `just report` · `just clean`
- `scripts/targets.tsv` — the 8 audited pages (name, url per line)
- `lighthouse/*.json` — raw Lighthouse reports for the 8 audited pages

## Methodology references

- PageSpeed Insights scores: per Day 3 clean-state checklist
- CrUX field data: per Day 14 auditor's seat (not captured this run)
- Rendering strategy fingerprint: per Day 12 §5
- Building pipeline / bundle: per Day 7
- Prioritization (RICE): per Day 5

---

**Course:** FE413 — Web Performance · **Instructor:** Christopher J Baker
