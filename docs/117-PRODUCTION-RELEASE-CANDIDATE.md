# Phase 117 — Production Release Candidate Final Audit

Date: 2026-07-23  
Decision: **NO-GO — Production Release Candidate is not frozen**

## Scope and safety boundary

This audit uses the Phase 116 staging evidence and current static validators. It does not modify Production source, deployment, Sheets, Script Properties, triggers, LINE channels, or hosting. It does not create a Production artifact, commit, Git push, or deploy.

## 1. Workspace-isolation regression evidence

Phase 116 exercised two independent, disposable staging Workspaces. Both were removed after testing; their checkpoint reports `cleaned` and `cleanup_verified: true`.

| Caller | Own-workspace expectation | Cross-workspace attempt | Result |
| --- | --- | --- | --- |
| Landlord A | Home, contracts, billing, property and tenant projections scoped to Workspace A. | Workspace B, property/room B, contract/bill B, and substituted workspace ID. | PASS — deny/absent for all foreign resources. |
| Landlord B | Home, contracts, billing, property and tenant projections scoped to Workspace B. | Workspace A, property/room A, contract/bill A, and substituted workspace ID. | PASS — deny/absent for all foreign resources. |
| Tenant A | Own home, bills, contract, and messages. | Tenant B, landlord routes, and tenant/workspace/property/room/contract substitution. | PASS — authenticated canonical identity remains authoritative. |
| Tenant B | Own home, bills, contract, and messages. | Tenant A, landlord routes, and tenant/workspace/property/room/contract substitution. | PASS — authenticated canonical identity remains authoritative. |

Evidence summary: landlord matrix **12/12 PASS**; tenant matrix **16/16 PASS**. The authorization rule is now `LINE UID → active membership → workspace_id → owned resource`; no Phase 116 landlord read path opts in to legacy context creation.

## 2. Notification-isolation regression evidence

| Event | Required immutable envelope | Receiver result | Status |
| --- | --- | --- | --- |
| `bill_created` | `event_id`, `workspace_id`, actor/resource/receiver type and ID | Only the intended Workspace A receiver was resolved; Workspace B was excluded. | PASS |
| `tenant_repair` | Same eight canonical fields | Only the intended Workspace A receiver was resolved; Workspace B was excluded. | PASS |
| `contract_expiring` | Same eight canonical fields | Only the intended Workspace A receiver was resolved; Workspace B was excluded. | PASS |

The three checks validate queue creation and receiver resolution only; no LINE transport or real message delivery was invoked. The worker must use the persisted `(workspace_id, receiver_type, receiver_id)` tuple and must not infer a recipient from an ambiguous LINE field.

## 3. Release candidate identity

The following is deliberately not filled with inferred Production values. A Production RC can be frozen only from a clean, review-approved artifact.

| Artifact | Current evidence | Required before Production GO |
| --- | --- | --- |
| Frontend SHA-256 | `TBD` — no Production-only frontend artifact has been built from a clean source tree. | Generate a per-file SHA manifest, obtain a second review, and record an immutable hosting revision. |
| Backend Apps Script version | `TBD` — no authorized RC version has been created. Historical references must be re-confirmed at release time. | Record the serving version, planned immutable version, project/deployment binding, and rollback version with masked evidence. |
| Backend SHA-256 | `TBD` — no approved Production module list has been frozen. | Generate a per-module manifest from the exact push payload; exclude tests, fixtures, migration runners, repair tools, and local credentials. |
| Schema migration version | `TBD` — no additive migration set has been approved. | Assign an explicit migration ID, affected Sheets/headers, preflight result, and rollback reference. |
| Staging evidence | PASS — Phase 116 matrix and static validators. | Repeat against the frozen candidate without changing its hashes. |

## 4. Schema migration readiness checklist

| Check | Required evidence | Status |
| --- | --- | --- |
| Approved migration scope | Named, additive-only schema migration IDs and affected headers/Sheets. | BLOCKED |
| Preflight | Header/schema snapshot, row-count bounds, key uniqueness, and `workspace_id` coverage. | BLOCKED |
| Compatibility | Existing runtime can read old rows; no rename, reorder, deletion, or overwrite. | BLOCKED |
| Migration log | Migration-owned rows, timestamps, operator, and idempotency reference. | BLOCKED |
| Feature gating | New workflow/worker remains disabled until its schema and recovery evidence are approved. | BLOCKED |

## 5. Backup and rollback checkpoint

Before an authorized Production release window, collect sanitized evidence for:

1. Production Sheet backup/export and schema snapshot.
2. Current Web App deployment version, existing URL, and verified immutable rollback version.
3. Current frontend hosting revision and its prior rollback revision.
4. Trigger inventory: handler, schedule, owner, enabled state, and environment.
5. Required Script Property key existence and scope only — never values.
6. A named backup/rollback owner and staging-clone restore rehearsal.

Rollback order after a future approved release:

```text
disable affected feature flag / worker trigger
→ restore previous frontend hosting revision
→ repoint the existing Web App deployment to its verified prior immutable version
→ restore migration-owned records from the checkpoint when required
→ re-run read-only route, notification, and Workspace-isolation smoke checks
```

No destructive header/Sheet rollback is permitted; additive schema remains disabled until separately reviewed.

## 6. Validation record

| Check | Result |
| --- | --- |
| Root validator | PASS — 68 unique routes; 68/68 handlers; credentials, duplicate declarations, manifest, and HTML links pass. |
| Staging validator | PASS — 87 unique routes; 87/87 handlers; credentials, duplicate declarations, manifest, and HTML links pass. |
| `git diff --check` | PASS |
| Production mutation/deployment | Not performed. |

## 7. GO / NO-GO matrix

| Gate | Status | Required action |
| --- | --- | --- |
| Workspace isolation regression | PASS | Preserve Phase 116 canonical resolver and rerun the matrix on the frozen RC. |
| Notification receiver isolation | PASS | Keep explicit event envelope and rerun queue recovery tests with the selected RC. |
| Source/static integrity | PASS | Re-run validators against the exact frozen artifact. |
| Candidate artifact SHA | BLOCKER | Build a clean Production-only artifact and independently verify all hashes. |
| Production environment evidence | BLOCKER | Human, read-only verification of project/deployment, LIFF, Messaging, Properties, and trigger scope. |
| Schema migration approval and backup | BLOCKER | Approve migration IDs and complete preflight/backup/restore rehearsal. |
| Production rollback verification | BLOCKER | Reconfirm rollback version and prior hosting revision immediately before release. |

## Final decision

**NO-GO for Production deployment.** Staging isolation regressions are closed, but a Production release candidate is not yet immutable or independently reviewable. The next allowed step is a clean Production-only artifact build and SHA freeze; it must not deploy or alter Production without explicit approval.
