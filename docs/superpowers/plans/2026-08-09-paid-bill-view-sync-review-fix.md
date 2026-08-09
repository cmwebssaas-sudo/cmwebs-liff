# Paid Bill View-Sync Review Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Correct the two review blockers in the paid-bill view-sync candidate without changing Production data: settling an older bill must not overwrite a newer bill's summary fields, and legacy bills with an authorized landlord principal but no `workspace_id` must remain in scope.

**Architecture:** Keep `V2_bills` as canonical truth. The view-sync function continues to update the selected bill's tenant-bill view and canonical outstanding totals, but resolves display-only `latest_*` fields from the latest scoped formal bill for that tenant. A shared Workspace-first scope predicate centralizes the existing authorized-principal fallback used by legacy rows.

**Tech Stack:** Google Apps Script JavaScript, Node built-in test runner, existing CMWebs runtime test harnesses.

**Constraints:** Work only in the isolated candidate branch; do not deploy, push, change Production data, send LINE, or perform payment actions. Preserve API response compatibility and existing paid/unpaid/voided semantics.

---

## File structure

- Modify: `apps-script/V2_BILLING_MANAGEMENT.js`
  - Add a canonical access-scope predicate and a deterministic latest-bill selector.
  - Change `billingSyncBillViews_` to derive only `latest_*` summary fields from the selected latest bill.
- Modify: `apps-script/V2_PAYMENT_SETTLEMENT.js`
  - Replace strict direct workspace equality with the shared access-scope predicate before syncing a settled bill.
- Modify: `apps-script/V2_MANUAL_SETTLEMENT.js`
  - Apply the same shared access-scope predicate before syncing a manually settled bill.
- Modify: `tests/phase141-paid-bill-meter-correction.runtime.test.mjs`
  - Add runtime coverage for later-bill summary preservation and legacy authorized-principal scope.
- Modify: `docs/04-API-ROUTES.md`
  - Document that settlement synchronization preserves the latest bill summary and supports the established legacy scope fallback.

## Task 1: Centralize canonical bill access scope

**Files:**
- Modify: `apps-script/V2_BILLING_MANAGEMENT.js`
- Test: `tests/phase141-paid-bill-meter-correction.runtime.test.mjs`

- [ ] Add `billingBillMatchesAccessScope_(bill, access)` near the existing Workspace row-resolution helpers.
- [ ] Match nonblank `bill.workspace_id` only against the authenticated Workspace.
- [ ] For blank legacy `workspace_id`, match only a normalized `bill.landlord_id` present in `access.principals`; never accept a blank landlord identifier.
- [ ] Add a runtime test for: matching current Workspace, mismatched Workspace, matching legacy principal, and nonmatching legacy principal.
- [ ] Run the focused test file and verify it fails before the implementation and passes after it.

## Task 2: Preserve latest summary fields when an older bill settles

**Files:**
- Modify: `apps-script/V2_BILLING_MANAGEMENT.js`
- Test: `tests/phase141-paid-bill-meter-correction.runtime.test.mjs`

- [ ] Add `billingSelectLatestTenantBill_(tenantBills)` with deterministic comparison by normalized bill month and row-number fallback.
- [ ] In `billingSyncBillViews_`, keep the selected `bill` for the exact tenant-bill view update, totals, and payment state synchronization.
- [ ] Resolve `latestBill` from all scoped canonical bills for that tenant and use it only for tenant-home and landlord-list `latest_*` display fields.
- [ ] Add an integration-style runtime harness with an older paid July bill and a newer August bill; assert that syncing July updates the July view but leaves latest bill month, amount, due date, and status derived from August.
- [ ] Assert canonical outstanding totals continue to exclude paid and voided/cancelled bills.

## Task 3: Apply the scope predicate to both settlement flows

**Files:**
- Modify: `apps-script/V2_PAYMENT_SETTLEMENT.js`
- Modify: `apps-script/V2_MANUAL_SETTLEMENT.js`
- Test: `tests/phase141-paid-bill-meter-correction.runtime.test.mjs`

- [ ] Replace each new direct workspace-id comparison with `billingBillMatchesAccessScope_`.
- [ ] Preserve current fail-closed behavior when the authenticated actor lacks scope.
- [ ] Add static and runtime assertions that both paths invoke the shared predicate before `billingSyncBillViews_`.
- [ ] Verify a blank-workspace legacy bill remains eligible only through an authorized principal and cannot cross Workspace boundaries.

## Task 4: Document and validate the candidate

**Files:**
- Modify: `docs/04-API-ROUTES.md`
- Test: `tests/phase141-paid-bill-meter-correction.runtime.test.mjs`
- Test: `tests/phase139-billing-submit-lock.runtime.test.mjs`

- [ ] Document no API route additions; clarify the existing paid-settlement sync invariant and legacy compatibility rule.
- [ ] Run `node --test tests/phase141-paid-bill-meter-correction.runtime.test.mjs tests/phase139-billing-submit-lock.runtime.test.mjs`.
- [ ] Run syntax checks for `V2_BILLING_MANAGEMENT.js`, `V2_PAYMENT_SETTLEMENT.js`, and `V2_MANUAL_SETTLEMENT.js`.
- [ ] Run `npm run validate`, record the known missing-`package.json` limitation if it remains unavailable, and do not report it as a pass.
- [ ] Run `git diff --check` and the existing sensitive-value scan.
- [ ] Commit only the reviewed candidate files on the isolated branch; do not push or update PR #16 without separate authorization.

## Acceptance criteria

- Settling an older bill never regresses a tenant's or landlord list's newer `latest_*` summary fields.
- The exact paid bill view is synchronized from canonical truth.
- Current Workspace rows require an exact Workspace match.
- Blank-workspace legacy rows require a matching authorized principal and never bypass access control.
- Paid, cancelled, and voided bills remain excluded from outstanding calculations.
- Existing public routes and response envelopes remain unchanged.
- No Production system, Google Sheets row, deployment, GitHub remote branch, LINE message, or payment is changed.
