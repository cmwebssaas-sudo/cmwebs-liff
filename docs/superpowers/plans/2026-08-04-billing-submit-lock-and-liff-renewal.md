# Billing Submit Lock and LIFF Renewal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make monthly bill creation immutable at the meter-reading entry point and recover the bill-notification LIFF page from one expired access-token event.

**Architecture:** The Apps Script billing service remains the authoritative protection: an existing workspace-visible room/month bill is skipped before calculations or writes. The billing page reports a no-write lock result. The notification page renews only a verified expired LIFF profile session, preserving the sanitized existing page return URL and stopping after one renewal attempt.

**Tech Stack:** Google Apps Script-compatible JavaScript, static HTML/JavaScript, Node.js runtime tests.

## Global Constraints

- Work only in `/private/tmp/cmwebs-v2_1-billing-submit-lock` on `codex/v2_1-billing-submit-lock`.
- No Apps Script deployment, GitHub Pages publication, Git push, Production-data write, Sheet schema migration, LINE message, Property, trigger, or LIFF configuration change.
- Preserve `landlord_bills_generate` route name, Workspace/RBAC checks, and the existing correction/cancellation/payment flows.
- Never overwrite an existing bill, bill view, or room meter fields during repeat submission for the same room and normalized bill month.
- A token error unrelated to expiry must remain visible; only one expiry renewal redirect is allowed per tab.

---

### Task 1: Lock repeat bill submission in the Apps Script service

**Files:**
- Modify: `apps-script/V2_BILLING_MANAGEMENT.js:648-1385`
- Create: `tests/phase139-billing-submit-lock.runtime.test.mjs`

**Interfaces:**
- Consumes: `generateLandlordBillsByLineUid_(lineUserId, billMonth, itemsJson)` and its existing `generated`, `skipped`, and `errors` response fields.
- Produces: skip code `BILL_ALREADY_CREATED_LOCKED`; success code `BILLS_ALREADY_CREATED_LOCKED` when every selected item was locked; no-write behavior for historical bills.

- [ ] **Step 1: Write the failing service test**

```js
const result = generateLandlordBillsByLineUid_(
  'landlord-a',
  '2026-08',
  JSON.stringify([{ selected: true, room_id: 'R001', current_meter_reading: 999 }])
);

assert.equal(result.success, true);
assert.equal(result.code, 'BILLS_ALREADY_CREATED_LOCKED');
assert.equal(result.data.generated_count, 0);
assert.equal(result.data.skipped[0].code, 'BILL_ALREADY_CREATED_LOCKED');
assert.equal(fixtures.billWrites, 0);
assert.equal(fixtures.roomMeterWrites, 0);
```

The fixture contains an existing unpaid bill for `R001` and `2026-08`; the expected values are literals independent of billing helpers.

- [ ] **Step 2: Run the service test to verify it fails**

Run: `node tests/phase139-billing-submit-lock.runtime.test.mjs`

Expected: FAIL because the existing service reports a generated update and writes the historical bill/room meter.

- [ ] **Step 3: Implement the minimal service lock**

In the per-item loop, after `existingBill` is resolved and before reference-bill resolution or `billingCalculateBill_`, append this literal skip object and return from that item:

```js
skipped.push({
  room_id: roomId,
  room_name: billingText_(room.room_name),
  code: 'BILL_ALREADY_CREATED_LOCKED',
  message: '此房間本月帳單已建立，請至帳單管理更正'
});
return;
```

Remove the old paid-only update branch and the `existingBill` write branch. Calculate, append, synchronize views, update the room meter, and notify only newly created bills. Select `BILLS_ALREADY_CREATED_LOCKED` and `所選帳單均已建立，未修改任何資料` when `generated.length === 0`, `skipped.length > 0`, and `errors.length === 0`.

- [ ] **Step 4: Run the service test to verify it passes**

Run: `node tests/phase139-billing-submit-lock.runtime.test.mjs`

Expected: PASS, with zero historical bill/room writes and the explicit locked result.

- [ ] **Step 5: Add and run the mixed-batch regression assertion**

Add a second literal fixture containing `R001` with an existing bill and `R002` without one. Assert `generated_count === 1`, one `BILL_ALREADY_CREATED_LOCKED` skip, exactly one appended bill, and no write to `R001` meter data.

Run: `node tests/phase139-billing-submit-lock.runtime.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

```bash
git add apps-script/V2_BILLING_MANAGEMENT.js tests/phase139-billing-submit-lock.runtime.test.mjs
git commit -m "fix(v2.1): lock repeated monthly bill submission"
```

### Task 2: Show locked submissions clearly in the billing page

**Files:**
- Modify: `landlord-billing.html:2070-2205`
- Test: `tests/phase139-billing-submit-lock.runtime.test.mjs`

**Interfaces:**
- Consumes: server result code `BILLS_ALREADY_CREATED_LOCKED`, `generated_count`, and `skipped_count`.
- Produces: a visible no-write success message instead of misleading `已建立 0 筆帳單`.

- [ ] **Step 1: Write the failing frontend behavior test**

```js
assert.equal(
  formatBillingGenerationResult({
    code: 'BILLS_ALREADY_CREATED_LOCKED',
    data: { generated_count: 0, skipped_count: 18, error_count: 0 }
  }),
  '所選帳單均已建立，未修改任何資料'
);
```

The test runs the page helper in a minimal DOM-free harness and asserts the user-visible message literal.

- [ ] **Step 2: Run the frontend test to verify it fails**

Run: `node tests/phase139-billing-submit-lock.runtime.test.mjs`

Expected: FAIL because the page currently builds `已建立 0 筆帳單` directly in `generateBills`.

- [ ] **Step 3: Implement the minimal presentation helper**

Extract the existing successful-result toast text into `formatBillingGenerationResult(result)`. Return exactly `所選帳單均已建立，未修改任何資料` for the all-locked code; otherwise retain the current creation/error wording and append `，略過 N 筆已建立帳單` when `skipped_count > 0`.

- [ ] **Step 4: Run the frontend test to verify it passes**

Run: `node tests/phase139-billing-submit-lock.runtime.test.mjs`

Expected: PASS; existing mixed/error message behavior remains asserted.

- [ ] **Step 5: Commit Task 2**

```bash
git add landlord-billing.html tests/phase139-billing-submit-lock.runtime.test.mjs
git commit -m "fix(v2.1): clarify locked bill submissions"
```

### Task 3: Renew an expired notification LIFF session once

**Files:**
- Modify: `landlord-bill-notifications.html:947-1235,1943-2018`
- Test: `tests/phase139-billing-submit-lock.runtime.test.mjs`

**Interfaces:**
- Consumes: `liff.getProfile()`, `liff.logout()`, `liff.login({ redirectUri })`, and `buildLandlordLoginRedirectUri()`.
- Produces: a `false` return after one expiry redirect; a normal explicit error for non-expiry or second-attempt failure.

- [ ] **Step 1: Write the failing LIFF expiry test**

```js
await assert.rejects(
  () => runNotificationInit({ getProfile: async () => { throw new Error('The access token expired'); } }),
  /LOGIN_REDIRECT_STARTED/
);
assert.equal(logoutCalls, 1);
assert.equal(loginRedirect, 'landlord-entry.html?return_to=landlord-bill-notifications.html%3Fbill_month%3D2026-08');
```

The harness supplies a current notification URL with `bill_month=2026-08`; it separately asserts that a generic network error does not call `logout` or `login`.

- [ ] **Step 2: Run the LIFF test to verify it fails**

Run: `node tests/phase139-billing-submit-lock.runtime.test.mjs`

Expected: FAIL because `initLine` propagates the profile exception with no logout/login recovery.

- [ ] **Step 3: Implement single-attempt expiry recovery**

Add a small `isExpiredLiffAccessTokenError(error)` predicate that accepts the observed `The access token expired` message. In `initLine`, catch only that predicate around `liff.getProfile()`, check a session-storage renewal key, set it, call `liff.logout()` when defined, then call `liff.login({ redirectUri: buildLandlordLoginRedirectUri() })` and return `false`. Clear the key after a successful profile resolution. Rethrow every other error.

- [ ] **Step 4: Run the LIFF test to verify it passes**

Run: `node tests/phase139-billing-submit-lock.runtime.test.mjs`

Expected: PASS; exactly one redirected renewal retains `bill_month`, and generic errors remain errors.

- [ ] **Step 5: Commit Task 3**

```bash
git add landlord-bill-notifications.html tests/phase139-billing-submit-lock.runtime.test.mjs
git commit -m "fix(v2.1): renew expired bill notification LIFF session"
```

### Task 4: Validate the complete local candidate

**Files:**
- Verify: `apps-script/V2_BILLING_MANAGEMENT.js`
- Verify: `landlord-billing.html`
- Verify: `landlord-bill-notifications.html`
- Verify: `tests/phase139-billing-submit-lock.runtime.test.mjs`

**Interfaces:**
- Consumes: the three completed task interfaces.
- Produces: a review-ready local commit set with documented validation status.

- [ ] **Step 1: Run focused behavior coverage**

Run: `node tests/phase139-billing-submit-lock.runtime.test.mjs`

Expected: PASS for all-locked, mixed-batch, no historical write, and one-time LIFF expiry recovery behavior.

- [ ] **Step 2: Run syntax checks**

Run: `node --check apps-script/V2_BILLING_MANAGEMENT.js && node --check landlord-billing.html && node --check landlord-bill-notifications.html`

Expected: JavaScript syntax checks pass; if HTML cannot be passed directly to Node, extract only inline script blocks to a temporary read-only checker and report that method.

- [ ] **Step 3: Run repository validation when available**

Run: `npm run validate`

Expected: PASS. If `package.json` is absent from this immutable baseline, record the exact ENOENT result and do not claim this validation passed.

- [ ] **Step 4: Check diff and sensitive content**

Run: `git diff --check` and scan the diff for token, secret, raw LINE UID, and Spreadsheet-ID patterns.

Expected: no whitespace errors and no sensitive values introduced.

- [ ] **Step 5: Create one final local consolidation commit**

```bash
git add apps-script/V2_BILLING_MANAGEMENT.js landlord-billing.html landlord-bill-notifications.html tests/phase139-billing-submit-lock.runtime.test.mjs
git commit -m "fix(v2.1): protect bill creation and renew LIFF notification access"
```

If the Task 1–3 commits already exist, do not create an empty consolidation commit; report their exact SHAs instead.
