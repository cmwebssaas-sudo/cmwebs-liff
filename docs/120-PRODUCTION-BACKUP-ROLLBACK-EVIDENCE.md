# Phase 120 — Production Backup & Rollback Evidence

Date: 2026-07-23  
Decision: **NO-GO — backup and rollback evidence template prepared; no Production snapshot was created in this phase.**

## 1. Backup evidence package

### Production Google Sheets

| Backup item | Required evidence | Acceptance condition | Status |
| --- | --- | --- | --- |
| Full workbook backup | Timestamped owner-controlled export/copy before migration | Restorable by the designated Production owner | PENDING |
| Schema snapshot | Sheet names, header rows/checksums, row counts, protected-range inventory | Matches the pre-migration workbook | PENDING |
| Critical data reconciliation | Read-only counts for identity, workspace, property, contract, billing, and approved queue/log sheets | Counts recorded without exposing private data | PENDING |
| Recovery owner | Named authorized operator and restore access confirmation | Owner can restore without sharing secrets | PENDING |

The backup must be created immediately before the approved migration window. This repository must store only the backup reference, timestamp, owner, and validation result—not export contents, Spreadsheet IDs, or user data.

### Apps Script source and deployment

| Snapshot item | Required evidence | Acceptance condition | Status |
| --- | --- | --- | --- |
| Serving source reference | Immutable source/version reference and redacted project/deployment association | Can identify the exact currently serving source | PENDING |
| Apps Script version snapshot | Current immutable version, creation timestamp, and masked deployment reference | Version can be selected as rollback target | PENDING |
| Trigger inventory | Function, schedule/event, owner, enabled state, last-error state | Captured before any migration/deployment | PENDING |
| Properties existence snapshot | Property-key presence and environment only | No values/secrets captured | PENDING |

### Frontend artifact

| Snapshot item | Required evidence | Acceptance condition | Status |
| --- | --- | --- | --- |
| Serving hosting revision | Immutable revision/release identifier | Can be restored by hosting owner | PENDING |
| Artifact manifest | Frontend file list, SHA-256 manifest, source commit | Matches serving revision | PENDING |
| Environment reference | Production endpoint/LIFF configuration reviewed by host/path only | No staging fallback and no secrets | PENDING |

## 2. Migration safety evidence

### Schema change inventory

Every approved migration must supply a separate, versioned inventory:

| Change category | Required review | Safety requirement |
| --- | --- | --- |
| New sheets/columns | Header/schema diff and purpose | Additive by default; no implicit production data copy |
| Changed semantics | Route/handler/read-path compatibility review | Old readers remain safe until cutover is validated |
| Views/indexes | Rebuild/synchronization behavior and rollback behavior | No destructive regeneration without backup |
| Notification storage | Queue/log lifecycle, retry and recovery compatibility | Existing audit history preserved |
| Lifecycle modules | Repair/settlement/move-out scope approval | Excluded unless explicitly approved for Production |

### Backward-compatibility check

Before migration, verify that the deployed production backend can safely read the pre-migration schema and that the proposed backend can safely read the post-migration schema. Any destructive column rename, deletion, required-field addition without a default/backfill plan, or ambiguous identifier mapping is a release blocker.

### Migration order

1. Record the backup and deployment snapshot evidence above.
2. Validate source/artifact SHA manifests and reviewer approvals.
3. Apply only the approved additive schema changes.
4. Run read-only schema/header/count reconciliation.
5. Update the reviewed backend through a new immutable Apps Script version and the existing approved deployment target.
6. Publish the reviewed frontend artifact.
7. Verify trigger ownership, Properties existence, route/handler health, workspace isolation, and approved read-only smoke tests.
8. Enable traffic only after the post-migration checklist passes.

## 3. Rollback evidence and procedure

### Rollback trigger conditions

Trigger rollback when any of the following is confirmed during the release window:

- Cross-workspace or cross-role data access.
- Authentication, LIFF, or tenant/landlord route failure that blocks a core workflow.
- Schema compatibility failure or data reconciliation mismatch.
- Notification worker sends to an incorrect receiver, duplicates unsafe events, or cannot recover safely.
- Production endpoint/hosting artifact does not match the frozen manifest.

### Rollback procedure

1. Stop release progression and preserve timestamps, error references, and redacted evidence.
2. Revert frontend hosting to the recorded immutable serving revision.
3. Repoint the existing approved Apps Script deployment to the recorded previous immutable version.
4. Pause only the affected worker trigger when necessary to avoid further unsafe notifications; preserve queue/audit records.
5. Apply the approved schema reverse plan or restore procedure only if the schema migration caused the incident.
6. Run the restore verification checklist before re-enabling traffic or workers.

No rollback action may delete queue, notification, payment, contract, or tenant records merely to make checks pass.

### Restore verification

| Verification | Expected evidence | Status |
| --- | --- | --- |
| Frontend | Host revision equals recorded rollback revision | PENDING |
| Backend | Deployment points to recorded rollback Apps Script version | PENDING |
| Schema | Header checksums and row counts reconcile to pre-migration snapshot | PENDING |
| Triggers | Correct owner/environment; no accidental duplicate worker | PENDING |
| Core reads | Read-only tenant and landlord smoke checks pass | PENDING |
| Isolation | Cross-workspace and cross-role requests fail closed | PENDING |
| Notification state | Queue/audit data retained; worker state recoverable | PENDING |

### Data consistency checks

Use read-only reconciliation to compare the pre- and post-action snapshots for:

- workspace, membership, landlord, tenant, property, room, and contract linkage;
- bill/payment counts and status distributions;
- approved notification queue/log counts by state;
- duplicate/ambiguous identity or workspace links;
- schema headers and required views/indexes.

Any mismatch requires investigation before the release is resumed.

## 4. GO / NO-GO checklist

| Gate | Status | Required action |
| --- | --- | --- |
| Backup point created and restorable | BLOCKER | Authorized owner creates and verifies a fresh backup |
| Production version/deployment snapshot captured | BLOCKER | Capture redacted immutable version and deployment evidence |
| Frontend revision/artifact snapshot captured | BLOCKER | Capture revision and SHA manifest |
| Schema change inventory approved | BLOCKER | Approve exact migration package and compatibility review |
| Rollback owner and procedure rehearsed | BLOCKER | Assign owner and validate restore checklist |
| Staging static validation | PASS | Preserve evidence with candidate package |
| Production release approval | BLOCKER | Obtain approval after all evidence is complete |

**Final decision: NO-GO.** Production remains untouched until a fresh backup, immutable rollback references, and approved migration evidence are captured for the exact frozen release candidate.

