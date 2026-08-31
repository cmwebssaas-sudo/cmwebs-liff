# CMWebs V2.1 房東首頁圖表與載入韌性 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在既有房東首頁整合核准的收入圖表與合約到期柱狀圖，並讓首頁與圖表在 API 逾時時可漸進載入、局部失敗及唯讀自動重試。

**Architecture:** 保留既有 `landlord_home_bootstrap` 作為首頁核心資料來源；LINE 身分完成後即與 bootstrap 並行呼叫既有 `landlord_revenue_dashboard_init`，取得 12 個月、入住率與合約到期聚合資料。前端將 JSONP 拆成單次請求與唯讀重試 wrapper；逾時最多重試一次，報表錯誤只替換圖表區，首頁核心不清空。

**Tech Stack:** 原生 HTML／CSS／JavaScript、Apps Script JSONP、既有內嵌 SVG data charts、Node.js `node:assert/strict` source/runtime tests、既有 `npm run validate`。

**Spec:** `docs/superpowers/specs/2026-08-31-landlord-home-dashboard-performance-design.md`

## Global Constraints

- 正式 repository 禁止新增 `*_FIXED.*`、`*_WITH_SETTINGS.*`、`*_WITH_TEAM_NOTIFICATIONS.*`、`*-fixed.*`、`complete-*.*`、`final-*.*`、`new-*.*` 檔名。
- 固定 shell 必須保留 `html, body { height:100%; overflow:hidden; }`、`.app-shell { position:relative; height:var(--app-height); overflow:hidden; }`、`.page` 滾動、`.bottom-nav` 絕對定位與 safe-area 預留。
- 所有資料仍須 Workspace-scoped；不得新增原始房客、LINE、銀行或付款資料輸出。
- 本次只使用既有 `landlord_home_bootstrap` 與 `landlord_revenue_dashboard_init`，不新增 route、schema、trigger、LINE push 或 Production 寫入。
- 圖表語意固定：應收藍色 `#2F6FED`、已收綠色 `#06C755`、欠款／未收珊瑚紅 `#FF6259`。
- 應收、已收、欠款的圖例、文字值與 aria-label 必須同時存在，不能只靠顏色辨識。
- 每項 production code 修改前必須先有會因該行為缺失而失敗的測試，並實際看見 RED。
- 每個 bounded task 完成後執行受影響測試、`npm run validate`、`git diff --check`，再提交清楚 commit。

## File Map

- Modify: `landlord-home.html` — 首頁視覺、圖表 render、JSONP retry、漸進式載入與 loading/error states。
- Create: `tests/phase193-landlord-home-dashboard.test.mjs` — 既有 inline script 的純資料 helper、重試策略、進載順序與 UI contract 測試。
- Modify: `docs/09-TEST-MATRIX.md` — 記錄 Phase 193 的首頁圖表與韌性覆蓋。
- Modify: `docs/CMWEBS_ARCHITECTURE_DECISIONS.md` — 記錄首頁採兩階段載入、沿用既有報表 route、不使用財務快照 cache 的決策。
- Create during QA: `design-qa.md` — source visual、implementation screenshot、viewport、比較證據與最終結果。

### Task 1: Lock the data and visual contracts with failing tests

**Files:**
- Create: `tests/phase193-landlord-home-dashboard.test.mjs`
- Modify: `landlord-home.html` only after RED is observed

**Interfaces:**
- Consumes: existing inline functions `safeHtml`, `money`, `loadPage` and existing report payload fields `months`, `occupancy`, `contract_expiry`.
- Produces: `normaliseLandlordDashboardData_(data)`, `contractExpiryBuckets_(rows)`, `dashboardSeriesColor_(key)` for later rendering and tests.

- [ ] **Step 1: Write the failing data contract tests.**

  Add a Node test that extracts the named inline functions from `landlord-home.html` with the same function-extraction pattern used by existing Phase 143 tests. Use hand-written fixtures, not the production helper, for expectations:

  ```js
  const report = context.normaliseLandlordDashboardData_({
    months: [{ month: '2026-08', receivable: 287500, collected: 264000, outstanding: 23500 }],
    occupancy: { occupancy_rate: 0.95 },
    contract_expiry: [{ bucket: '30d', count: 2 }, { bucket: '60d', count: 4 }]
  });

  assert.deepEqual(report.months, [
    { month: '2026-08', receivable: 287500, collected: 264000, outstanding: 23500 }
  ]);
  assert.equal(report.occupancy.occupancy_rate, 0.95);
  assert.deepEqual(context.contractExpiryBuckets_(report.contract_expiry), [
    { key: '30d', label: '30 天', count: 2 },
    { key: '60d', label: '60 天', count: 4 },
    { key: '90d', label: '90 天', count: 0 }
  ]);
  assert.equal(context.dashboardSeriesColor_('receivable'), '#2F6FED');
  assert.equal(context.dashboardSeriesColor_('collected'), '#06C755');
  assert.equal(context.dashboardSeriesColor_('outstanding'), '#FF6259');
  ```

  Add malformed-input assertions showing missing arrays become empty arrays, invalid rates become `0`, and missing expiry buckets still return all three fixed buckets with zero counts.

- [ ] **Step 2: Run the focused test and verify the expected RED.**

  Run:

  ```bash
  node tests/phase193-landlord-home-dashboard.test.mjs
  ```

  Expected: FAIL because the three production helpers do not exist yet. If the test errors while extracting functions, correct only the test harness and rerun until it fails for the missing behavior.

- [ ] **Step 3: Implement the minimal pure helpers.**

  Add the three helpers in the existing inline script before `renderHome`:

  - `normaliseLandlordDashboardData_(data)` returns `{ months, occupancy, contract_expiry }` with only finite numeric values and safe empty defaults.
  - `contractExpiryBuckets_(rows)` returns the fixed order `30d`, `60d`, `90d`, accepting the existing backend bucket names and never emitting `NaN`.
  - `dashboardSeriesColor_(key)` returns only the three approved semantic colors and a neutral fallback for unknown keys.

- [ ] **Step 4: Run the focused test and verify GREEN.**

  Run the same Node command and confirm it passes with no warnings.

- [ ] **Step 5: Commit the contract slice.**

  ```bash
  git add tests/phase193-landlord-home-dashboard.test.mjs landlord-home.html
  git commit -m "test: define landlord home dashboard data contracts"
  ```

### Task 2: Add failing tests and implementation for the chart surface

**Files:**
- Modify: `tests/phase193-landlord-home-dashboard.test.mjs`
- Modify: `landlord-home.html`

**Interfaces:**
- Consumes: Task 1 normalized dashboard data and the existing home `home` object.
- Produces: `renderLandlordDashboardCharts_(data)`, `renderLandlordDashboardError_(message)`, and stable DOM ids `landlordRevenueChart`, `landlordOccupancyChart`, `landlordContractExpiryChart`, `landlordDashboardState`.

- [ ] **Step 1: Add failing UI contract assertions.**

  Assert the source contains the approved KPI labels and exactly one element id for each chart surface, the three semantic colors, `aria-label` text for all series, `查看收入明細`, and the existing bottom navigation. Add an orchestration assertion using a small DOM fixture that `renderLandlordDashboardCharts_` writes a loading state before a successful payload and writes a局部 error state without replacing the home root.

- [ ] **Step 2: Run the focused test and verify RED.**

  Run `node tests/phase193-landlord-home-dashboard.test.mjs`; expected failure is a missing marker/helper, not a syntax error.

- [ ] **Step 3: Implement the minimal dashboard markup and SVG renderers.**

  Replace the current first collection card in `renderHome` with the approved structure:

  1. header with greeting and last-updated text;
  2. four KPI cells for `應收`, `已收`, `未收`, `收款率`;
  3. chart section with the 12-month lines `receivable`, `collected`, `outstanding`, readable legend and values;
  4. accessible `查看收入明細` link to `landlord-revenue-dashboard.html`;
  5. occupancy donut and fixed 30／60／90-day contract expiry bar chart;
  6. existing action list, quick links and fixed bottom navigation.

  Use explicit SVG `viewBox` dimensions and the existing `safeHtml`/numeric helpers. Use the selected colors through `dashboardSeriesColor_`. Include a compact data table or text summary adjacent to the chart so values remain available without color. Do not add a chart dependency or a new route.

- [ ] **Step 4: Run focused UI/runtime tests and verify GREEN.**

  Run `node tests/phase193-landlord-home-dashboard.test.mjs` and the existing `node tests/phase150-revenue-dashboard.runtime.test.mjs`, `node tests/phase151-revenue-dashboard-ui.test.mjs`, `node tests/phase152-revenue-dashboard-visuals.runtime.test.mjs`, and `node tests/phase153-revenue-dashboard-visuals-ui.test.mjs`.

- [ ] **Step 5: Commit the chart slice.**

  ```bash
  git add tests/phase193-landlord-home-dashboard.test.mjs landlord-home.html
  git commit -m "feat: add landlord home revenue charts"
  ```

### Task 3: Add failing tests and implementation for resilient progressive loading

**Files:**
- Modify: `tests/phase193-landlord-home-dashboard.test.mjs`
- Modify: `landlord-home.html`

**Interfaces:**
- Consumes: existing `landlord_home_bootstrap` and `landlord_revenue_dashboard_init` routes.
- Produces: `jsonpRequestOnce(action, params, timeoutMs)`, `jsonpRequest(action, params, options)`, `shouldRetryDashboardRequest_(error, attempt, maxAttempts)`, `loadDashboardReport_()`, and request-sequence protection in `loadPage()`.

- [ ] **Step 1: Add failing JSONP retry tests.**

  Use a real Promise around a controlled document fixture. Make the first script append do nothing until its timeout, then make the second append invoke its callback. Assert the read wrapper resolves after exactly two attempts. Add a second fixture invoking `script.onerror` and assert it rejects immediately. Add a direct behavior assertion for `shouldRetryDashboardRequest_`: only timeout at attempt 1 with max attempts 2 returns true; network error and attempt 2 return false.

- [ ] **Step 2: Add failing progressive-orchestration tests.**

  Extract `loadPage` with stubs for `initLineUserId`, `renderHome`, `requestDashboardReport_`, `loadDashboardReport_`, and `jsonpRequest`. Assert the report request starts before the bootstrap request, while `renderHome` still waits only for bootstrap; assert both read paths use the retry options. Add a report failure fixture and assert the home renderer is still called before the local report error renderer.

- [ ] **Step 3: Run the focused test and verify RED.**

  Run `node tests/phase193-landlord-home-dashboard.test.mjs`; expected RED is missing `jsonpRequestOnce`, missing retry behavior, or wrong orchestration order.

- [ ] **Step 4: Implement the smallest resilient request layer.**

  Replace the current single-shot home `jsonpRequest` with the proven `jsonpRequestOnce`/wrapper shape from `tenant-bind.html`, preserving the 30-second timeout, two-attempt maximum and 350ms retry delay. On `script.onerror`, clean up callback and script and reject immediately. Add `shouldRetryDashboardRequest_` so only exact timeout errors retry. Do not pass retry options to any write action.

- [ ] **Step 5: Implement progressive loading and local error boundaries.**

  Render an inline skeleton at page start, keep existing content during manual refresh, and use an incrementing request id so stale responses cannot overwrite newer refreshes. After identity initialization, start `requestDashboardReport_` in parallel with bootstrap. After bootstrap success, call `renderHome` immediately, then attach `loadDashboardReport_` to the already-started report promise. The report call uses `{ range: '12m' }` and updates only the chart host. Render a chart-local retry/error state on final report failure; render the existing full-page error state only when bootstrap fails after its retry.

- [ ] **Step 6: Run focused tests and verify GREEN.**

  Run the Phase 193 test plus the existing landlord/home and revenue dashboard tests. Confirm no duplicate callback names, no unhandled Promise rejection, and no `API 載入逾時` state requiring a manual page reload after the automatic second attempt succeeds.

- [ ] **Step 7: Commit the loading slice.**

  ```bash
  git add tests/phase193-landlord-home-dashboard.test.mjs landlord-home.html
  git commit -m "fix: make landlord home loading recover from read timeouts"
  ```

### Task 4: Update release documentation and run full verification

**Files:**
- Modify: `docs/09-TEST-MATRIX.md`
- Modify: `docs/CMWEBS_ARCHITECTURE_DECISIONS.md`
- Create: `design-qa.md`

**Interfaces:**
- Consumes: Tasks 1–3 implementation and fresh test/browser evidence.
- Produces: documented Phase 193 coverage, architecture decision, visual QA report, and an explicit local-only release packet.

- [ ] **Step 1: Add the Phase 193 test matrix row.**

  Record the test file, covered behaviors, command, and current status. Do not mark Production or real-device UAT as PASS from local evidence.

- [ ] **Step 2: Record the architecture decision.**

  Add a concise decision entry stating that the homepage uses the core bootstrap plus a parallel existing report API, with timeout retry only for reads and no financial snapshot cache because cross-workspace stale display is a privacy risk.

- [ ] **Step 3: Run the repository validator and all affected tests.**

  ```bash
  npm run validate
  node tests/phase193-landlord-home-dashboard.test.mjs
  node tests/phase150-revenue-dashboard.runtime.test.mjs
  node tests/phase151-revenue-dashboard-ui.test.mjs
  node tests/phase152-revenue-dashboard-visuals.runtime.test.mjs
  node tests/phase153-revenue-dashboard-visuals-ui.test.mjs
  git diff --check
  ```

  Expected: all commands exit 0. If an unrelated baseline test fails, report it separately and do not hide it.

- [ ] **Step 4: Start the existing local preview and capture the mobile screen.**

  Use the repository's existing preview mechanism and the user-selected browser surface. Capture a 390 × 844 implementation image for the `landlord-home.html` normal state and, if possible, loading/report-error states. Do not deploy or publish.

- [ ] **Step 5: Compare source and implementation and write `design-qa.md`.**

  Compare `docs/superpowers/specs/assets/2026-08-31-landlord-home-dashboard-selected.png` to the implementation at the same viewport. Explicitly evaluate typography, spacing, colors/tokens, chart/asset fidelity, copy, accessibility, and bottom navigation. Record any P0/P1/P2 findings and fix them before setting `final result: passed`; if browser capture is unavailable, set `final result: blocked`.

- [ ] **Step 6: Inspect final diff and status.**

  ```bash
  git status --short --branch
  git diff origin/main...HEAD --stat
  git diff origin/main...HEAD -- landlord-home.html tests/phase193-landlord-home-dashboard.test.mjs docs/09-TEST-MATRIX.md docs/CMWEBS_ARCHITECTURE_DECISIONS.md design-qa.md
  ```

  Confirm only scoped files changed, no credentials or tenant payloads were added, and no Production action occurred.

- [ ] **Step 7: Commit documentation and QA evidence.**

  ```bash
  git add docs/09-TEST-MATRIX.md docs/CMWEBS_ARCHITECTURE_DECISIONS.md design-qa.md
  git commit -m "docs: record landlord home dashboard verification"
  ```

## Completion Handoff

After Task 4, report the isolated worktree path, branch, commit list, fresh validation output, visual QA result, changed files, known limitations, and explicit deployment/rollback steps. Do not push, merge, publish GitHub Pages, deploy Apps Script, or claim Production/mobile UAT completion without separate authorization and evidence.
