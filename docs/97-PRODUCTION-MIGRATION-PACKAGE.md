# Phase 97 — Production Migration Package

Date: 2026-07-23  
Decision: **PLANNING ONLY — NO PRODUCTION DEPLOYMENT AUTHORIZED**

## Scope and Safety Boundary

This package converts the Phase 96 release-gate findings into an ordered
migration and rollback checklist. It does not change Production Apps Script,
Google Sheets, Script Properties, LINE configuration, Web App deployment, or
frontend hosting.

The only implementation included in Phase 97 is a **staging-only** tenant
binding reconciliation classifier in
`release/staging/frontend/tenant-bind.html`. It preserves the existing route
contract: an ambiguous timeout performs one read-only
`tenant_binding_status` reconciliation and never resubmits
`tenant_bind_submit` automatically.

## Phase 83 Binding Reconciliation Classifier

### Delivered staging correction

- Added `classifyBindingReconciliation_(statusResult)` as a pure function.
- `BOUND` requires a successful status response with `code=BOUND`,
  `bound=true`, and `account_active=true`.
- `UNBOUND` remains explicitly retryable.
- All other results remain fail-closed as `UNKNOWN`.
- Added a single-flight `BINDING_SUBMIT_PROMISE` guard to prevent repeated
  clicks from issuing concurrent mutations.
- Transport ambiguity is reconciled through the existing read-only
  `tenant_binding_status` route only; it does not retry the binding mutation.

### Validation

`phase83-binding-critical-path.test.js`: **PASS** after the change. The
fixture confirms single-flight behavior, no duplicate mutation request, and
the two expected reconciliation outcomes.

This correction is not deployed. It must be copied only through a reviewed,
isolated Production frontend artifact after all gates below are closed.

## Staging vs Production Schema Diff

The canonical Production backend contains 34 JavaScript modules; the staging
backend contains 48. Staging therefore has 18 modules outside the Production
baseline. Several modules use additive headers on existing Sheets, while
others create entirely new Sheets.

| Classification | Staging schema/module | Production impact | Migration decision |
| --- | --- | --- | --- |
| Required only when enabling authenticated notification delivery | `V2_NOTIFICATION_QUEUE`, `V2_NOTIFICATION_TEMPLATES`, `V2_NOTIFICATION_SERVICE` | New `V2_NOTIFICATION_QUEUE` sheet; durable retry, dedupe, and provider outcome fields. | Additive migration only; pre-create and validate headers; feature disabled until worker/trigger proof exists. |
| Required only when enabling LINE identity-security failure capture | `V2_LINE_IDENTITY_SECURITY`, `V2_SECURITY_FAILURE_QUEUE`, `V2_RBAC` | New `V2_SECURITY_FAILURE_QUEUE` sheet and server-side authorization dependency. | Security review required. Do not enable until Production LINE/OAuth configuration and all role routes are audited. |
| Optional lifecycle expansion | `V2_CONTRACTS` | Additive lifecycle fields on existing `V2_contracts`, including audit timestamps and expiry-notification references. | Separate approved migration; retain legacy columns and existing route compatibility. |
| Optional lifecycle expansion | `V2_BILLS`, `V2_PAYMENTS` | Additive lifecycle fields on existing `V2_bills` and `V2_payments`, plus billing worker dependency. | Separate approved migration; validate old bills/payments before enabling. |
| Optional workflow | `V2_REPAIR_TICKETS` | New `V2_REPAIR_TICKETS` sheet. | Out of current V2 consolidation scope unless an explicit product decision approves it. |
| Optional workflow | `V2_MOVE_OUT_REQUESTS`, `V2_DEPOSIT_SETTLEMENTS`, `V2_SETTLEMENT_TRANSACTION` | New move-out, settlement, and `V2_SETTLEMENT_LEDGER` sheets; repair/bill dependencies. | Out of current V2 consolidation scope unless separately approved. Requires financial migration review. |
| Migration / environment support | `V2_ENVIRONMENT_CONFIGURATION`, `V2_RUNTIME_ENVIRONMENT`, `V2_SECURITY_HARDENING_MIGRATION` | Feature flags and environment-specific behavior. | Port only after a Production configuration inventory and feature-flag ownership decision. No values in Git. |
| Incompatible with Production direct copy | `STAGING_LANDLORD_REGISTRATION`, `STAGING_TENANT_BINDING_SETUP` | Staging fixture/bootstrap behavior; can create schema or staging identities. | **Never include in a Production release tree.** |
| Incompatible with Production direct copy | staging test fixtures, local resource configuration, test UID allowlists | Test identities, staging LIFF endpoints, fixture data. | **Never include in a Production release tree.** |

### Required schema principles

1. Every Production change must be additive: create a new Sheet or append
   missing headers only. Do not rename, reorder, delete, or overwrite existing
   columns.
2. Migration functions must be split from runtime handlers and protected by an
   explicit Production migration feature flag.
3. A migration must validate headers, duplicate keys, workspace ownership, and
   row counts before enabling any dependent route or trigger.
4. Each migration must record a versioned, timestamped migration log outside
   of business records and provide a read-only post-check.

## Migration Execution Checklist

### 0. Freeze and approval

- [ ] Create a clean, isolated release tree from an approved SHA; do not use
      the current aggregate dirty worktree.
- [ ] Record Production Web App version 74 and rollback target version 73.
- [ ] Export masked deployment metadata and take a spreadsheet-version /
      backup checkpoint for every affected Sheet.
- [ ] Obtain explicit approval for each optional lifecycle module; unapproved
      modules remain excluded.
- [ ] Confirm Phase 83 staging test suite is 14/14 passing and complete the
      outstanding remote landlord/isolation tests.

### 1. Schema migration

- [ ] Run a read-only schema preflight against Production: sheet existence,
      headers, row counts, duplicate key scan, and workspace-key coverage.
- [ ] Apply only the approved additive schema subset in dependency order:
      notification/security support before any feature that enqueues jobs;
      settlement ledger before move-out settlement; lifecycle headers before
      associated lifecycle routes.
- [ ] Validate each Sheet immediately after migration; do not enable features
      when header or duplicate-key validation fails.
- [ ] Store migration result and rollback metadata without secrets or LINE
      identifiers.

### 2. Apps Script backend

- [ ] Build a Production release tree that excludes all `STAGING_*`, tests,
      repair tools, diagnostics, migrations, and fixture setup modules unless
      an approved production-safe equivalent is explicitly included.
- [ ] Include only modules whose schema dependencies passed Step 1.
- [ ] Confirm route names, public payload schemas, and existing handler
      interfaces remain compatible.
- [ ] Run syntax, duplicate-declaration, route, handler, and credential scans
      on the isolated release tree.
- [ ] Verify RBAC and workspace isolation for every included write route.

### 3. Deployment

- [ ] Verify the release-tree `.clasp.json` is bound to the approved
      Production Script project using masked ID comparison.
- [ ] Compare every file SHA-256 with the approved release manifest.
- [ ] `clasp push` only the approved isolated release tree after the above
      approvals; do not push the repository root.
- [ ] Create one immutable Apps Script version and update the existing Web App
      deployment only. Preserve the URL.

### 4. Trigger activation

- [ ] Inventory existing Production triggers before any change.
- [ ] Add or update only approved worker triggers after deployment: notification
      worker, contract expiry, or billing reminder as applicable.
- [ ] Confirm no trigger points to test, repair, migration, diagnostics, or
      legacy-import functions.
- [ ] Execute a disposable, non-production-data trigger proof and inspect
      sanitized logs.

### 5. Environment Properties and secrets

- [ ] Verify the presence and owner of Production Spreadsheet binding,
      environment marker, feature flags, LIFF configuration, identity
      verification settings, and LINE messaging token without outputting values.
- [ ] Confirm all Production values differ from staging where they must differ.
- [ ] Enable feature flags one at a time only after associated schema, backend,
      trigger, and read-only smoke checks pass.
- [ ] Confirm no property value, token, key, UID, or deployment ID was added to
      Git or logs.

### 6. Validation and release acceptance

- [ ] Run read-only Web App endpoint, LIFF authentication, tenant/landlord
      resolver, workspace isolation, and route smoke tests.
- [ ] Verify notification queue enqueue/retry/stale recovery using a controlled
      disposable event; do not send unintended user messages.
- [ ] Verify settlement idempotency and rollback using non-production data or a
      previously approved test boundary only.
- [ ] Compare runtime logs/error rates against the pre-release baseline.
- [ ] Obtain named human GO before leaving the release window.

## Rollback Checklist

### Trigger conditions

- [ ] Any cross-workspace or cross-role access result.
- [ ] Authentication/LIFF verification failure affecting normal users.
- [ ] Duplicate binding, notification, payment, or settlement side effect.
- [ ] Queue worker repeatedly failing or leaving jobs in `processing`.
- [ ] Schema validation mismatch or migration post-check failure.

### Runtime rollback

1. Stop feature-flag expansion and disable only the affected newly enabled
   feature flag where safe.
2. Update the existing Production Web App deployment back to immutable version
   73; keep the same URL.
3. Verify endpoint availability and perform only agreed read-only smoke checks.
4. Preserve logs and migration evidence for incident review.

### Schema rollback

1. Do **not** delete or reorder Production Sheets/columns during an incident.
2. Disable dependent feature flags and revert runtime to version 73 first.
3. Restore only rows written by the approved migration using the migration log
   and pre-release backup, after manual review.
4. Re-run read-only schema, workspace-isolation, and duplicate-key checks.
5. Keep new additive columns/Sheets disabled if data rollback cannot be proven
   safe; removal is not a default rollback action.

## Remaining Blockers

| Blocker | Required action |
| --- | --- |
| Production/staging schema divergence | Approve an explicit additive schema subset and migration runbook; no direct staging copy. |
| Production environment and LINE configuration evidence absent | Complete a sanitized, human-reviewed presence-and-purpose audit. |
| Landlord post-onboarding verification incomplete | Verify real staging landlord home, contracts, billing, and both cross-role denials. |
| Two-workspace isolation evidence incomplete | Execute tenant and landlord isolation probes with independent fixtures. |
| Notification recovery has no remote trigger proof | Inventory triggers and prove stale-processing recovery with a disposable staging job. |
| Financial settlement rollout unapproved | Approve ledger/migration/idempotency/rollback controls separately, or exclude Phase 94 modules. |
| Release boundary is not clean | Produce a reviewed Production artifact and immutable SHA manifest. |

## Phase 97 Validation Record

- Canonical repository validator: **PASS** — 68 routes, 68/68 handlers.
- Staging validator: **PASS** — 87 routes, 87/87 handlers.
- Phase 83 binding critical-path test: **PASS** after classifier correction.
- Production changes, deployment, Sheets, LINE configuration, commit, and push:
  **not performed**.

## Release Decision

**NO-GO remains in force.** Phase 97 supplies the migration package and closes
the local Phase 83 test blocker; it does not close the remote verification,
configuration, schema-approval, or isolated-artifact blockers listed above.
