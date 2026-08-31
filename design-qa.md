# Landlord Home Dashboard Design QA

## Source and implementation

- Source visual truth: `docs/superpowers/specs/assets/2026-08-31-landlord-home-dashboard-selected.png`
- Source pixels: 852 x 1846 RGB PNG
- Normalized source used for comparison: `docs/superpowers/qa-artifacts/2026-08-31-landlord-home-dashboard-source-390x844.png`
- Implementation screenshot: `docs/superpowers/qa-artifacts/2026-08-31-landlord-home-dashboard-implementation.png`
- Implementation pixels: 390 x 844 JPEG
- CSS viewport: 390 x 844; device scale factor: 1x for the browser capture
- Density normalization: source was downsampled to 390 x 844 before comparison; no device frame or browser chrome was included
- State: `landlord-home.html?test=1`, read-only controlled fixture with 12 months of aggregate data, occupancy 87.5%, and expiry buckets 2／4／6; no write action or Production deployment

## Evidence

The source and normalized implementation were opened together at the same 390 x 844 viewport. The implementation preserves the approved information hierarchy: greeting and refresh action, monthly KPI strip, 12-month trend chart, operations summary, and fixed bottom navigation.

The implementation rendered the three semantic series with the approved colors: receivable `#2F6FED`, collected `#06C755`, and outstanding `#FF6259`. The chart legend, readable values, and aria labels are present together, so meaning is not conveyed by color alone. The 30／60／90-day chart rendered values 2／4／6 and the occupancy chart rendered 88% in the controlled fixture.

Focused checks covered the KPI row, chart legend and value fallback, and the operations chart region. After the final spacing pass, the occupancy and expiry SVGs ended at y=765 while the fixed bottom navigation began at y=779, leaving a 14px visual separation and keeping the labels visible.

Primary interaction tested: clicking `重新整理` completed a second bootstrap/report read and retained the trend chart, expiry chart, and `查看收入明細` link. Fresh-tab browser logs contained no console errors or warnings.

## Comparison history

### Iteration 1 — data correctness

- Finding: [P1] the first implementation displayed all expiry bars as zero even though the fixture returned 2／4／6.
- Cause: the already normalized `key` records were passed into a converter that only read the raw `bucket` field.
- Fix: pass the raw report expiry rows to the SVG renderer, and add Phase 193 assertions for the three values.
- Post-fix evidence: the browser DOM and screenshot showed `30 天 2 份`, `60 天 4 份`, and `90 天 6 份`.

### Iteration 2 — KPI readability

- Finding: [P1] at 390px, the four KPI amounts were truncated to ellipses.
- Fix: reduce only the narrow-screen KPI horizontal padding and value size while retaining full exact amounts and aria labels.
- Post-fix evidence: `NT$ 287,500`, `NT$ 264,000`, `NT$ 23,500`, and `91.8%` were fully visible in the implementation screenshot.

### Iteration 3 — persistent navigation clearance

- Finding: [P2] the operations cards were too tall and their chart bottoms were covered by the fixed navigation.
- Fix: compact the line-chart viewBox height and set the occupancy／expiry SVGs to a 100px visual height.
- Post-fix evidence: the chart bottoms were y=765 and the navigation top was y=779; both operation charts and labels were visible above the navigation.

## Required fidelity surfaces

- Fonts and typography: existing CMWebs system font stack is retained; greeting, KPI labels, chart labels, and navigation use distinct readable weights and sizes. The implementation intentionally uses compact chart labels for the 390px viewport.
- Spacing and layout rhythm: white cards on the existing pale-gray shell, consistent 14px section rhythm, compact KPI grid, and safe-area-aware fixed navigation are preserved. No persistent control is hidden by content.
- Colors and visual tokens: approved green, blue, and coral semantic colors are used for KPI values, chart series, legend, and expiry bars; no purple or gradient is used in the rendered dashboard surface.
- Image quality and asset fidelity: the selected mock is a UI reference with no required raster product imagery, logo artwork, or illustration asset. Charts are data-driven SVGs, not replacements for a source image asset.
- Copy and content: required labels `應收`, `已收`, `未收`, `收款率`, `近 12 個月收租趨勢`, `入住率`, `合約到期`, `30 天`, `60 天`, `90 天`, and `查看收入明細` are present.

## Open questions and limitations

- The live Apps Script endpoint did not return within the local 15-second read-only probe, so live serving-version, real Workspace data, LIFF WebView, and Production UAT remain unverified. The screenshot evidence uses a local read-only fixture solely to verify the rendered implementation.
- The approved mock includes a trend tooltip and selector affordances. The V2.1 spec keeps the homepage fixed to `range=12m`; full filtering and CSV remain on the existing income detail page. These are intentional P3 differences, not acceptance blockers.

## Implementation checklist

- [x] KPI and chart data contracts have focused tests.
- [x] Chart colors, labels, numeric fallback, and fixed expiry buckets have focused tests.
- [x] JSONP timeout retry and immediate script-error cleanup have focused tests.
- [x] Bootstrap renders before the deferred report request; stale refresh responses are token-guarded.
- [x] `npm run validate`, Phase 193, Phase 150–153, Phase 164, and `git diff --check` pass locally.
- [x] No Apps Script deployment, GitHub Pages publication, schema migration, LINE push, or Production write was performed.

final result: passed
