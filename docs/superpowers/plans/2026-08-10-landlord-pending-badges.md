# Landlord Pending Badges and Payment Review Route Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every landlord entry point open the landlord payment-review LIFF page and show fail-closed red pending-count badges for payment reports, contract requests, and notifications.

**Architecture:** Reuse the three existing landlord JSONP init actions and their workspace/RBAC-scoped summaries. The frontend alone formats and renders counts; no new API, schema, or production data write is introduced.

**Tech Stack:** Static GitHub Pages HTML/CSS/JavaScript, Apps Script JSONP APIs, Node assertion tests.

## Global Constraints

- Work only in an isolated `codex/` branch.
- Do not deploy Apps Script, publish GitHub Pages, push Git, alter Production data, or send LINE.
- Keep `landlord-payment-reports.html` as the tenant submission page.
- A failed summary request must hide only its own badge, never display a misleading zero.
- Render 1–99 exactly and render every value above 99 as `99+`.

---

### Task 1: Route every landlord payment-review entry to the landlord review page

**Files:**
- Modify: `landlord-more.html`
- Modify: `landlord-arrears.html`
- Modify: `landlord-paid-bills.html`
- Modify: `tests/phase142-landlord-payment-report-liff.test.mjs`

- [ ] Add a failing assertion in `tests/phase142-landlord-payment-report-liff.test.mjs`:

```js
for (const page of [
  'landlord-more.html',
  'landlord-arrears.html',
  'landlord-paid-bills.html'
]) {
  const source = readFileSync(resolve(ROOT, page), 'utf8');
  assert.match(source, /landlord-payment-report-review\.html/);
  assert.doesNotMatch(source, /landlord-payment-reports\.html/);
}
```

- [ ] Run `node tests/phase142-landlord-payment-report-liff.test.mjs` and confirm RED.
- [ ] Replace the three landlord navigation targets with `landlord-payment-report-review.html` while retaining their existing click handlers and navigation parameters.
- [ ] Run the focused test again and confirm GREEN.

### Task 2: Add isolated red pending badges to the landlord More menu

**Files:**
- Modify: `landlord-more.html`
- Create: `tests/phase143-landlord-pending-badges.test.mjs`

- [ ] Add separate, initially hidden badge elements beside the existing menu labels using these IDs:
  - `paymentReportPendingBadge`
  - `contractRequestPendingBadge`
  - `notificationUnreadBadge`
- [ ] Add one shared `.pending-count-badge` style: compact red circular/pill presentation, white bold text, no layout shift, and no conflict with the existing non-red contract status label.
- [ ] Add these helpers near the existing UI helpers:

```js
function formatPendingBadgeCount(value) {
  const count = Math.max(0, Number(value) || 0);
  return count > 99 ? '99+' : (count > 0 ? String(count) : '');
}

function setPendingBadge(elementId, value) {
  const element = document.getElementById(elementId);
  if (!element) return;
  const label = formatPendingBadgeCount(value);
  element.hidden = !label;
  element.textContent = label;
}

function hidePendingBadge(elementId) {
  const element = document.getElementById(elementId);
  if (!element) return;
  element.hidden = true;
  element.textContent = '';
}
```

- [ ] Extend the existing `Promise.allSettled` summary loading with existing JSONP calls only:
  - `landlord_payment_reports_init` → `data.summary.pending`
  - `landlord_contract_requests_init` → `data.summary.pending_count`, retaining current fallback logic from the returned request statuses
  - `landlord_notifications_init` → `data.summary.unread_count`
- [ ] For fulfilled responses with a valid summary, call `setPendingBadge`. For rejected, malformed, or missing-summary responses, call `hidePendingBadge` only for that item.
- [ ] Do not change existing dashboard summary cards, tenant pages, API dispatch, backend RBAC, or workspace filtering.
- [ ] Create `tests/phase143-landlord-pending-badges.test.mjs` that loads `landlord-more.html` and verifies:
  - the three unique elements and badge CSS exist;
  - all three existing action names are requested;
  - `1`, `99`, and `100` format to `1`, `99`, and `99+`;
  - zero/invalid values hide the badge;
  - each rejected request invokes only that badge’s hide path;
  - tenant payment submission remains routed to `landlord-payment-reports.html` nowhere in landlord navigation.
- [ ] Run the new test and confirm GREEN.

### Task 3: Candidate verification and local handoff

**Files:**
- Verify only the files above and the two focused test files.

- [ ] Run:

```bash
node tests/phase142-landlord-payment-report-liff.test.mjs
node tests/phase143-landlord-pending-badges.test.mjs
node tests/phase140-landlord-contract-signing-review.runtime.test.mjs
git diff --check
```

- [ ] Run `npm run validate` only when the isolated checkout has a package manifest; otherwise report the exact `ENOENT` constraint without treating it as a pass.
- [ ] Run syntax checks for each modified HTML embedded script and scan the diff for tokens, LINE UIDs, raw request IDs, or unintended endpoint changes.
- [ ] Request an independent local code review. Resolve any Critical or Important issue and repeat the focused checks.
- [ ] Create one local commit only after all available checks pass. Do not push, create a PR, or deploy.

## Expected Handoff

The resulting candidate changes only static frontend files and tests. A later explicit authorization is required separately for GitHub Pages publication; no Apps Script deployment should be needed.
