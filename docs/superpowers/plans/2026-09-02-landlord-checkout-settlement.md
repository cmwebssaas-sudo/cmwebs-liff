# Landlord Checkout Settlement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a landlord-only checkout settlement that calculates prior unpaid utility charges, move-out-month rent and meter-based utility charges, records two meter photos, and calculates deposit offset/refund before closing the tenancy.

**Architecture:** Extend the existing landlord checkout lifecycle with a focused settlement calculator and an append-only `V2_checkout_settlements` sheet. Reuse the existing private Drive contract-document upload path for two new meter-photo types, but expose it through the verified landlord session exchange. The completion endpoint recomputes the settlement server-side, appends one settlement snapshot, and then performs the existing idempotent checkout state transition under the same ScriptLock.

**Tech Stack:** Google Apps Script, Google Sheets, Google Drive private files, static HTML/LIFF, Node.js `node:test` runtime and static tests.

**Spec:** `docs/superpowers/specs/2026-09-02-landlord-checkout-settlement-design.md`

## Global Constraints

- 9/7 is an occupied day; the settlement period is 9/1–9/7 inclusive, seven days.
- Previous-month carryover includes only the unpaid electricity and equipment amounts; it does not add previous-month rent.
- Current rent uses `monthly rent × occupied days ÷ calendar days in the move-out month`, rounded to whole TWD.
- Current electricity and equipment amounts use `end meter - start meter` and the existing contract/month settings rates, not day proration.
- Deposit deduction is between 0 and the contract deposit snapshot; a positive deduction requires a landlord note.
- Original contracts and existing monthly bills are immutable; settlement data is append-only and stores source IDs/snapshots.
- All settlement and checkout writes require the verified landlord session, Workspace scope, membership policy, and one ScriptLock.
- Meter photos are JPG/PNG only, stored privately through the existing Drive document path, and never exposed as public URLs.
- Do not create version-suffixed production filenames, expose secrets, send tenant LINE messages, or deploy during implementation unless separately authorized.

---

### Task 1: Add the failing settlement calculation contract

**Files:**
- Modify: `tests/phase202-landlord-led-renewal-checkout.runtime.test.mjs`
- Create: `tests/phase205-landlord-checkout-settlement.runtime.test.mjs`

**Interfaces:**
- Produces the test contract for `landlordContractCheckoutSettlementCalculate_` and `landlordContractCheckoutSettlementValidateInput_`.
- The calculator accepts `{ contract, previousBill, moveOutDate, startMeterReading, endMeterReading, depositDeductionAmount }` and returns a numeric settlement snapshot or a structured error.

- [ ] **Step 1: Write the failing calculation test**

Add a VM test that loads the existing checkout source and calls the not-yet-defined calculator with this deterministic case:

```js
const result = context.landlordContractCheckoutSettlementCalculate_({
  contract: {
    start_date: '2025-09-01',
    rent_amount: 7500,
    deposit_amount: 15000,
    electricity_fee_rate: 3,
    equipment_fee_rate: 3.5
  },
  previousBill: {
    bill_id: 'bill-2026-08-506',
    bill_month: '2026-08',
    payment_status: 'unpaid',
    electricity_amount: 120,
    equipment_amount: 80
  },
  moveOutDate: '2026-09-07',
  startMeterReading: 100,
  endMeterReading: 110,
  depositDeductionAmount: 500
});

assert.equal(result.success, true, result.code);
assert.deepEqual(result.data, {
  settlement_start_date: '2026-09-01',
  move_out_date: '2026-09-07',
  rent_days: 7,
  days_in_month: 30,
  rent_amount: 1750,
  start_meter_reading: 100,
  end_meter_reading: 110,
  electricity_usage: 10,
  electricity_amount: 30,
  equipment_amount: 35,
  previous_electricity_amount: 120,
  previous_equipment_amount: 80,
  subtotal_amount: 2015,
  deposit_amount: 15000,
  deposit_deduction_amount: 500,
  deposit_refund_amount: 14500,
  tenant_balance_due: 1515
});
```

- [ ] **Step 2: Run the focused test and confirm the expected RED failure**

Run:

```bash
node --test tests/phase205-landlord-checkout-settlement.runtime.test.mjs
```

Expected: FAIL because `landlordContractCheckoutSettlementCalculate_` is not defined. Do not change production code before capturing this failure.

- [ ] **Step 3: Add validation cases to the same failing test**

Assert that the input validator rejects an end meter below the start meter, a move-out date before the lease start, a deduction above the deposit snapshot, and a missing deduction note when the deduction is positive. Assert that a paid or absent previous bill contributes zero previous utility amounts.

- [ ] **Step 4: Run the focused test again and confirm all new assertions remain RED**

Run the same command and confirm the failure remains in the missing production interface rather than a test typo.

- [ ] **Step 5: Commit the test contract**

```bash
git add tests/phase205-landlord-checkout-settlement.runtime.test.mjs
git commit -m "test: define landlord checkout settlement rules"
```

### Task 2: Implement the pure calculator and additive settlement schema

**Files:**
- Modify: `apps-script/V2_CONTRACT_CHECKOUT.js`
- Modify: `tests/phase205-landlord-checkout-settlement.runtime.test.mjs`

**Interfaces:**
- Produces `landlordContractCheckoutSettlementCalculate_`, `landlordContractCheckoutSettlementValidateInput_`, `landlordContractCheckoutSettlementPreviousUtility_`, and `landlordContractCheckoutSettlementDaysInMonth_`.
- Produces `V2_CHECKOUT_SETTLEMENT_SHEET_`, `V2_CHECKOUT_SETTLEMENT_HEADERS_`, `landlordContractCheckoutSettlementEnsureSheet_`, and `runV2CheckoutSettlementProductionMigration`.

- [ ] **Step 1: Implement date and amount helpers only for the failing calculator**

Use ISO `YYYY-MM-DD` parsing with UTC calendar arithmetic. Set the settlement start to the first day of the move-out month, count both endpoints, calculate calendar days in that month, round monetary components to whole TWD, and reject invalid or decreasing meter readings.

- [ ] **Step 2: Implement previous-bill component selection**

Return the previous bill's `electricity_amount` and `equipment_amount` only when `bill_month` is the immediately preceding calendar month and `payment_status` is not `paid`, `confirmed`, `cancelled`, `canceled`, `void`, or `voided`. Return zeroes when no eligible bill exists. Never copy previous rent or management fee.

- [ ] **Step 3: Implement deposit calculations**

Use the contract's `deposit_amount` as the snapshot. Reject a deduction below zero or above the snapshot, require `deposit_deduction_note` for a positive deduction, then return:

```js
subtotal_amount = previousElectricity + previousEquipment + rent + electricity + equipment;
tenant_balance_due = Math.max(0, subtotal_amount - depositDeduction);
deposit_refund_amount = Math.max(0, depositAmount - depositDeduction);
```

- [ ] **Step 4: Add the append-only settlement headers and migration**

Define the exact headers from the approved spec, create `V2_checkout_settlements` only when missing, append missing headers without reordering existing columns, and return `{ success, code, data: { sheet, added_headers } }`. The migration must not read or write contract/bill rows.

- [ ] **Step 5: Run the focused runtime test and confirm GREEN**

Run:

```bash
node --test tests/phase205-landlord-checkout-settlement.runtime.test.mjs
```

Expected: all calculator, previous-component, validation, deposit, and schema-helper assertions pass.

- [ ] **Step 6: Commit the calculator and schema**

```bash
git add apps-script/V2_CONTRACT_CHECKOUT.js tests/phase205-landlord-checkout-settlement.runtime.test.mjs
git commit -m "feat: calculate landlord checkout settlement"
```

### Task 3: Add authenticated init, preview, and settlement persistence

**Files:**
- Modify: `apps-script/V2_CONTRACT_CHECKOUT.js`
- Modify: `apps-script/V2_LANDLORD_INITIATED_CONTRACTS.js`
- Modify: `tests/phase205-landlord-checkout-settlement.runtime.test.mjs`

**Interfaces:**
- Produces `landlordContractCheckoutSettlementInitBySession_`, `landlordContractCheckoutSettlementPreviewBySession_`, `landlordContractCheckoutSettlementApplyUnlocked_`, and `landlordContractCheckoutSettlementResult_`.
- Adds actions `landlord_contract_checkout_settlement_init` and `landlord_contract_checkout_settlement_preview` to the existing landlord exchange allow-list and dispatcher.

- [ ] **Step 1: Write the failing init/preview/persistence assertions**

Extend the fake-sheet runtime with `V2_bills` and `V2_checkout_settlements`. Assert init returns the scoped contract, `settlement_start_date`, prior bill component values, deposit snapshot, rates, and no mutation. Assert preview returns the exact 506 calculation and leaves settlement rows empty. Assert a completion helper appends one settlement row with source bill ID and all calculated amounts.

- [ ] **Step 2: Run the test and confirm RED**

Run the focused Phase 205 test. Expected: the new session/init or persistence interface is missing.

- [ ] **Step 3: Implement scoped source loading**

Reuse `landlordContractCheckoutAccessFromSession_`, `landlordContractCheckoutFindContract_`, room/tenant scope checks, and the existing sibling validation. Read `V2_bills` by the same Workspace, room, tenant, contract, and immediately preceding month; do not return unrelated bills. Locate an existing settlement by `contract_id` and Workspace and return it idempotently when already completed.

- [ ] **Step 4: Implement preview without writes**

Normalize the preview input, call the pure calculator, attach `previous_bill_id`, `previous_bill_month`, rates, and source metadata, and return the settlement snapshot. Do not append rows, update contracts, update bills, or send LINE.

- [ ] **Step 5: Implement append-only settlement persistence**

Inside the existing checkout ScriptLock, re-read the contract, room, tenant, prior bill, and settlement sheet. Recompute the exact snapshot, require both meter document IDs, reject mismatched Workspace/contract IDs, append one `completed` settlement row with the supplied idempotency key, and return the persisted summary.

- [ ] **Step 6: Run Phase 205 and the existing Phase 202 runtime tests**

Run:

```bash
node --test tests/phase205-landlord-checkout-settlement.runtime.test.mjs tests/phase202-landlord-led-renewal-checkout.runtime.test.mjs
```

Expected: both pass, including legacy checkout lifecycle behavior until the new completion guard is added in Task 5.

- [ ] **Step 7: Commit init, preview, and persistence**

```bash
git add apps-script/V2_CONTRACT_CHECKOUT.js apps-script/V2_LANDLORD_INITIATED_CONTRACTS.js tests/phase205-landlord-checkout-settlement.runtime.test.mjs
git commit -m "feat: add checkout settlement preview and persistence"
```

### Task 4: Add private meter-photo evidence through the verified session

**Files:**
- Modify: `apps-script/V2_LANDLORD_CONTRACT_DOCUMENTS.js`
- Modify: `apps-script/V2_CONTRACT_CHECKOUT.js`
- Modify: `apps-script/V2_LANDLORD_INITIATED_CONTRACTS.js`
- Modify: `tests/phase205-landlord-checkout-settlement.runtime.test.mjs`

**Interfaces:**
- Produces `landlordContractCheckoutEvidenceUploadBySession_`.
- Adds action `landlord_contract_checkout_evidence_upload` to the landlord exchange allow-list and dispatcher.
- Adds private document types `checkout_start_meter` and `checkout_end_meter` while retaining all existing types and the 8 MB JPG/PNG limits.

- [ ] **Step 1: Write failing evidence assertions**

Assert the source exposes both document types, the new action, session-based access, and rejects an unsupported document type. Assert the settlement completion fixture cannot proceed when either document ID is missing.

- [ ] **Step 2: Run the focused test and confirm RED**

Run the Phase 205 test and confirm the new types/action/helper are absent or the required evidence guard fails.

- [ ] **Step 3: Extend the existing private document type list**

Add only `checkout_start_meter` and `checkout_end_meter` to `LD_CONTRACT_DOCUMENT_TYPES_`. Keep Drive files private, preserve SHA-256 and idempotency behavior, and do not expose Drive IDs in general tenant responses.

- [ ] **Step 4: Implement the session wrapper**

Verify the landlord session with read/write policy, validate the requested contract and tenant scope, require one of the two checkout types, and delegate the bytes to `uploadLandlordContractDocumentByLineUid_` using the verified access line subject. The wrapper must not accept a client-supplied landlord ID or Workspace as authority.

- [ ] **Step 5: Run the focused evidence test and confirm GREEN**

Run:

```bash
node --test tests/phase205-landlord-checkout-settlement.runtime.test.mjs
```

Expected: evidence type, action, authorization, and required-document assertions pass.

- [ ] **Step 6: Commit the evidence upload boundary**

```bash
git add apps-script/V2_LANDLORD_CONTRACT_DOCUMENTS.js apps-script/V2_CONTRACT_CHECKOUT.js apps-script/V2_LANDLORD_INITIATED_CONTRACTS.js tests/phase205-landlord-checkout-settlement.runtime.test.mjs
git commit -m "feat: store private checkout meter evidence"
```

### Task 5: Require settlement and evidence before completing checkout

**Files:**
- Modify: `apps-script/V2_CONTRACT_CHECKOUT.js`
- Modify: `tests/phase202-landlord-led-renewal-checkout.runtime.test.mjs`
- Modify: `tests/phase205-landlord-checkout-settlement.runtime.test.mjs`

**Interfaces:**
- Changes `landlordContractCheckoutCompleteBySession_` so new completion requests require a valid settlement input, two stored meter document IDs, and the server-side recomputation before the existing contract/room/tenant updates.
- Retains same-key idempotent replay and rejects old no-settlement writes with `CHECKOUT_SETTLEMENT_REQUIRED`.

- [ ] **Step 1: Write the failing completion guard and integration tests**

Update Phase 202's successful completion fixture to include a settlement payload and two evidence IDs. Add assertions that no-settlement completion fails without changing any sheet row, successful completion appends one settlement and clears pointers, a second identical request returns `IDEMPOTENT`, a different key returns `CHECKOUT_ALREADY_COMPLETED`, and no tenant LINE message is sent.

- [ ] **Step 2: Run the affected tests and confirm RED**

Run:

```bash
node --test tests/phase202-landlord-led-renewal-checkout.runtime.test.mjs tests/phase205-landlord-checkout-settlement.runtime.test.mjs
```

Expected: the updated success fixture fails because the production completion path does not yet require/apply settlement data.

- [ ] **Step 3: Implement the completion guard and transaction order**

Validate the idempotency key and existing completed state first. For a new operation, require settlement fields and document IDs, re-read all scoped rows, run the calculator, append the settlement snapshot, then update contract/room/tenant/views using the existing checkout logic. If validation fails, do not write the settlement or lifecycle rows.

- [ ] **Step 4: Return settlement summary in the completion response**

Include `settlement_id`, `subtotal_amount`, `deposit_deduction_amount`, `tenant_balance_due`, and `deposit_refund_amount` in the safe response. Keep `access` internal to audit logging and never return document Drive IDs beyond the two opaque document references needed by the settlement UI.

- [ ] **Step 5: Run the affected tests and confirm GREEN**

Run the Phase 202 and Phase 205 commands from Step 2. Expected: both pass with the legacy no-write boundary and new settlement-required behavior.

- [ ] **Step 6: Commit the checkout integration**

```bash
git add apps-script/V2_CONTRACT_CHECKOUT.js tests/phase202-landlord-led-renewal-checkout.runtime.test.mjs tests/phase205-landlord-checkout-settlement.runtime.test.mjs
git commit -m "feat: require settlement before landlord checkout"
```

### Task 6: Build the mobile checkout settlement UI

**Files:**
- Modify: `landlord-tenant-checkout.html`
- Create: `tests/phase206-landlord-checkout-settlement.ui.test.mjs`

**Interfaces:**
- Consumes the session exchange actions from Tasks 3–5 and the existing `frontend-release.js` cache key.
- Produces a single mobile flow with date, meter, photo, deposit, preview, and completion controls.

- [ ] **Step 1: Write the failing UI contract test**

Assert the page includes settlement init/preview/evidence actions, labels for `9/1 電表度數`, `退房日電表度數`, two meter photo inputs, `押金扣除`, `應補繳`, `押金應退`, and the seven-day inclusive copy. Assert the complete request includes settlement fields and both document IDs. Assert there is no old direct completion payload that omits settlement data.

- [ ] **Step 2: Run the UI test and confirm RED**

Run:

```bash
node --test tests/phase206-landlord-checkout-settlement.ui.test.mjs
```

Expected: FAIL because the current page has only the move-out date and note fields.

- [ ] **Step 3: Add settlement state and load/preview calls**

Load settlement init after checkout init. Default the settlement start date to the first day of the selected move-out month. Re-render preview values on date, meter, and deduction changes while keeping the current mobile shell and safe-area rules.

- [ ] **Step 4: Add meter inputs and private photo uploads**

Use `accept="image/jpeg,image/png"`, compress images with the existing canvas pattern, upload each file through the session exchange, retain only the returned opaque document ID, and show upload success/error states. Do not permit completion until both photos and both readings are valid.

- [ ] **Step 5: Add deposit summary and completion payload**

Render prior utilities, current rent, current utilities, subtotal, deposit snapshot, deduction input/note, balance due, and refund. On completion send the move-out date, readings, deduction, note, two document IDs, and idempotency key; display the returned settlement summary before navigating back.

- [ ] **Step 6: Run the UI test and affected runtime tests**

Run:

```bash
node --test tests/phase206-landlord-checkout-settlement.ui.test.mjs tests/phase202-landlord-led-renewal-checkout.runtime.test.mjs tests/phase205-landlord-checkout-settlement.runtime.test.mjs
```

Expected: all pass.

- [ ] **Step 7: Commit the mobile UI**

```bash
git add landlord-tenant-checkout.html tests/phase206-landlord-checkout-settlement.ui.test.mjs
git commit -m "feat: add checkout settlement mobile form"
```

### Task 7: Update API documentation, test matrix, release notes, and validate

**Files:**
- Modify: `docs/04-API-ROUTES.md`
- Modify: `docs/09-TEST-MATRIX.md`
- Modify: `docs/CMWEBS_CHANGELOG.md`
- Modify: `docs/CMWEBS_CURRENT_STATE.md`
- Modify: `docs/CMWEBS_V2_1_CODEX_EXECUTION_RECORD.md`
- Modify: `tests/phase207-landlord-checkout-settlement.docs.test.mjs`

**Interfaces:**
- Documents the three new settlement/evidence actions and the changed checkout completion contract.
- Records the release as a local candidate only until a separately authorized Production deployment.

- [ ] **Step 1: Write the failing documentation test**

Assert the API document lists the new actions, the test matrix includes Phase 205/206, and the changelog includes the exact settlement rule and `HUMAN_REQUIRED` boundary. Run it and confirm RED before changing docs.

- [ ] **Step 2: Update API and matrix documentation**

Add the actions to the landlord route inventory without changing the JSONP route count unless the validator proves otherwise. Document the additive sheet and two private document types, the 9/1–move-out inclusive period, and that old no-settlement completion requests fail closed.

- [ ] **Step 3: Update authoritative current-state and changelog records**

Record the local candidate branch/commit evidence, test results, migration function, and the fact that no Production Sheet, Drive, contract, or tenant data has been changed. Keep authenticated LINE/mobile/file-upload UAT `HUMAN_REQUIRED` / `UNVERIFIED`.

- [ ] **Step 4: Implement and run the docs test**

Run:

```bash
node --test tests/phase207-landlord-checkout-settlement.docs.test.mjs
```

Expected: PASS with all documented routes and constraints present.

- [ ] **Step 5: Run repository validation and the full suite**

Run:

```bash
node /Users/hans/CMWebs/cmwebs-liff/scripts/validate-project.js --root /Users/hans/CMWebs/cmwebs-liff/.worktrees/simplify-expired-renewal-signing-20260901 --apps-dir apps-script --html-dir . --expected-routes 83
node --test tests/*.test.mjs
git diff --check
```

Expected: validation PASS with 83/83 route/handler coverage, no duplicate declarations or credential findings, and the complete suite green.

- [ ] **Step 6: Commit documentation and verification updates**

```bash
git add docs/04-API-ROUTES.md docs/09-TEST-MATRIX.md docs/CMWEBS_CHANGELOG.md docs/CMWEBS_CURRENT_STATE.md docs/CMWEBS_V2_1_CODEX_EXECUTION_RECORD.md tests/phase207-landlord-checkout-settlement.docs.test.mjs
git commit -m "docs: record landlord checkout settlement candidate"
```

### Task 8: Prepare the release handoff without deploying

**Files:**
- Modify: `frontend-release.js`
- Modify: `landlord-tenant-checkout.html`

- [ ] **Step 1: Bump the frontend cache key only after all UI tests pass**

Use the repository's existing release-key format, update the checkout page reference if it contains a hardcoded fallback, and verify the key test remains green. Do not publish Pages or Apps Script in this task.

- [ ] **Step 2: Run the final validator, full test suite, and Git state checks**

Run the commands from Task 7, then inspect `git status --short --branch`, `git log -5 --oneline`, and the release diff. Report the exact branch, commits, changed files, test totals, migration function, and the separate deployment steps/rollback target for a later explicit release request.

- [ ] **Step 3: Commit the release handoff**

```bash
git add frontend-release.js landlord-tenant-checkout.html
git commit -m "chore: prepare checkout settlement release"
```
