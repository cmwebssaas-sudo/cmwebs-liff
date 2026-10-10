# Phase 96 — Production Release Gate Audit

Date: 2026-07-23  
Scope: read-only release-gate audit of the canonical repository and staging evidence.  
Production changes, deployment, Sheet writes, LINE actions, and secret-value reads were not performed.

## Decision

**NO-GO — BLOCKER.**

Staging has meaningful security, lifecycle, and tenant-flow coverage, but it is not yet an approved Production release candidate. The current worktree is also not a clean, bounded release tree: it contains pre-existing runtime, frontend, documentation, and staging changes. A Production release must be built from an explicitly approved artifact, not this aggregate working tree.

## Evidence Used

- Canonical Production source: `apps-script/`
- Staging source and frontend artifact: `release/staging/`
- Existing Phase 95 through 95.7 reports and Phase 57/58/60 rollback records
- Local validation: `npm run validate` — **PASS**
- Staging static validation: 48 Apps Script files, 6 HTML files, 87 unique routes, 87/87 handlers — **PASS**
- Staging test suite: 13/14 tests passed — **BLOCKER** (see Gate 1)
- Staging deployment inventory: immutable staging deployment version 21 is present; no Production deployment operation was performed.

No credential, Script Property value, Script ID, deployment ID, LINE UID, or token is reproduced in this report.

## Release Gate Checklist

| # | Gate | Staging verification | Status | Required action before Production release |
| --- | --- | --- | --- | --- |
| 1 | Staging / Production schema diff | Staging contains additive lifecycle and security tables/columns not present in the Production canonical schema. The staging suite also has one failing Phase 83 critical-path test. | **BLOCKER** | Close the 14th test failure (`reconciliation classifier must exist`) through an approved behavior decision; create an additive schema migration, backup, validation, and rollback plan for every Production schema change. |
| 2 | Apps Script deployment version difference | Staging deployment inventory includes the current staged release version 21. Production rollback evidence records current Web App version 74 and rollback target 73. | **PASS — inventory only** | Before release, create a final immutable SHA manifest and re-verify that the isolated Production release tree is bound to the intended Production Script project and existing Web App deployment. |
| 3 | Environment variables / Script Properties | Staging evidence records all required runtime keys and feature flags as configured, without exposing values. Production has no equivalent sanitized presence-and-purpose audit in this release gate. | **BLOCKER** | Perform an approved Production Property presence audit: verify key names, environment marker, feature flags, and Spreadsheet binding only; do not disclose values. Confirm no staging property is reused by Production. |
| 4 | LINE LIFF channel mapping | Tenant staging LIFF login, token verification, and authenticated tenant paths have evidence. The landlord onboarding flow completed, but the required post-onboarding landlord smoke matrix is incomplete. Production channel mapping is not re-verified. | **BLOCKER** | Complete landlord post-onboarding LIFF verification and separately obtain human-confirmed Production LIFF/channel/endpoint mapping using masked identifiers. |
| 5 | LINE Messaging API token | Staging configuration evidence records a token as present. No token is in source control. End-to-end delivery, token rotation ownership, and Production token configuration are not release-gate evidence. | **BLOCKER** | Execute one controlled staging delivery and record a redacted provider result; document Production token owner, rotation procedure, least-privilege scope, and failure handling without exposing the token. |
| 6 | RBAC permission matrix | Static and staging tests cover tenant/landlord role denial paths. Tenant-to-landlord denial has runtime evidence. Full landlord post-onboarding matrix remains unverified. | **BLOCKER** | Run and record landlord-home/contracts/billing success plus tenant-to-landlord and landlord-to-tenant denial cases after onboarding. Repeat with a second workspace fixture. |
| 7 | Tenant / Landlord isolation | Resolver and RBAC tests pass in source; tenant real-LIFF flow demonstrates protected-route denial. Cross-workspace remote proof for both roles is incomplete. | **BLOCKER** | Execute a two-workspace staging isolation matrix: tenant A vs tenant B data, landlord A vs workspace B, and direct route probes. Preserve redacted evidence. |
| 8 | Notification queue recovery | Queue retry/stale-processing recovery is implemented and Phase 90 static tests pass. Remote trigger/worker execution inventory could not be verified through the available executable API path. | **BLOCKER** | Manually inventory staging installable triggers, then prove stale `processing` recovery and retry/terminal-failure behavior using a disposable staging notification job. Record logs without tokens or UIDs. |
| 9 | Settlement rollback | Staging schema and rollback tests show settlement ledger validation and rollback behavior. Production does not yet have an approved additive migration or ledger rollout plan. | **BLOCKER** | Approve a Production settlement migration package: backup, idempotency verification, transaction/ledger reconciliation, controlled rollback, and post-rollback read-only validation. |
| 10 | Production rollback plan | Immutable Production rollback baseline is documented: current Web App version 74; rollback target version 73; existing endpoint must remain unchanged. | **PASS — baseline exists** | Before release, freeze the final artifact SHA, record the deployment/version change plan, nominate rollback owner, and rehearse the same rollback procedure in staging. |

## Schema Difference Inventory

The current staging source has 18 modules absent from the Production canonical backend, including notification queue/templates, billing/payments lifecycle, contracts lifecycle, repair tickets, move-out/deposit settlement, RBAC, LINE identity security, environment configuration, and settlement/security-failure support.

Examples of staging-only physical data structures include `V2_NOTIFICATION_QUEUE`, `V2_SECURITY_FAILURE_QUEUE`, `V2_SETTLEMENT_LEDGER`, `V2_REPAIR_TICKETS`, `V2_MOVE_OUT_REQUESTS`, and `V2_DEPOSIT_SETTLEMENTS`, plus additive lifecycle fields in existing contract, bill, payment, and room flows.

These are **not** safe for direct file-copy promotion. Each must be promoted only through an approved, additive, feature-flagged migration with a backup and rollback path.

## Test Failure Blocking Release

`release/staging/tests/phase83-binding-critical-path.test.js` fails because the staging tenant-binding frontend does not contain the expected `classifyBindingReconciliation_` function. This is an implementation/test-contract mismatch. It must be resolved deliberately; do not weaken or remove the test merely to obtain a green suite.

Current staging suite result: **13/14 passed; release gate remains blocked.**

## Minimum Required Actions (in order)

1. Resolve the Phase 83 binding-critical-path test contract and rerun all staging tests to 14/14 passing.
2. Complete real post-onboarding landlord LIFF smoke verification: `landlord_home`, contracts, billing, and both cross-role denial paths.
3. Run a two-workspace tenant/landlord isolation test matrix.
4. Prove notification stale-processing recovery through the actual staging worker/trigger and a disposable notification job.
5. Produce a sanitized Production Script Properties and LINE channel readiness record; values must remain secret.
6. Approve and test additive migration/rollback plans for schema, notification queue, settlement ledger, and feature flags.
7. Build a clean, isolated Production release artifact; create a final SHA-256 manifest; re-check Production clasp binding and the version 74 → 73 rollback procedure.
8. Obtain explicit human GO approval before any Production `clasp push`, version creation, or deployment update.

## Production Rollback Procedure (for approved future release only)

1. Stop the release if smoke tests or execution logs show a P0/P1 runtime failure.
2. In Apps Script Manage deployments, update the existing Production Web App deployment to immutable version 73; do not replace its URL.
3. Confirm the endpoint responds and run only the agreed read-only smoke checks.
4. Record timestamp, actor, affected deployment, observed result, and follow-up incident reference.
5. Do not run schema rollback until the corresponding migration-specific rollback plan has been approved.

## Explicit Boundary Confirmation

- Production Apps Script: **not modified**
- Production deployment / Web App URL: **not modified**
- Production Sheets: **not modified**
- Production LINE configuration and credentials: **not modified**
- Git commit / Git push: **not performed**

## Next Decision

**Do not start a Production deployment phase.** Start a staging release-closure phase limited to the eight required actions above, then repeat this gate audit with clean artifact and remote evidence.
