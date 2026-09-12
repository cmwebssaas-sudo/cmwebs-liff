# CMWebs 房東後台 B+ UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將 CMWebs 房東桌面版共用 shell 與總覽頁改成明亮、色塊按鈕、Airbnb-inspired 的簡潔營運介面，同時保持手機版與既有資料流程不變。

**Architecture:** 以現有 `landlord-responsive.css` 作為唯一桌面樣式邊界，使用 `@media (min-width: 1024px)` 重塑 shared shell；`landlord-home.html` 只增加 desktop overview scope class，沿用現有資料、事件、圖表與錯誤 recovery。所有行為與 API 保持原狀。

**Tech Stack:** 原生 HTML、CSS、內嵌 JavaScript、Node.js built-in `node:test`，不新增套件或外部字型依賴。

**Spec:** `docs/superpowers/specs/2026-09-13-landlord-bplus-ui-design.md`

## Global Constraints

- `V2.0` 只接受既有 Production 基線的正確性與穩定性修正；本計畫不得新增營運功能。
- 靜態 HTML 部署於 GitHub Pages；不得改 API URL、LIFF ID、登入、Workspace、RBAC、帳務、訂閱或資料 schema。
- 手機 shell 必須保留 `html, body { height:100%; overflow:hidden; }`、`.app-shell` fixed height／overflow hidden、`.page` scroll、bottom nav 與 safe-area reserve。
- 桌面規則只能位於 `@media (min-width: 1024px)`，並以既有 `landlord-responsive.css` 為共用來源。
- 不建立版本式正式檔名，不修改 root dirty worktree；只在 `/Users/hans/CMWebs/cmwebs-liff/.worktrees/backend-ui-bplus-20260913` 工作。
- 實作建議模型：`gpt-5.6-terra`、medium。

---

### Task 1: 建立 B+ UI 回歸測試

**Files:**
- Create: `tests/phase260-landlord-bplus-ui.test.mjs`
- Test: `tests/phase260-landlord-bplus-ui.test.mjs`

**Interfaces:**
- Consumes: `landlord-responsive.css`, `landlord-home.html`, and existing desktop/mobile shell contracts.
- Produces: static assertions for B+ tokens, light sidebar, color-block controls, scoped overview, and unchanged mobile boundary.

- [ ] **Step 1: Write the failing test**

  Create a Node built-in test that reads the shared stylesheet and overview page, then asserts the following exact behaviors:

  ```js
  import assert from 'node:assert/strict';
  import test from 'node:test';
  import { readFileSync } from 'node:fs';

  const css = readFileSync(new URL('../landlord-responsive.css', import.meta.url), 'utf8');
  const home = readFileSync(new URL('../landlord-home.html', import.meta.url), 'utf8');

  test('B+ desktop shell uses a light Airbnb-inspired operations canvas', () => {
    assert.match(css, /--desktop-sidebar-width:\s*232px/);
    assert.match(css, /--desktop-shell-bg:\s*#f7f7f5/);
    assert.match(css, /--desktop-sidebar-bg:\s*#fffdfb/);
    assert.match(css, /--desktop-accent:\s*#0f766e/);
    assert.match(css, /\.desktop-nav-item\.active[\s\S]*?background:\s*var\(--desktop-accent-soft\)/);
    assert.match(css, /\.desktop-main[\s\S]*?padding:\s*28px 32px 48px/);
    assert.match(css, /\.desktop-overview[\s\S]*?\.dashboard-summary-card/);
  });

  test('B+ overview keeps existing data hooks and uses color-block controls', () => {
    assert.match(home, /<main class="page desktop-main desktop-overview">/);
    for (const marker of [
      'dashboard-kpi-grid desktop-kpi-row',
      'landlordDashboardState',
      'desktop-panel-grid',
      'homeActionSection',
      'landlordRevenueChart',
      'landlordOccupancyChart',
      'landlordContractExpiryChart'
    ]) {
      assert.match(home, new RegExp(marker));
    }
    assert.match(css, /\.desktop-overview[\s\S]*?\.primary-button[\s\S]*?background:\s*var\(--desktop-accent\)/);
  });

  test('B+ desktop changes stay inside the desktop media boundary', () => {
    const desktopStart = css.indexOf('@media (min-width: 1024px)');
    assert.ok(desktopStart >= 0);
    const desktopCss = css.slice(desktopStart);
    const mobileCss = css.slice(0, desktopStart);
    assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    assert.match(desktopCss, /min-height:\s*44px/);
    assert.doesNotMatch(mobileCss, /\.desktop-overview/);
  });
  ```

- [ ] **Step 2: Run the new test to verify it fails**

  Run: `node --test tests/phase260-landlord-bplus-ui.test.mjs`

  Expected: FAIL because the current stylesheet still declares the 256px dark sidebar, does not define B+ tokens, and the overview main element lacks `desktop-overview`.

- [ ] **Step 3: Commit the red test**

  Run: `git add tests/phase260-landlord-bplus-ui.test.mjs && git commit -m "test: define landlord B+ desktop UI contract"`

### Task 2: Redesign the shared desktop shell

**Files:**
- Modify: `landlord-responsive.css:1-587`
- Test: `tests/phase260-landlord-bplus-ui.test.mjs`

**Interfaces:**
- Consumes: existing `.app-shell.desktop-ready`, `.desktop-sidebar`, `.desktop-nav-item`, `.desktop-main`, `.desktop-topbar`, `.card`, and `.bottom-nav` selectors.
- Produces: B+ light desktop shell tokens and selectors while retaining the existing mobile CSS boundary and shared hooks.

- [ ] **Step 1: Define the B+ desktop tokens**

  Replace only the desktop token values at the top of `landlord-responsive.css` with:

  ```css
  --desktop-sidebar-width: 232px;
  --desktop-content-max: 1440px;
  --desktop-gap: 24px;
  --desktop-shell-bg: #f7f7f5;
  --desktop-sidebar-bg: #fffdfb;
  --desktop-sidebar-muted: #6b706c;
  --desktop-sidebar-border: #e8e6e1;
  --desktop-accent: #0f766e;
  --desktop-accent-soft: #e8f5f1;
  --desktop-focus-ring: #0f766e;
  ```

- [ ] **Step 2: Style the desktop sidebar and topbar as a light information frame**

  Within the existing `@media (min-width: 1024px)` block, keep the grid and hidden bottom nav, then set the sidebar to `var(--desktop-sidebar-bg)` with a light border, make `.desktop-brand-label` and active states use `var(--desktop-accent)`, set `.desktop-nav-item` text to `var(--desktop-sidebar-muted)`, and set `.desktop-nav-item:hover, .desktop-nav-item.active` to `background: var(--desktop-accent-soft)` with `color: var(--desktop-accent)` and no dark fill.

  Set `.desktop-main` to `padding: 28px 32px 48px`, `.desktop-topbar` to a clean bottom divider with `padding-bottom: 18px`, and `.desktop-status-pill` to a white pill with accent text. Keep all controls at `min-height: 44px` and keep the existing focus ring.

- [ ] **Step 3: Apply consistent surfaces and color-block button feedback**

  Within the same desktop media block, set `.card`, `.dashboard-card`, `.section-card`, `.toolbar-card`, `.filter-card`, `.actions-card`, `.property-card`, and `.hero` to `border-radius: 16px`, a `1px solid #e5e5df` border, and `box-shadow: 0 8px 24px rgba(32, 48, 42, 0.06)`.

  Add desktop-only styles for `.desktop-main .primary-button`, `.desktop-main .dashboard-retry-button`, `.desktop-main .quick-button`, `.desktop-main .action-item`, and `.desktop-logout-button` so primary operations use a solid accent block or accent-soft block, secondary operations remain outlined, and `:hover`, `:active`, `:focus-visible`, and `:disabled` states are visually distinct.

- [ ] **Step 4: Run the B+ test to verify the shell passes**

  Run: `node --test tests/phase260-landlord-bplus-ui.test.mjs`

  Expected: the shared token, sidebar, main padding, color-block and reduced-motion assertions pass; the overview scope assertion remains failing until Task 3.

### Task 3: Scope and polish the overview page

**Files:**
- Modify: `landlord-home.html:1022`
- Modify: `landlord-responsive.css` inside `@media (min-width: 1024px)`
- Test: `tests/phase260-landlord-bplus-ui.test.mjs`

**Interfaces:**
- Consumes: existing overview data and DOM hooks including `dashboard-kpi-grid`, `landlordDashboardState`, `desktop-panel-grid`, and chart IDs.
- Produces: `.desktop-overview` scope and desktop-only overview spacing/typography without changing data rendering or handlers.

- [ ] **Step 1: Add the overview scope marker**

  Change only the home page main element from:

  ```html
  <main class="page desktop-main">
  ```

  to:

  ```html
  <main class="page desktop-main desktop-overview">
  ```

- [ ] **Step 2: Add desktop overview layout rules**

  Add rules inside the existing desktop media block:

  ```css
  .desktop-overview .dashboard-summary-card {
    border-color: #dfe9e4;
    box-shadow: 0 10px 28px rgba(32, 48, 42, 0.07);
  }

  .desktop-overview .dashboard-kpi {
    min-height: 112px;
    padding: 18px 20px;
    border: 1px solid #e5e5df;
    border-radius: 14px;
    background: #ffffff;
  }

  .desktop-overview .dashboard-kpi-label,
  .desktop-overview .section-hint,
  .desktop-overview .dashboard-section-subtitle {
    color: #6b706c;
  }

  .desktop-overview .dashboard-kpi-value {
    margin-top: 8px;
    font-size: 26px;
    letter-spacing: -0.4px;
  }

  .desktop-overview .dashboard-card,
  .desktop-overview .section-card {
    margin-bottom: 0;
  }

  .desktop-overview .quick-button {
    min-height: 112px;
    padding: 18px;
    border-color: #e5e5df;
    background: #ffffff;
  }

  .desktop-overview .quick-button:hover {
    border-color: #b7ddd1;
    background: #f4fbf8;
  }
  ```

  Do not remove or rename any current chart, action, or API hooks.

- [ ] **Step 3: Run the B+ test to verify the overview passes**

  Run: `node --test tests/phase260-landlord-bplus-ui.test.mjs`

  Expected: PASS with zero failures.

### Task 4: Run full verification and record the change

**Files:**
- Modify: `docs/superpowers/specs/2026-09-13-landlord-bplus-ui-design.md`
- Modify: `docs/superpowers/plans/2026-09-13-landlord-bplus-ui.md`
- Test: `tests/phase260-landlord-bplus-ui.test.mjs`, existing `tests/*.test.mjs`

**Interfaces:**
- Consumes: all changes from Tasks 1–3.
- Produces: verified feature branch with a documented visual-only scope and no Production deployment.

- [ ] **Step 1: Run focused and existing desktop tests**

  Run: `node --test tests/phase220-landlord-responsive-ui.test.mjs tests/phase244-landlord-desktop-login-ui.test.mjs tests/phase258-desktop-detail-and-contract-email.test.mjs tests/phase259-desktop-tenant-detail-and-email-contract-read.test.mjs tests/phase260-landlord-bplus-ui.test.mjs`

  Expected: all listed tests pass with zero failures.

- [ ] **Step 2: Run the complete Node test suite**

  Run: `node --test tests/*.test.mjs`

  Expected: all tests pass with zero failures; if the repository's known baseline validator is unavailable on `origin/main`, record that explicitly instead of changing unrelated files.

- [ ] **Step 3: Run static checks**

  Run: `git diff --check`

  Expected: no whitespace errors.

- [ ] **Step 4: Review the diff against the scope**

  Run: `git diff --stat && git diff -- landlord-responsive.css landlord-home.html tests/phase260-landlord-bplus-ui.test.mjs`

  Confirm the diff contains only B+ desktop CSS, the overview scope class, the new test, and the design documents; confirm no API, auth, billing, subscription, data, or deployment files changed.

- [ ] **Step 5: Commit the implementation**

  Run: `git add landlord-responsive.css landlord-home.html tests/phase260-landlord-bplus-ui.test.mjs docs/superpowers/specs/2026-09-13-landlord-bplus-ui-design.md docs/superpowers/plans/2026-09-13-landlord-bplus-ui.md && git commit -m "feat: refresh landlord desktop overview UI"`

- [ ] **Step 6: Report deployment boundary**

  Do not push, publish GitHub Pages, deploy Apps Script, or claim Production readiness in this plan. Report the branch, commit, focused/full test results, screenshots/manual QA still required, and the exact next deployment command only after separate authorization.
