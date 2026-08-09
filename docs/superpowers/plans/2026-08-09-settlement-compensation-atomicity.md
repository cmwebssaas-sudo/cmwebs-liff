# Settlement Compensation Atomicity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make both landlord settlement flows leave only a verified, internally consistent bill/payment pair when post-write projection synchronization fails.

**Architecture:** Replace per-cell update helpers with verified whole-row read-modify-write helpers. Compensation uses saved row snapshots and permits only `unpaid bill + void payment` or `paid bill + confirmed payment`; when neither can be verified, it returns an explicit unverified-compensation error without a speculative write.

**Tech Stack:** Google Apps Script JavaScript and Node built-in runtime tests.

## Global Constraints

- Work only in `/private/tmp/cmwebs-v2_1-room506-paid-bill-correction` on `codex/v2_1-room506-paid-bill-correction`.
- Do not deploy, push, change Production data, send LINE, execute payments, add routes, add schema fields, or run migrations.
- Preserve existing authorized success and rejection envelopes; use `SETTLEMENT_COMPENSATION_UNVERIFIED` only for a post-write state that cannot be verified.
- Keep `V2_bills` canonical, retain Workspace-first access scope, legacy projection isolation, and existing paid/cancelled/voided outstanding rules.

---

## File structure

- Modify: `apps-script/V2_PAYMENT_SETTLEMENT.js` — verified row update and deterministic compensation for payment-report settlement.
- Modify: `apps-script/V2_MANUAL_SETTLEMENT.js` — same verified row update and compensation contract for manual settlement.
- Modify: `tests/phase141-paid-bill-meter-correction.runtime.test.mjs` — runtime regressions for partial update and read-back failure.
- Modify: `docs/04-API-ROUTES.md` — document the exceptional unverified-compensation response without adding a route.

### Task 1: Reproduce every unverified compensation state

**Files:**
- Modify: `tests/phase141-paid-bill-meter-correction.runtime.test.mjs`

**Interfaces:**
- Consumes: the existing payment-report and manual-settlement VM fixtures.
- Produces: failing assertions that both flows either verify a consistent pair or return `SETTLEMENT_COMPENSATION_UNVERIFIED`.

- [ ] **Step 1: Add one failing test for a partial payment-void write**

```js
assert.equal(result.code, 'SETTLEMENT_COMPENSATION_UNVERIFIED');
assert.equal(payment.status, 'void');
assert.equal(bill.payment_status, 'unpaid');
```

Configure the row fixture so the payment update writes `status: 'void'` and then throws while writing a later requested field. The test must reject any later repair that changes the bill back to paid.

- [ ] **Step 2: Run the focused test to verify RED**

Run: `node --test tests/phase141-paid-bill-meter-correction.runtime.test.mjs`

Expected: the current compensation path incorrectly reapplies a paid bill or returns a generic settlement error after an unverified state.

- [ ] **Step 3: Add one failing test for failed payment read-back after a failed void**

```js
assert.equal(result.code, 'SETTLEMENT_COMPENSATION_UNVERIFIED');
assert.equal(repairForwardWriteCount, 0);
```

Configure the payment-void update to throw before writing and the subsequent payment row lookup to throw. The test must prove the flow does not guess that payment remains confirmed or apply a speculative paid-bill repair.

- [ ] **Step 4: Add one failing test for partially failed bill restoration**

```js
assert.equal(result.code, 'SETTLEMENT_COMPENSATION_UNVERIFIED');
assert.equal(paymentVoidWriteCount, 0);
```

Configure restoring the original bill row to throw after changing one requested cell. The test must prove the flow does not void the payment when bill restoration cannot be verified.

- [ ] **Step 5: Commit failing-test-only baseline**

```bash
git add tests/phase141-paid-bill-meter-correction.runtime.test.mjs
git commit -m "test(v2): cover unverified settlement compensation"
```

### Task 2: Implement verified row writes and deterministic compensation

**Files:**
- Modify: `apps-script/V2_PAYMENT_SETTLEMENT.js`
- Modify: `apps-script/V2_MANUAL_SETTLEMENT.js`
- Modify: `tests/phase141-paid-bill-meter-correction.runtime.test.mjs`
- Modify: `docs/04-API-ROUTES.md`

**Interfaces:**
- Produces `updateSettlementRowByObjectVerified_(sheet, rowIndex, updates)` and `manualSettlementUpdateRowByObjectVerified_(sheet, rowIndex, updates)`.
- Each helper returns the verified row object or throws `SETTLEMENT_ROW_WRITE_UNVERIFIED`.

- [ ] **Step 1: Implement the payment-report verified helper**

```js
const values = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
const next = headers.map((header, index) => updates[header] === undefined ? values[index] : updates[header]);
sheet.getRange(rowIndex, 1, 1, headers.length).setValues([next]);
const verified = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
```

Compare every requested field using the module's existing text/date normalization. Throw `SETTLEMENT_ROW_WRITE_UNVERIFIED` on mismatch or read-back failure.

- [ ] **Step 2: Implement the identical contract in manual settlement**

Use the module's existing `manualSettlementText_` normalization. Do not share a new cross-file abstraction; Apps Script files already expose independent settlement helpers.

- [ ] **Step 3: Replace compensation updates only**

Use verified helpers for bill restoration, payment void, and paid-bill repair-forward. If bill restoration or payment status cannot be verified, return `SETTLEMENT_COMPENSATION_UNVERIFIED`; do not perform a further guessed repair. A verified `void` payment requires retaining the restored unpaid bill. A verified confirmed payment requires retaining or restoring the paid bill.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/phase141-paid-bill-meter-correction.runtime.test.mjs tests/phase139-billing-submit-lock.runtime.test.mjs`

Expected: both test files pass and the three new failure-state cases return only verified stable pairs or `SETTLEMENT_COMPENSATION_UNVERIFIED`.

- [ ] **Step 5: Document and commit**

```bash
git add apps-script/V2_PAYMENT_SETTLEMENT.js apps-script/V2_MANUAL_SETTLEMENT.js tests/phase141-paid-bill-meter-correction.runtime.test.mjs docs/04-API-ROUTES.md
git commit -m "fix(v2): verify settlement compensation state"
```

Run before commit: `node --check apps-script/V2_PAYMENT_SETTLEMENT.js`, `node --check apps-script/V2_MANUAL_SETTLEMENT.js`, `git diff --check`, and the focused sensitive-value scan. Attempt `npm run validate`; record its known unavailable state if `package.json` remains absent.

## Acceptance criteria

- A partial payment-void update never results in paid bill plus void payment.
- A failed read-back never triggers a guessed paid-bill repair.
- A partially failed bill restore never triggers payment voiding.
- Both settlement flows have identical verified-compensation semantics.
- Existing canonical view synchronization, scope gates, API contracts, and outstanding calculations remain intact.
- All work remains local-only and committed on the candidate branch.
