# Phase 110 — Production Dry Run + Rollback Rehearsal

Date: 2026-07-23  
Decision: **NO-GO — runbook complete; no Production rehearsal is executed**

## Scope and execution boundary

This runbook defines a full pre-release dry run and rollback rehearsal without
modifying Production. All executable tests use a disposable staging clone or
mock boundary. Production is limited to human, read-only presence/scope
verification; no Sheet, Property, Apps Script deployment, trigger, queue,
notification log, provider call, commit, or push may be changed.

The dry run is successful only when its evidence can be reproduced from the
same immutable candidate artifact selected for the future release. Static
validation alone never upgrades the decision to GO.

## 1. Migration dry run

### Simulated order

```text
freeze candidate
  → backup checkpoint
  → read-only schema preflight
  → approved additive schema migration (staging clone only)
  → isolated backend validation/deployment rehearsal
  → isolated frontend validation/deployment rehearsal
  → trigger/feature-flag verification
  → read-only smoke and isolation checks
  → rollback rehearsal
```

| Dry-run stage | Dependency check | Backward-compatibility check | Rollback point | Result |
| --- | --- | --- | --- | --- |
| Candidate freeze | Two reviewed frontend/backend/schema manifests with matching SHA-256. | Existing routes and payload contracts are retained. | Discard candidate; rebuild from approved source. | BLOCKED — RC is not frozen. |
| Backup checkpoint | Backup owner, Sheet/export snapshot, deployment metadata, trigger/Property presence matrix. | Existing data remains untouched during snapshot. | Verified staging restore procedure. | BLOCKED — ownership/rehearsal pending. |
| Schema preflight | Sheet existence, headers, row counts, duplicate keys, `workspace_id` coverage. | Changes are additive; no rename/reorder/delete/overwrite. | Pre-migration snapshot and migration-owned log. | BLOCKED — scope not approved. |
| Schema migration | Only approved migration ID applies to staging clone. | Existing runtime can read old rows/headers. | Restore migration-owned rows; leave additive headers disabled. | BLOCKED — approved subset pending. |
| Backend path | Isolated source matches frozen backend SHA and manifest. | Routes/handlers/API schema remain compatible. | Existing Web App version 73. | BLOCKED — exact RC pending. |
| Frontend path | Isolated artifact matches frozen frontend SHA and approved origins. | `.html` routing, LIFF, JSONP/API contracts stay compatible. | Previous approved hosting revision. | BLOCKED — exact RC pending. |
| Trigger/flag path | Environment/owner/feature guard verifies staging separation. | New worker stays off until explicit approval. | Disable flag/worker. | BLOCKED — inventory pending. |
| Read-only smoke | Auth, resolver, tenant/landlord route, and Workspace matrix pass. | Existing user flows have no loop/regression. | Stop progression; retain evidence. | BLOCKED — complete remote evidence pending. |

### PASS criteria

- [ ] Every stage has a dated sanitized evidence record.
- [ ] No compatibility check fails and no fallback selects cross-Workspace data.
- [ ] Every migration is repeatable/idempotent in the staging clone.
- [ ] Artifact SHA before and after dry run matches exactly.
- [ ] Dry-run rollback returns staging clone to the approved baseline.

### Current status

**PASS:** canonical and staging static validators pass.  
**BLOCKED:** candidate freeze, approved migration scope, production environment
evidence, backup/restore rehearsal, notification recovery proof, and complete
two-Workspace evidence remain unfinished.

## 2. Backup verification

Complete this checklist before a future production release window. Evidence
must use masked identifiers and must not include credentials.

| Backup item | Verification | Owner | Status |
| --- | --- | --- | --- |
| Sheet backup | Version/export checkpoint exists for every affected Production Sheet. | TBD | [ ] |
| Schema snapshot | Sheet/header list, row counts, canonical-key duplicate scan, and `workspace_id` coverage captured read-only. | TBD | [ ] |
| Deployment version snapshot | Current serving Web App version, rollback version, URL continuity, and project binding recorded with masked evidence. | TBD | [ ] Historical baseline v74 / rollback v73; re-confirm. |
| Trigger inventory | Function, schedule/time zone, owner, environment, and enabled state exported read-only. | TBD | [ ] |
| Properties snapshot | Required property keys, existence, scope, and feature-flag state recorded without values. | TBD | [ ] |
| Frontend revision snapshot | Current hosting revision and artifact SHA recorded. | TBD | [ ] |
| Restore owner | A named owner can restore the backup and validate it in the release window. | TBD | [ ] |

Backup acceptance requires a staging-clone restore rehearsal that validates
headers, row-count bounds, canonical-key uniqueness, Workspace keys, endpoint
availability, and no unintended message delivery.

## 3. Rollback rehearsal

### Frontend rollback

1. Identify the prior approved hosting revision and its SHA-256 manifest.
2. In staging, publish/repoint only to the prior revision; do not change LIFF
   IDs, callback origins, or API contract.
3. Verify canonical `.html` routes, LIFF entry, and internal navigation.
4. Record restoration time and artifact/hash match.

Expected Production path after separate authorization: restore the prior
approved hosting revision only; preserve the existing Production origin and
LIFF endpoint mapping.

### Backend rollback

1. Record current serving version and rollback target before execution
   (historical evidence: serving v74, rollback v73; both require recheck).
2. In the staging rehearsal, return the Web App deployment to the prior
   immutable staging version while retaining its URL.
3. Run only agreed read-only endpoint, identity, role, and Workspace smoke
   tests.
4. Preserve logs/evidence; do not run repair/migration as part of rollback.

Expected Production path after separate authorization: repoint the existing
Web App deployment to its verified immutable rollback version and preserve URL
and access configuration.

### Schema rollback

1. Disable the dependent feature flag and worker trigger first.
2. Restore only records created by the approved migration from its migration
   log and pre-release backup, after review.
3. Keep additive Sheets/headers in place but disabled unless deletion is
   independently proven safe and approved.
4. Re-run schema, duplicate-key, `workspace_id`, RBAC, and read-only resolver
   checks.

Expected result: **no destructive structural rollback and no impact to
unrelated business data**.

## 4. Notification worker recovery test

Run only against a disposable staging queue with mock transport. Never send a
real LINE message or use a Production recipient/token.

| Scenario | Procedure | Expected result | Evidence |
| --- | --- | --- | --- |
| Queue stuck `processing` | Simulate expired lease; invoke recovery once. | `processing → retrying` or terminal `failed`; one claim/lineage only. | Sanitized state/timing/log. |
| Retry handling | Mock timeout/failure from a `pending` job. | `pending → processing → retrying`; first retry after 5m, second after 30m. | Retry count and next retry record. |
| Failed-state handling | Exhaust the bounded allowed retries. | Terminal `failed`, sanitized failure reason, no fourth provider attempt. | State/log lineage. |
| Recovery to success | Mock failure then mock success. | Exactly one final `sent` record. | Sanitized state/log lineage. |
| Duplicate prevention | Enqueue same event/idempotency key twice. | One queue job/delivery lineage only. | Dedupe result. |

All mock evidence must confirm no `UrlFetchApp` provider transport call and no
secret, token, or full UID in logs.

## 5. Workspace isolation test

Use independent disposable staging fixtures only.

| Caller | Attempt | Expected result |
| --- | --- | --- |
| Workspace A landlord | Read permitted Workspace A data. | Allow only authorized A-scoped projection. |
| Workspace A landlord | Read Workspace B landlord/tenant/contract/bill/message data. | Deny closed before projection; no B metadata. |
| Workspace A tenant | Read own home/bills/contract/authorized messages. | Allow own canonical identity chain only. |
| Workspace A tenant | Read Workspace B or Tenant B data. | Deny closed; no fallback lookup. |
| Workspace A tenant | Call landlord API. | Deny by RBAC before data access. |
| Workspace B landlord | Read Workspace A data. | Deny closed; no A metadata. |
| Any caller | Supply another workspace/tenant/landlord identifier. | Server-derived identity wins; deny request. |
| Invalid/expired auth | Any protected route. | Deny before resolver/Sheet access. |

PASS requires every allow/deny result above and a redacted route/status/evidence
record. Any cross-role or cross-Workspace result is a release-blocking failure.

## 6. Release artifact record

| Field | Value | Freeze requirement |
| --- | --- | --- |
| Release ID | `RC-TBD` | Assigned after clean candidate scope is approved. |
| Candidate timestamp | `TBD` | Recorded at immutable artifact creation. |
| Source revision | `TBD` | Reviewed, clean source only. |
| Frontend hash/revision | `TBD` | SHA-256 and immutable hosting revision verified by two reviewers. |
| Backend hash/version | `TBD` | Source manifest verified; Apps Script version assigned only at authorized deployment. |
| Schema version | `TBD` | Approved additive migration IDs only. |
| Current serving baseline | Historical v74 | Re-confirm before release. |
| Rollback baseline | Historical v73 | Re-confirm selectable before release. |

## 7. Final gate

### GO

Only possible after all of the following are closed: clean candidate SHA
freeze; Production credential/Property/LIFF/trigger presence/scope evidence;
approved additive schema and backup/restore rehearsal; staging notification
recovery and two-Workspace isolation proofs; confirmed production rollback;
and named release/backup/rollback owners.

### CONDITIONAL GO

Allows only read-only Production inventory and non-mutating staging rehearsal.
It does not allow schema migration, deployment, trigger/Property mutation,
real LINE delivery, commit, or push.

### NO-GO — current decision

Production migration and rollout remain blocked. Required human confirmations:

1. Complete sanitized serving-Production environment and trigger inventory.
2. Approve/exclude the exact schema, backend, frontend, and notification scope.
3. Create and second-review clean RC SHA manifests.
4. Name/verify backup and rollback owners, checkpoints, and restore procedure.
5. Execute staging-clone migration/rollback, mock worker recovery, and
   two-Workspace isolation rehearsals with redacted evidence.

## Validation record

Run the canonical validator, staging validator, and `git diff --check` for
this Phase. A pass demonstrates static integrity, not an executed Production
migration or rollback.
