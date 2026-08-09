# Payment Report Ownership and Badge Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide zero-count landlord menu badges reliably and allow an authorised landlord to settle a visible payment report without weakening workspace isolation.

**Architecture:** Keep the existing pending-count data contracts unchanged and make the HTML `hidden` state authoritative with a CSS override.  In settlement, resolve the existing workspace landlord access before accepting the report, then require the report's landlord identity to match the resolved principal and the associated bill to pass the existing workspace-scope helper.

**Tech Stack:** Static HTML/CSS/JavaScript, Google Apps Script JavaScript, Node runtime tests.

## Global Constraints

- Work only on `codex/v2_1-payment-report-ownership` in an isolated worktree.
- Do not push, deploy, alter Production data, send LINE, or perform a real settlement.
- Preserve the existing Web App routes, tenant LIFF submission page, RBAC, and workspace isolation.
- A badge is visible only for a finite non-negative integer count greater than zero; counts over 99 render `99+`.
- Historical LINE messages cannot be changed; future notification routing remains on the landlord review page.

---

### Task 1: Make hidden zero-count badges non-rendering

**Files:**
- Modify: `landlord-more.html:343-357`
- Test: `tests/phase143-landlord-pending-badges.test.mjs`

**Interfaces:**
- Consumes: `setPendingBadge(elementId, value)`, which sets `element.hidden = !label`.
- Produces: `.pending-count-badge[hidden]` always renders as `display: none`.

- [ ] **Step 1: Write the failing test**

Add an assertion requiring the stylesheet selector below:

```js
assert.match(
  source,
  /\.pending-count-badge\[hidden\]\s*\{\s*display:\s*none\s*!important;/,
  'an empty pending badge must not render a red dot'
);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/phase143-landlord-pending-badges.test.mjs`
Expected: FAIL because the hidden selector is absent.

- [ ] **Step 3: Write minimal implementation**

Add only:

```css
.pending-count-badge[hidden] {
  display: none !important;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/phase143-landlord-pending-badges.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add landlord-more.html tests/phase143-landlord-pending-badges.test.mjs
git commit -m "fix(v2.1): hide empty landlord pending badges"
```

### Task 2: Align settlement ownership with authorised workspace principal

**Files:**
- Modify: `apps-script/V2_PAYMENT_SETTLEMENT.js:124-227`
- Test: `tests/phase141-paid-bill-meter-correction.runtime.test.mjs`

**Interfaces:**
- Consumes: `workspaceLandlordResolveAccess_(lineUserId, options)` and `billingBillMatchesAccessScope_(bill, access)`.
- Produces: `REPORT_NOT_OWNED_BY_LANDLORD` only if the report is neither owned by the resolved principal landlord ID nor by the authorised legacy principal LINE UID; all accepted reports still require the existing bill workspace-scope check.

- [ ] **Step 1: Write the failing test**

Add a runtime fixture where the caller LINE UID differs from the historical report UID but `report.landlord_id === access.principal_landlord_id`; require settlement to pass ownership and reach the existing safe validation path.  Add a second fixture with a different `report.landlord_id` that must return `REPORT_NOT_OWNED_BY_LANDLORD`.

```js
assert.notEqual(accepted.code, 'REPORT_NOT_OWNED_BY_LANDLORD');
assert.equal(rejected.code, 'REPORT_NOT_OWNED_BY_LANDLORD');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/phase141-paid-bill-meter-correction.runtime.test.mjs`
Expected: FAIL because settlement currently compares only `report.landlord_line_user_id` to the caller UID.

- [ ] **Step 3: Write minimal implementation**

Move existing `workspaceLandlordResolveAccess_` before report ownership validation.  Derive the accepted principal LINE UID and landlord ID from `billingAccess`; accept only when the report matches one of those existing principal identity fields, then retain `billingBillMatchesAccessScope_(bill, billingAccess)` unchanged after the bill is loaded.

```js
const reportOwned =
  reportLandlordLineUserId === billingAccess.principal_line_user_id ||
  (principalLandlordId && reportLandlordId === principalLandlordId);
if (!reportOwned) return { success: false, code: 'REPORT_NOT_OWNED_BY_LANDLORD', ... };
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
node tests/phase141-paid-bill-meter-correction.runtime.test.mjs
node tests/phase142-landlord-payment-report-liff.test.mjs
node tests/phase143-landlord-pending-badges.test.mjs
git diff --check
```

Expected: each command exits 0.

- [ ] **Step 5: Commit**

```bash
git add apps-script/V2_PAYMENT_SETTLEMENT.js tests/phase141-paid-bill-meter-correction.runtime.test.mjs
git commit -m "fix(v2.1): align payment settlement ownership"
```

## Final Verification

- [ ] Run `npm run validate` if `package.json` exists; otherwise record that the isolated checkout has no npm validation entrypoint.
- [ ] Run `node --check apps-script/V2_PAYMENT_SETTLEMENT.js` and extract/check the inline JavaScript in `landlord-more.html`.
- [ ] Run `git diff --check origin/main...HEAD` and scan changed lines for tokens, secrets, raw LINE IDs, and URLs outside the existing canonical endpoints.
- [ ] Confirm only the two production files and targeted tests are changed; no source pushes, deployments, or Production mutations occurred.
