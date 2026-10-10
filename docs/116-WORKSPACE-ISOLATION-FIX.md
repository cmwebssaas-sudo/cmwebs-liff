# Phase 116 — Workspace Isolation Fix

## Outcome

**PASS (staging only).** Phase 115.2's landlord and notification isolation blockers were corrected and verified with two disposable, independent Workspace fixtures. No Production source, deployment, Sheet, property, or LINE configuration was changed.

## Root cause

1. The Workspace-native landlord dashboard still used the permissive legacy-context access resolver. That allowed an otherwise canonical read path to depend on a Spreadsheet-derived fallback rather than the active membership and requested workspace.
2. The legacy `getLandlordHomeByLineUid` implementation could directly query `V2_landlord_home_view` by LINE UID. A view row keyed only by a legacy identifier is not sufficient authority in a multi-Workspace system.
3. Notification jobs did not consistently carry enough immutable context for the queue worker to prove the intended Workspace and receiver. This left an avoidable risk that downstream logic could infer a recipient from incomplete data.

## Implementation

| Area | Staging-only change |
| --- | --- |
| Canonical landlord access | Added `workspaceLandlordResolveCanonicalScopedAccess_()`: resolves `LINE UID → active landlord membership → workspace`, validates the selected `workspace_id`, and returns the authorized landlord user and membership. It never creates legacy context. |
| Landlord dashboard | `workspaceDashboardExecute_()` now uses the canonical scoped resolver. |
| Landlord home wrapper | `getLandlordHomeByLineUid()` delegates to the Workspace-native home handler instead of authorizing directly from the legacy home view. |
| Contracts and billing | `landlord_contracts_init` and `landlord_billing_lifecycle_init` use canonical scoped access before returning resource projections. |
| Notification queue | Canonical queue payloads now contain `event_id`, `workspace_id`, `actor_type`, `actor_id`, `resource_type`, `resource_id`, `receiver_type`, and `receiver_id`. |
| Notification worker | Receiver resolution uses the persisted queue receiver tuple and validates its Workspace. It does not prefer a caller-supplied or ambiguous `line_user_id`. |
| Event producers | `bill_created`, `tenant_repair`, and `contract_expiring` provide explicit canonical context to the queue. |
| Test fixture | The staging-only fixture module asserts the complete envelope and verifies no Workspace B receiver is selected for Workspace A events. |

The legacy resolver remains available only for explicitly opted-in compatibility callers (`allow_legacy_context === true`). The Phase 116 landlord runtime paths do not opt in.

## Disposable fixture checkpoint

| Fixture | Workspace | Landlord | Tenant | Property | Room | Contract | Bill |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A | `W000003` | `L000003` | `T000001` | `P000002` | `R000002` | `C000001` | `BILL-202607-C000001` |
| B | `W000004` | `L000004` | `T000002` | `P000003` | `R000003` | `BILL-202607-C000002` |

These were staging-only rows marked `PHASE115_DISPOSABLE`. Cleanup completed after verification: **104 rows** were removed across the fixture, view, log, and notification-queue Sheets; the checkpoint is `cleaned` and reports `cleanup_verified: true`.

## Runtime verification matrix

| Matrix | Result | Coverage |
| --- | --- | --- |
| Fixture creation | PASS | A and B created through staging workflows with independent Workspace, landlord, tenant, property, room, contract, and bill chains. |
| Landlord isolation | PASS — 12/12 | Each landlord can load its own home, contracts, billing, property, and tenant projection; foreign Workspace, property/room, contract/bill, and workspace-ID substitutions fail closed. |
| Tenant isolation | PASS — 16/16 | Each tenant can read only its own home, bills, contract, and messages; landlord routes and all tested identity/resource substitutions fail closed. |
| Notification isolation | PASS — 3/3 | `bill_created`, `tenant_repair`, and `contract_expiring` each created a complete canonical envelope and resolved only the Workspace A receiver, never Workspace B. |
| Fixture cleanup | PASS | Marker-scoped cleanup completed; no fixture business rows remain. |

Notification checks exercised queue construction and receiver resolution only. They did not invoke LINE transport or send messages.

## Validation

| Check | Result |
| --- | --- |
| Root repository validator (`npm run validate`) | PASS — 68 unique routes, 68/68 handlers, no blocking credentials or hardcoded LINE UID findings. |
| Staging validator | PASS — 49 Apps Script files, 6 HTML files, 87 unique routes, 87/87 handlers, no duplicate declarations, credentials, or hardcoded LINE UID findings. |
| `git diff --check` | PASS |
| Staging source synchronization | `clasp push` to the confirmed **staging** project completed (50 files). No deployment/version was created. |

## Files changed for Phase 116

All implementation files are isolated under `release/staging/apps-script/`:

- `V2_WORKSPACE_LANDLORD_ACCESS.js`
- `V2_WORKSPACE_DASHBOARD_NATIVE.js`
- `V2_API.js`
- `V2_CONTRACTS.js`
- `V2_BILLS.js`
- `V2_REPAIR_TICKETS.js`
- `V2_NOTIFICATION_QUEUE.js`
- `V2_NOTIFICATION_SERVICE.js`
- `STAGING_WORKSPACE_ISOLATION_FIXTURES.js`
- `docs/116-WORKSPACE-ISOLATION-FIX.md`

No repository-root Production Apps Script module, Production HTML, Production Apps Script deployment, Production spreadsheet, Production Script Property, or Production LINE channel was modified.

## Residual risk and next action

The authorization boundary now passes controlled staging matrices. Before any Production release, repeat the isolation verification against a Production-like release candidate with separately approved identities and confirm all remaining release-gate evidence. Phase 116 created no commit, Git push, or Production deployment.
