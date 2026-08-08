# August Billing Payment-Report Resilience — Implementation Plan

> **Execution constraint:** Work only in `/private/tmp/cmwebs-v2_1-august-billing-fix` on branch `codex/v2_1-august-billing-fix`. This plan is local-only: do not deploy Apps Script, publish GitHub Pages, modify Production Sheets/Properties/triggers, send LINE, run payments, or push Git.

**Goal:** Fix two verified code defects behind the August billing incidents without changing the already-issued 506 bill: payment reporting must resolve the tenant/landlord relationship from canonical runtime data instead of the broken `V2_landlord_tenant_list_view`, and tenant bill detail must render decimal unit rates such as `3.5` without rounding them to `4`.

**Architecture:** `resolveCanonicalTenantRuntimeByLineUid_()` already establishes the authoritative tenant → active contract → room → property → workspace → landlord chain. `submitTenantPaymentReportByLineUid_()` will consume that result and verify the requested bill against the same canonical identifiers. The frontend will gain a rate-specific formatter while retaining the existing rounded-currency formatter for money totals.

**Tech Stack:** Google Apps Script JavaScript, static GitHub Pages HTML, Node built-in `node:test` / `node:vm` regression harnesses.

---

## Scope guard

- The 506 August bill is already paid. This change must not regenerate, cancel, overwrite, or otherwise repair any bill data.
- No new API route, sheet, Property, trigger, token, or schema column is needed.
- `V2_landlord_tenant_list_view` remains a compatibility/reporting view; it must not be a required authority for tenant payment submission.
- Existing payment duplicate protection, paid/cancelled exclusion, RBAC/workspace boundaries, notification semantics, and response envelopes remain intact.

## Task 1: Add a canonical payment-report context adapter

**Files:**
- Modify: `apps-script/V2_TENANT_PAYMENT_REPORTS.js`
- Modify: `apps-script/V2_TENANT_RUNTIME_RESOLVER.js` (allow only the canonical payment-report projection to omit the optional compatibility view)
- Test: `tests/phase140-tenant-payment-report-canonical-context.runtime.test.mjs`

### Step 1: Write failing runtime cases

Create a focused Node/VM test that evaluates the payment-report module with stubs for sheet reads, report appends, canonical resolver, and team notification.

Required failing cases:

1. A valid canonical tenant context may submit an unpaid bill even when a read of `V2_landlord_tenant_list_view` would fail or return no matching row.
2. The appended report and `workspaceNotifyTeam_` call use the resolver’s `workspace_id`, `landlord_id`, and landlord LINE fallback, rather than view-derived values.
3. A bill whose `tenant_id`, `contract_id`, `room_id`, or `workspace_id` conflicts with the canonical context returns `BILL_NOT_FOUND` and appends no report.
4. A resolver failure is returned as its explicit error envelope and appends no report.
5. Existing `BILL_CANCELLED`, `BILL_ALREADY_PAID`, and `PAYMENT_REPORT_ALREADY_PENDING` paths remain write-free.

Run:

```bash
node --test tests/phase140-tenant-payment-report-canonical-context.runtime.test.mjs
```

Expected initially: failures proving the current module still reads the landlord-tenant list view and cannot canonicalize the relationship.

### Step 2: Implement the adapter

In `apps-script/V2_TENANT_PAYMENT_REPORTS.js`:

1. Add a small private helper beside the existing module helpers, for example `tenantPaymentReportResolveCanonicalContext_(lineUserId)`.
2. Call `resolveCanonicalTenantRuntimeByLineUid_(lineUserId, { include_bill_master: false })` exactly once for submission identity.
3. Preserve the resolver’s `success`, `code`, and `message` on failure by returning the existing `tenantPaymentReportResult_` envelope; do not turn a resolver failure into a successful no-data state.
4. Remove the submission path’s mandatory `V2_landlord_tenant_list_view` read and its `TENANT_LANDLORD_LINK_NOT_FOUND` failure. Remove the corresponding sheet constant only after confirming it has no other module consumers.
5. Build report identity fields from the canonical context: `workspace_id` for notifications, and the canonical landlord, tenant, contract, room, property, and LINE identities where those fields are already represented in the report/notification payload.
6. Match `V2_tenant_bill_view` only when the requested `bill_id`, request LINE UID, tenant ID, contract ID, room ID, and workspace ID agree with the canonical context. The view is expected to include billing master headers via `billingBillViewHeaders_()`.
7. Keep the existing checks in their current behavioral order after the canonical bill is resolved: cancelled/voided, paid, pending report, append, and notification.
8. Keep `workspaceNotifyTeam_` optional and preserve its current non-fatal push-result behavior; pass the canonical workspace/landlord context to it.

### Step 3: Re-run focused tests

```bash
node --test tests/phase140-tenant-payment-report-canonical-context.runtime.test.mjs
```

Expected: all five cases pass, including no append/notification when canonical identity or bill linkage fails.

## Task 2: Preserve fractional display for per-unit rates

**Files:**
- Modify: `tenant-bills.html`
- Test: `tests/phase140-tenant-bill-rate-format.test.mjs`

### Step 1: Write failing formatter/UI cases

Create a focused static/VM test that extracts the formatting helpers from `tenant-bills.html` and verifies:

1. Currency totals remain rounded: `money(806.75)` renders `NT$ 807`.
2. Per-unit values preserve stored fractions without padding: `3.5` renders `NT$ 3.5`; `3` renders `NT$ 3`.
3. The electricity and equipment detail labels and their calculation explanations use the new rate formatter, while total amounts continue using `money()`.

Run:

```bash
node --test tests/phase140-tenant-bill-rate-format.test.mjs
```

Expected initially: the `3.5` assertion fails because `money()` rounds it to `NT$ 4`.

### Step 2: Implement a rate-only formatter

In `tenant-bills.html`:

1. Keep `money(value)` unchanged for total monetary amounts.
2. Add a local, named formatter such as `unitRateMoney(value)` immediately next to `money()`. It must use the existing numeric normalization and `zh-TW` formatting with `minimumFractionDigits: 0` and a bounded non-zero maximum fraction precision.
3. Replace only per-unit rate output in bill detail: `每度電費`, `每度設備費`, and each corresponding `度 × 單價` calculation sentence.
4. Do not change input data, stored rate values, total-charge rounding, payment workflow, bill filtering, or page endpoint configuration.

### Step 3: Re-run focused tests

```bash
node --test tests/phase140-tenant-bill-rate-format.test.mjs
```

Expected: rate display preserves `3.5`, while the existing equipment amount remains `NT$ 807` for `230.5 × 3.5`.

## Task 3: Document the compatibility change

**Files:**
- Modify: `docs/04-API-ROUTES.md`
- Modify: `docs/superpowers/specs/2026-08-08-august-billing-payment-report-design.md` only if implementation decisions require a correction to the approved design

### Step 1: Record route behavior

Under the existing route list, document that `tenant_payment_report_submit` resolves tenant/contract/room/workspace/landlord identity via the canonical tenant runtime resolver, treats a missing compatibility view row as non-authoritative, and returns explicit error envelopes on identity or bill-link mismatch.

### Step 2: Record display contract

Document that the tenant bill page formats totals as whole Taiwan-dollar currency but renders per-unit electricity/equipment rates without discarding stored fractions.

### Step 3: Check scope

Ensure docs do not expose raw LINE UIDs, tokens, spreadsheet IDs, or tenant personal data.

## Task 4: Full local verification and review

**Files:**
- Verify only all files above, including `apps-script/V2_TENANT_RUNTIME_RESOLVER.js`.

### Step 1: Run focused tests and static syntax checks

```bash
node --test tests/phase140-tenant-payment-report-canonical-context.runtime.test.mjs
node --test tests/phase140-tenant-bill-rate-format.test.mjs
node --check apps-script/V2_TENANT_PAYMENT_REPORTS.js
node --check apps-script/V2_TENANT_RUNTIME_RESOLVER.js
git diff --check
```

For HTML JavaScript syntax, use the same extraction/VM path exercised by the formatter test rather than pretending `node --check` can parse a complete HTML document.

### Step 2: Validate the repository command honestly

```bash
npm run validate
```

This isolated worktree has no `package.json`; therefore this command cannot be used as validation evidence here. Record that fact explicitly rather than borrowing the dirty root worktree or claiming a pass. Run any project-provided equivalent only if it exists in this worktree.

### Step 3: Review the diff

```bash
git status --short
git diff --check
git diff -- apps-script/V2_TENANT_PAYMENT_REPORTS.js apps-script/V2_TENANT_RUNTIME_RESOLVER.js tenant-bills.html docs/04-API-ROUTES.md tests/phase140-tenant-payment-report-canonical-context.runtime.test.mjs tests/phase140-tenant-bill-rate-format.test.mjs
```

Acceptance conditions:

- Only the minimal backend, frontend formatter, API documentation, and focused tests change.
- No `V2_bills` data migration, no changes to billing creation, no changes to payment confirmation, and no real notifications occur.
- Canonical identity failures fail closed with their explicit error code/message.
- Workspace and tenant/contract/room/bill joins reject mismatches.
- Decimal rate display changes only the visible unit-rate text, not charge totals.

## Task 5: Local-only candidate commit and handoff

**Files:** all verified Task 1–3 files, including
`apps-script/V2_TENANT_RUNTIME_RESOLVER.js`.

### Step 1: Commit only after verification

```bash
git add apps-script/V2_TENANT_PAYMENT_REPORTS.js apps-script/V2_TENANT_RUNTIME_RESOLVER.js tenant-bills.html docs/04-API-ROUTES.md tests/phase140-tenant-payment-report-canonical-context.runtime.test.mjs tests/phase140-tenant-bill-rate-format.test.mjs
git commit -m "fix(v2.1): harden August billing payment reporting"
```

### Step 2: Handoff requirements

Report:

- the exact local commit SHA and changed-file scope;
- focused test and syntax results, plus the explicit `npm run validate` limitation;
- that no Apps Script deployment, GitHub Pages publication, Git push, LINE message, payment action, or Production data change occurred;
- recommended separately authorized follow-up: review candidate, then a controlled Production preflight/deployment only after the 506 data correction decision has its own approval.

## Rollback

Because this plan is local-only, rollback before deployment is `git revert <candidate-commit>` or abandonment of the isolated branch. Do not use this code change as authority to alter the paid 506 bill or any Production data.
