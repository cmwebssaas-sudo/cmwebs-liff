# Revenue Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Workspace-scoped landlord revenue dashboard with KPI cards, monthly revenue data, tabular fallback, and CSV export.

**Architecture:** A new Apps Script reporting module authenticates through the existing Workspace landlord resolver, filters canonical rows before aggregation, and exposes one JSONP read route. A static LIFF page renders only aggregated data with inline SVG and HTML tables, so chart rendering cannot bypass backend scope rules.

**Tech Stack:** Google Apps Script JavaScript, static HTML/CSS/vanilla JavaScript, Node.js ESM tests, existing LIFF SDK and JSONP transport.

## Global Constraints

- `workspace_id` is the primary tenancy key; `landlord_id` is compatibility-only.
- All reads must pass Workspace, role, and permission checks.
- `runtimeSpreadsheet_()` is the only spreadsheet source for the new route.
- No new production Sheet, token, credential, or test UID is added.
- Use the existing root HTML shell and reserve space for the bottom navigation.
- Run `npm run validate` when the target checkout provides the validation script; otherwise run the validator directly and record the limitation.

---

### Task 1: Add failing aggregation tests

**Files:**
- Create: `tests/phase150-revenue-dashboard.runtime.test.mjs`
- Test: `apps-script/V2_REPORTING_DASHBOARD.js`

**Interfaces:**
- Consumes: `revenueDashboardAggregate_({ properties, rooms, contracts, bills, payments }, options)`.
- Produces: `{ kpis, months, properties, updated_at }` with no raw rows.

- [ ] **Step 1: Write the failing test**

Test a 2-month, two-property dataset where one bill is paid by a confirmed payment, one bill is paid only through the canonical bill fallback, one bill is outstanding, and one bill belongs to another Workspace. Assert monthly receivable/collected/outstanding, KPI totals, `null` rate for zero receivable, and property scope.

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/phase150-revenue-dashboard.runtime.test.mjs`

Expected: FAIL because `apps-script/V2_REPORTING_DASHBOARD.js` and `revenueDashboardAggregate_` do not exist.

### Task 2: Implement scoped aggregation and route

**Files:**
- Create: `apps-script/V2_REPORTING_DASHBOARD.js`
- Modify: `apps-script/程式碼.js`
- Modify: `docs/04-API-ROUTES.md`

**Interfaces:**
- Consumes: existing `workspaceLandlordResolveAccess_`, `runtimeSpreadsheet_`, `workspaceGetObjectsWithRow_`, and `workspaceDashboardRowMatchesAccess_`.
- Produces: `getLandlordRevenueDashboardByLineUid_(lineUserId, options)` and JSONP action `landlord_revenue_dashboard_init`.

- [ ] **Step 1: Implement pure helpers**

Implement month-range normalization, amount/status/date normalization, payment aggregation by `bill_id`, and `revenueDashboardAggregate_`. Exclude `voided`, `cancelled`, and draft bills; include issued/open/paid/settled bills; never allow collected amounts above the bill amount.

- [ ] **Step 2: Implement Workspace-scoped loader**

Resolve access once, build the in-scope property map, filter every source row before aggregation, require `V2_bills`, and treat `V2_payments` as optional. Return `REPORTING_SCHEMA_NOT_READY` when required sheets are absent.

- [ ] **Step 3: Add dispatcher route**

Read `range`, `from_month`, `to_month`, and `property_id`; call the new public function; preserve JSONP and bridge output conventions; update the route inventory and count.

- [ ] **Step 4: Run the focused test**

Run: `node tests/phase150-revenue-dashboard.runtime.test.mjs`

Expected: PASS with all assertions covering totals, fallback, scope, and zero-rate behavior.

### Task 3: Add the landlord dashboard page

**Files:**
- Create: `landlord-revenue-dashboard.html`
- Modify: `landlord-more.html`
- Create: `tests/phase151-revenue-dashboard-ui.test.mjs`

**Interfaces:**
- Consumes: `landlord_revenue_dashboard_init` response `{ kpis, months, properties, updated_at }`.
- Produces: accessible KPI cards, SVG chart, numeric tables, empty state, and CSV download.

- [ ] **Step 1: Write the failing UI test**

Assert the new page contains the route, range selector, all four KPI labels, SVG chart marker, table fallback, empty-state marker, CSV export marker, and safe shell styles. Assert `landlord-more.html` links to the new page.

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/phase151-revenue-dashboard-ui.test.mjs`

Expected: FAIL because the page and menu entry do not exist.

- [ ] **Step 3: Implement the page and menu entry**

Reuse existing `API_URL`, LIFF initialization, JSONP request, release version, and bottom-nav patterns. Escape all values before HTML insertion, render no-data state when `months` is empty, and generate CSV from the already-scoped aggregates.

- [ ] **Step 4: Run the UI test**

Run: `node tests/phase151-revenue-dashboard-ui.test.mjs`

Expected: PASS.

### Task 4: Run full static verification and review the diff

**Files:**
- Modify: `docs/09-TEST-MATRIX.md`
- Modify: `docs/13-REPORTING-SPEC.md` if the canonical reporting spec is present in the release tree.

- [ ] **Step 1: Run focused tests and syntax checks**

Run: `node tests/phase150-revenue-dashboard.runtime.test.mjs`, `node tests/phase151-revenue-dashboard-ui.test.mjs`, `node --check apps-script/V2_REPORTING_DASHBOARD.js`, `node --check apps-script/程式碼.js`, and `git diff --check`.

- [ ] **Step 2: Run repository validation**

Run: `npm run validate` when available; otherwise run `node /Users/hans/CMWebs/cmwebs-liff/scripts/validate-project.js --root . --apps-dir apps-script --html-dir . --expected-routes 73` and record the exact result.

- [ ] **Step 3: Verify scope and artifacts**

Confirm the diff contains only the reporting module, dispatcher/docs, dashboard page/menu, tests, and test-matrix updates. Confirm no credentials, full LINE IDs, raw tenant data, or Sheet writes were added.

- [ ] **Step 4: Commit the isolated work unit**

Run: `git add apps-script/V2_REPORTING_DASHBOARD.js apps-script/程式碼.js landlord-revenue-dashboard.html landlord-more.html tests/phase150-revenue-dashboard.runtime.test.mjs tests/phase151-revenue-dashboard-ui.test.mjs docs/04-API-ROUTES.md docs/09-TEST-MATRIX.md docs/superpowers/specs/2026-08-16-revenue-dashboard-design.md docs/superpowers/plans/2026-08-16-revenue-dashboard.md && git commit -m "feat: add landlord revenue dashboard"`
