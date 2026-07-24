# justfile — MITUR Performance Audit
# Run with: just <recipe>
# See all recipes: just --list

# Target pages (name \t url), one per line
TARGETS_FILE := "scripts/targets.tsv"

# Shared Lighthouse flags — see Day 3 §4.1 for the clean-state checklist.
# No setup needed: MITUR has no consent popup (no OneTrust / CookieConsent)
# so captures run cleanly without pre-accepting cookies. The `__cf_bm`
# cookie is Cloudflare bot management — passes through fine.
CHROME_FLAGS := "--headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage --user-data-dir=/tmp/chromium-mitur"
LH_FLAGS := "--only-categories=performance --form-factor=mobile --throttling-method=simulate --max-wait-for-load=20000"

# Show all recipes (default)
default:
    @just --list --unsorted

# Run Lighthouse on one URL. NAME defaults to a slug of the URL.
#   just audit https://www.mitur.gob.sv/ homepage
[doc("Run Lighthouse on one URL (mobile, simulated throttling)")]
audit url name="":
    #!/usr/bin/env bash
    set -euo pipefail
    url="{{ url }}"; name="{{ name }}"
    [[ -n "$name" ]] || name=$(echo "$url" | sed 's|https\?://||; s|/$||; s|/|_|g; s|[^a-zA-Z0-9._-]|-|g')
    [[ -n "$name" ]] || name="page"
    mkdir -p lighthouse/logs
    log="lighthouse/logs/${name}.log"
    printf '→ [%s] %s\n' "$name" "$url"
    npx --yes lighthouse "$url" \
        --chrome-flags="{{ CHROME_FLAGS }}" \
        {{ LH_FLAGS }} \
        --output=json --output-path="lighthouse/${name}.json" \
        >"$log" 2>&1
    if [[ ! -s "lighthouse/${name}.json" ]]; then
        printf '✗ [%s] FAILED — see %s\n' "$name" "$log" >&2
        exit 1
    fi
    abs=$(realpath "lighthouse/${name}.json")
    node -e 'const r=require(process.argv[1]);const c=r.categories.performance;const a=r.audits;const fmt=v=>v==null?"—":v;console.log("  score:",fmt(Math.round((c.score||0)*100))," LCP:",fmt(a["largest-contentful-paint"]?.displayValue)," CLS:",fmt(a["cumulative-layout-shift"]?.displayValue)," TBT:",fmt(a["total-blocking-time"]?.displayValue))' "$abs"

# Run Lighthouse on all 8 target pages.
# Parallelism: 0/all, 1=sequential, N=N at a time
[doc("Run Lighthouse on all 8 target pages (parallel=N, default 1)")]
audit-all parallel="1":
    #!/usr/bin/env bash
    set -euo pipefail
    p="{{ parallel }}"
    [[ "$p" == "0" ]] && p=99
    [[ "$p" =~ ^[0-9]+$ ]] || { echo "✗ parallel must be a number (got '$p')"; exit 1; }
    (( p >= 1 )) || { echo "✗ parallel must be >=1 (got '$p')"; exit 1; }
    echo "→ Parallelism: $p"
    while IFS=$'\t' read -r name url; do
        printf '%s\t%s\n' "$name" "$url"
    done < "{{ TARGETS_FILE }}" \
      | CHROME_FLAGS="{{ CHROME_FLAGS }}" LH_FLAGS="{{ LH_FLAGS }}" \
        xargs -d '\n' -P "$p" -I{} bash -c '
            line="$1"; name="${line%%	*}"; url="${line#*	}"
            log="lighthouse/logs/${name}.log"
            printf "→ [%s] %s\n" "$name" "$url"
            if npx --yes lighthouse "$url" --quiet \
                --chrome-flags="$CHROME_FLAGS" \
                $LH_FLAGS \
                --output=json --output-path="lighthouse/${name}.json" \
                >"$log" 2>&1 && [[ -s "lighthouse/${name}.json" ]]; then
                printf "  ✓ [%s] done\n" "$name"
            else
                printf "  ✗ [%s] FAILED — see %s\n" "$name" "$log"
            fi
        ' _ {}

# Markdown summary table of all captured scores
[doc("Markdown summary table of all captured scores")]
report:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "| Page | Perf | LCP | CLS | TBT |"
    echo "|------|------|-----|-----|-----|"
    for f in lighthouse/*.json; do
        [[ -f "$f" ]] || continue
        name=$(basename "$f" .json)
        node -e 'const r=require(process.argv[1]);const c=r.categories.performance;const a=r.audits;const fmt=v=>v==null?"—":v;console.log("| "+process.argv[2]+" | "+fmt(Math.round((c.score||0)*100))+" | "+fmt(a["largest-contentful-paint"]?.displayValue)+" | "+fmt(a["cumulative-layout-shift"]?.displayValue)+" | "+fmt(a["total-blocking-time"]?.displayValue)+" |")' "$(realpath "$f")" "$name"
    done

# Wipe generated artifacts (lighthouse JSONs + logs)
clean:
    rm -rf lighthouse/*.json lighthouse/logs/
    @echo "✓ Cleaned."

# Cold-vs-warm transfer comparison. Captures request count and
# transfer bytes in two fresh profile contexts to measure Cloudflare
# edge cache hit rate. Writes /tmp/mitur-cold-vs-warm.json.
# Output: cold-vs-warm.json is the captured data; the justfile summary
# below shows the headline numbers.
[doc("Measure cold-vs-warm transfer (Cloudflare cache effectiveness)")]
cold-vs-warm:
    @node scripts/cold-vs-warm.mjs
    @node -e 'const r=require("/tmp/mitur-cold-vs-warm.json"); console.log("Cold:", r.cold.requests, "req /", r.cold.transferKB, "KB"); console.log("Warm:", r.warm.requests, "req /", r.warm.transferKB, "KB"); console.log("Cache hit rate (cold):", r.cold.byCfCache); console.log("Cache hit rate (warm):", r.warm.byCfCache);'

# Inspect homepage build outputs: JS / CSS bundles, image formats,
# 3rd-party loading strategy, source-map exposure, and unused-JS / unused-CSS
# via puppeteer's coverage API. Writes /tmp/mitur-build-capture.json.
# MITUR has no consent popup, so no pre-click is needed.
[doc("Inspect homepage build outputs (bundles, images, 3P loading strategy)")]
build-capture:
    @node scripts/build-capture.mjs

# Capture coverage (critical CSS, unused JS/CSS) and frame-chart metrics
# (dropped frames during load / scroll / click) plus layers & animations
# (stacking contexts, will-change, transform3d) via puppeteer's coverage API
# and requestAnimationFrame deltas. Writes /tmp/mitur-coverage-frame-capture.json.
[doc("Coverage + frame chart + layers/animations (HW8 metrics)")]
coverage-frames:
    @node scripts/coverage-frame-capture.mjs

# Detect the rendering strategy used on each audited page: SSR / CSR / SSG,
# framework markers in initial HTML, edge-cache status, HTML size.
# Writes /tmp/mitur-rendering-strategy.json.
[doc("Rendering strategy detection (HW9: SSR / CSR / edge-cache per page)")]
rendering-strategy:
    @node scripts/rendering-strategy.mjs

# Render presentation.html slides → preview/ as PNGs (for sharing in chat /
# embedding in PRs). Uses headless Chromium with the same MITUR profile.
[doc("Render presentation.html slides → preview/")]
present:
    #!/usr/bin/env bash
    set -euo pipefail
    port=9556
    pkill -9 -f "remote-debugging-port=$port" 2>/dev/null || true
    sleep 0.5
    rm -rf preview && mkdir -p preview
    /usr/lib/chromium/chromium \
        --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage \
        --user-data-dir=/tmp/chromium-mitur \
        --remote-debugging-port=$port \
        --window-size=1280,720 about:blank >/dev/null 2>&1 &
    sleep 2
    node -e '
      import("puppeteer-core").then(async ({default: puppeteer}) => {
        const browser = await puppeteer.connect({browserURL:"http://127.0.0.1:'"$port"'"});
        const pages = await browser.pages();
        const page = pages[0];
        await page.setViewport({width:1280,height:720});
        await page.goto("file://'"$(pwd)"'/presentation.html",{waitUntil:"networkidle2",timeout:30000});
        await new Promise(r=>setTimeout(r,2500));
        const total = await page.evaluate(() => Reveal.getTotalSlides());
        for (let i=0;i<total;i++) {
          await page.evaluate(n => Reveal.slide(n), i);
          await new Promise(r=>setTimeout(r,1500));
          await page.screenshot({path:"preview/slide-"+String(i+1).padStart(2,"0")+".png"});
        }
        await browser.disconnect();
      });'
    pkill -9 -f "remote-debugging-port=$port" 2>/dev/null || true
    @ls preview/

# Render the Spanish presentation-es.html slides → preview-es/ as PNGs.
# Same workflow as `present`, separate output directory so both decks
# can be rendered without overwriting each other.
[doc("Render presentation-es.html slides → preview-es/ (Spanish deck)")]
present-es:
    #!/usr/bin/env bash
    set -euo pipefail
    port=9557
    pkill -9 -f "remote-debugging-port=$port" 2>/dev/null || true
    sleep 0.5
    rm -rf preview-es && mkdir -p preview-es
    /usr/lib/chromium/chromium \
        --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage \
        --user-data-dir=/tmp/chromium-mitur \
        --remote-debugging-port=$port \
        --window-size=1280,720 about:blank >/dev/null 2>&1 &
    sleep 2
    node -e '
      import("puppeteer-core").then(async ({default: puppeteer}) => {
        const browser = await puppeteer.connect({browserURL:"http://127.0.0.1:'"$port"'"});
        const pages = await browser.pages();
        const page = pages[0];
        await page.setViewport({width:1280,height:720});
        await page.goto("file://'"$(pwd)"'/presentation-es.html",{waitUntil:"networkidle2",timeout:30000});
        await new Promise(r=>setTimeout(r,2500));
        const total = await page.evaluate(() => Reveal.getTotalSlides());
        for (let i=0;i<total;i++) {
          await page.evaluate(n => Reveal.slide(n), i);
          await new Promise(r=>setTimeout(r,1500));
          await page.screenshot({path:"preview-es/slide-"+String(i+1).padStart(2,"0")+".png"});
        }
        await browser.disconnect();
      });'
    pkill -9 -f "remote-debugging-port=$port" 2>/dev/null || true
    @ls preview-es/

# Render implementation.html slides → preview-impl/ as PNGs.
# Mirrors the present recipe. Uses port 9558 to avoid collisions.
[doc("Render implementation.html slides → preview-impl/ (English)")]
present-impl:
    #!/usr/bin/env bash
    set -euo pipefail
    port=9558
    pkill -9 -f "remote-debugging-port=$port" 2>/dev/null || true
    sleep 0.5
    rm -rf preview-impl && mkdir -p preview-impl
    /usr/lib/chromium/chromium \
        --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage \
        --user-data-dir=/tmp/chromium-mitur \
        --remote-debugging-port=$port \
        --window-size=1280,720 about:blank >/dev/null 2>&1 &
    sleep 2
    node -e '
      import("puppeteer-core").then(async ({default: puppeteer}) => {
        const browser = await puppeteer.connect({browserURL:"http://127.0.0.1:'"$port"'"});
        const pages = await browser.pages();
        const page = pages[0];
        await page.setViewport({width:1280,height:720});
        await page.goto("file://'"$(pwd)"'/implementation.html",{waitUntil:"networkidle2",timeout:30000});
        await new Promise(r=>setTimeout(r,2500));
        const total = await page.evaluate(() => Reveal.getTotalSlides());
        for (let i=0;i<total;i++) {
          await page.evaluate(n => Reveal.slide(n), i);
          await new Promise(r=>setTimeout(r,1500));
          await page.screenshot({path:"preview-impl/slide-"+String(i+1).padStart(2,"0")+".png"});
        }
        await browser.disconnect();
      });'
    pkill -9 -f "remote-debugging-port=$port" 2>/dev/null || true
    @ls preview-impl/

# Render implementation-es.html slides → preview-impl-es/ as PNGs.
# Mirrors the present-es recipe. Uses port 9559.
[doc("Render implementation-es.html slides → preview-impl-es/ (Spanish)")]
present-impl-es:
    #!/usr/bin/env bash
    set -euo pipefail
    port=9559
    pkill -9 -f "remote-debugging-port=$port" 2>/dev/null || true
    sleep 0.5
    rm -rf preview-impl-es && mkdir -p preview-impl-es
    /usr/lib/chromium/chromium \
        --headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage \
        --user-data-dir=/tmp/chromium-mitur \
        --remote-debugging-port=$port \
        --window-size=1280,720 about:blank >/dev/null 2>&1 &
    sleep 2
    node -e '
      import("puppeteer-core").then(async ({default: puppeteer}) => {
        const browser = await puppeteer.connect({browserURL:"http://127.0.0.1:'"$port"'"});
        const pages = await browser.pages();
        const page = pages[0];
        await page.setViewport({width:1280,height:720});
        await page.goto("file://'"$(pwd)"'/implementation-es.html",{waitUntil:"networkidle2",timeout:30000});
        await new Promise(r=>setTimeout(r,2500));
        const total = await page.evaluate(() => Reveal.getTotalSlides());
        for (let i=0;i<total;i++) {
          await page.evaluate(n => Reveal.slide(n), i);
          await new Promise(r=>setTimeout(r,1500));
          await page.screenshot({path:"preview-impl-es/slide-"+String(i+1).padStart(2,"0")+".png"});
        }
        await browser.disconnect();
      });'
    pkill -9 -f "remote-debugging-port=$port" 2>/dev/null || true
    @ls preview-impl-es/
