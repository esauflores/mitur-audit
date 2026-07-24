# MITUR Performance Audit · Stakeholder Report

*Prepared for ministry leadership, July 2026 · FE413 Web Performance*

---

## The bottom line

**Yes. Most wins ship in week one.** All of them are config changes, not code rewrites.

Tourists wait **6.6 seconds** for our homepage to render on their phones. **6 of 8 audited pages** are in Google's "poor" band. The cause is well-understood: WordPress + five active plugins ship their own JavaScript and CSS on every pageview, and the HTML is never cached at Cloudflare's edge. Both are configuration issues.

| Phase | Time | Outcome |
| --- | --- | --- |
| **Phase 1** | Week 1 (1 engineer) | 8 config + 1-line changes. 6 of 8 pages out of "poor" band. |
| **Phase 2** | Weeks 2–4 (1 engineer) | 11 structural fixes. All 8 pages reach perf > 50. |
| **Phase 3** | Weeks 4+ | CI guard, monthly CrUX review. Hold perf > 75 long-term. |

---

## What it costs the ministry

Four ways the slow page costs the ministry in tourism, citizen services, international reputation, and search ranking:

- **Tourism:** visitors give up at 6.7 s on the FAQ and search — the two pages they actually use.
- **Citizen services:** CLS 0.382 means content shifts mid-load. The pattern is worst on cellular data, which is dominant in El Salvador.
- **International reputation:** the "poor" PageSpeed score is visible to foreign press, partner organizations, and tourism operators who evaluate El Salvador's digital infrastructure.
- **Search ranking:** Google uses page speed as a mobile-first signal since 2020. The slower the page, the lower the ranking — and the lower the ministry's visibility to people searching for El Salvador tourism.

---

## What we found

**One headline number: 6 of 8 pages in the "poor" band.**

**Two decisions, made years apart, are now blocking performance:** five active plugins that each ship their own JavaScript and CSS, and the choice not to enable Cloudflare's HTML edge cache. Both are configuration decisions that can be reversed.

Three numbers that explain it:

- **1.5 MB** of JavaScript downloads but never runs on first paint.
- **94 %** of CSS bytes ship but never match.
- **0 %** HTML edge-cache hit rate (static assets: 89 %).

---

## What is already working

A failure-only report reads as hostile. The team's prior work matters.

- **Google-only 3P surface** — 4 domains (GTM, GA4, Google Fonts, gstatic). AP News has 8 vendors.
- **89 % static-asset edge cache** — CSS, JS, images, fonts served from Cloudflare's global edge in < 100 ms.
- **Cloudflare CDN is in front** — the infrastructure to ship fast HTML exists; it just needs a toggle.
- **Audit infrastructure is in place** — `just audit-all` re-runs the whole audit in 30 min.

---

## The fixes, ranked

**Eight fixes ship in week one. Total effort: 1 engineer, 1 week.**

| # | Fix | Effort |
| --- | --- | --- |
| 1 | Cache HTML at Cloudflare's edge (1-hr edge TTL, 5-min browser TTL) | 5 min · 1 Page Rule |
| 2 | Dequeue the second jQuery (theme 3.3.1, WP core has 3.7.1) | 5 min · 1 line of PHP |
| 3 | Defer the 51 sync scripts; page-gate per plugin | 2 days |
| 4 | Drop block-editor styles on public pages | 15 min · 1 line of PHP per style |
| 5 | PurgeCSS pipeline (eliminates 1.15 MB of unused CSS) | 1 day |
| 6 | Add explicit width/height to image cards | 1 day audit |
| 7 | LCP fetchpriority + AVIF variants | 1 day |
| 8 | Per-page plugin page-gating | 1 day audit |

**No backend rebuild. No business logic touched. No new vendor contracts.**

---

## The plan

### Phase 1 · Week 1 — Stop the bleed

- 1 engineer, 1 week. 8 fixes ship. 6 of 8 pages out of the "poor" band.

### Phase 2 · Weeks 2–4 — Fix the structure

- 1 engineer, 2 weeks. 11 structural fixes (CSS concatenation, image variants, srcset, JS bundling, favicon, plugin deactivation, Cloudflare Polish, Brotli).
- All 8 pages reach perf > 50.

### Phase 3 · Weeks 4+ — Hold the line

- Cloudflare Page Rule formalization
- Performance budget in CI: `just audit-all` blocks deploy if perf < 50
- Monthly CrUX review
- Quarterly plugin audit cycle

---

## Cost of inaction

If we do nothing, nothing changes.

- **6 of 8 pages stay in the red band.**
- **Search ranking** continues to drop relative to faster competitors.
- **Every new feature** inherits the 6-second main-thread bottleneck.

The fix is bounded — **2 engineering weeks**. The cost of not fixing is unbounded.

---

## The ask

**One decision unlocks all three commitments.**

1. **A named owner for the Cloudflare Page Rule.** 5 minutes. One dashboard toggle.
2. **A sign-off on the engineering time.** 1 engineer, 2 weeks. Phase 1 + Phase 2.
3. **Approval to add a perf budget in CI.** `just audit-all` blocks deploy if perf < 50.

**The decision you need to make today: do we proceed with the work?**

---

*Full audit data, methodology, and finding-level evidence: [github.com/esauflores/mitur-audit](https://github.com/esauflores/mitur-audit)*

*Spanish version: [presentation-es.md](./presentation-es.md) · Spanish slide deck: [presentation-es.html](./presentation-es.html)*
