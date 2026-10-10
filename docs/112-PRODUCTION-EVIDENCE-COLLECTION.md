# Phase 112 — Production Evidence Collection

Date: 2026-07-23  
Evidence status: **INCOMPLETE / NO-GO**

## Scope and evidence-handling rules

This document converts the Phase 111 approval checklist into concrete evidence
records. It does not collect by changing Production: no Production Sheet,
Property, trigger, Apps Script source/deployment, queue/log, LINE message,
commit, or push is allowed.

Evidence is limited to dated, sanitized, read-only screenshots/exports and
staging/mock test records. Never capture a secret, token, full Script/Sheet/
deployment/LIFF ID, URL token, or LINE UID. A lack of evidence remains
`PENDING`; it is never inferred from source code or staging.

## 1. Production credential evidence

| Evidence item | Safe collection method | Acceptance criteria | Owner | Status / reference |
| --- | --- | --- | --- | --- |
| LINE Login Channel | LINE Developers page with identifier masked. | Production ownership, expected audience and callback scope match approved Production frontend. | TBD | PENDING |
| Tenant LIFF ID | LIFF configuration page with ID masked. | Production channel and tenant endpoint origin match; no staging host/fallback. | TBD | PENDING |
| Landlord LIFF ID | LIFF configuration page with ID masked. | Production channel and landlord endpoint origin match; no staging host/fallback. | TBD | PENDING |
| Messaging API Channel | Official Account/Developer configuration with sensitive values hidden. | Production account/channel, expected push scope, distinct from staging. | TBD | PENDING |
| Token configuration | Apps Script Properties presence-only check. | Token Property exists/non-empty when push is approved; rotation owner/date known; no value shown. | TBD | PENDING |
| Apps Script Properties | Property-key presence/scope listing without values. | Environment, Spreadsheet, LIFF/frontend mapping, feature flags, timeout/retry keys are appropriate for Production. | TBD | PENDING |
| OAuth permissions | Apps Script project/service consent review. | Serving principal has only required scopes and Production resource access. | TBD | PENDING |
| Web App / project binding | Manage Deployments/Project Settings with IDs masked. | Serving deployment belongs to approved Production project and preserves URL/access model. | TBD | PENDING |

### Required Property-key evidence

Confirm key name, presence, owner, scope, and intended state only:

```text
CMWEBS_ENVIRONMENT
CMWEBS_SPREADSHEET_ID
CMWEBS_LINE_LOGIN_CHANNEL_ID
CMWEB_TENANT_LIFF_URL
CMWEB_TENANT_FRONTEND_BASE_URL
CMWEB_LANDLORD_FRONTEND_BASE_URL
LINE_CHANNEL_ACCESS_TOKEN
CMWEBS_LINE_VERIFY_TIMEOUT_MS
CMWEBS_LINE_VERIFY_MAX_ATTEMPTS
CMWEBS_NOTIFICATION_PROCESSING_TIMEOUT_MINUTES
CMWEBS_FEATURE_ALLOW_TEST_IDENTITY
CMWEBS_FEATURE_SCHEMA_MIGRATIONS
CMWEBS_FEATURE_NOTIFICATION_QUEUE
CMWEBS_FEATURE_REPAIR_WORKFLOW
CMWEBS_FEATURE_LEASE_LIFECYCLE
CMWEBS_FEATURE_BILLING_LIFECYCLE
CMWEBS_FEATURE_MOVE_OUT_SETTLEMENT
CMWEBS_FEATURE_SECURITY_FAILURE_QUEUE
```

Expected Production state: `CMWEBS_ENVIRONMENT` identifies Production;
test-identity and unapproved migration/queue/lifecycle/workflow flags are
disabled. Record values nowhere.

## 2. Production trigger evidence

Open the serving Production Apps Script project and inspect triggers without
editing them. Record function, schedule/time zone, enabled state, owner, and
environment assertion with masked evidence.

| Trigger | Handler | Environment | Status | Required verification | Evidence reference |
| --- | --- | --- | --- | --- | --- |
| Notification worker | `processNotificationQueue` | Production only after explicit approval | MUST NOT EXIST currently | If/when approved: one trigger, approved owner/schedule, feature flag, no staging dependency. | PENDING |
| Billing worker | `processBillingLifecycleNotifications` | Production only after explicit approval | MUST NOT EXIST currently | If/when approved: one trigger, approved scope/owner, no staging dependency. | PENDING |
| Contract-expiry worker | `processContractExpiryNotifications` | Production only after explicit approval | MUST NOT EXIST currently | If/when approved: one trigger, approved lifecycle scope/owner. | PENDING |
| Repair notification worker | Queue handler for `tenant_repair`, if approved | Production only after explicit approval | MUST NOT EXIST currently | If/when approved: one trigger plus repair workflow approval. | PENDING |
| Existing reminder | `runV2AutomaticPaymentReminders` | Production candidate | PENDING HUMAN CONFIRMATION | Actual schedule/owner/env and no staging/config cross-over. | PENDING |
| Existing paid-bill sync | `syncV1PaidBillsToV2` | Legacy candidate | PENDING HUMAN CONFIRMATION | Actual schedule/owner/env and no unapproved dependency. | PENDING |

Evidence acceptance:

- [ ] At most one enabled trigger exists per approved handler/environment.
- [ ] Production trigger and Properties are Production-scoped; staging trigger
      and Properties are staging-scoped.
- [ ] No trigger targets tests, fixtures, diagnostics, repair, migration,
      `STAGING_*`, or unapproved lifecycle code.
- [ ] A named owner and emergency-stop procedure exist for every active worker.

## 3. Notification worker recovery evidence

Use only a disposable staging queue and mock transport. Do not create a
Production queue row or log, and do not call LINE provider transport.

| Test | Setup | Expected evidence | Pass condition | Status |
| --- | --- | --- | --- | --- |
| Failed job handling | Mock controlled provider failure. | Sanitized error; state transition; retry count and next retry. | `pending → processing → retrying` once. | PENDING |
| Retry behavior | Eligible retry with mock success/failure. | Retry schedule and final state lineage. | First delay 5m, second 30m; one final `sent` or `failed`. | PENDING |
| Stale processing recovery | Simulate expired `processing` lease. | Recovery owner/time and single-claim proof. | `processing → retrying` or `failed`; no duplicate delivery. | PENDING |
| Final status transition | Exhaust bounded retries. | Sanitized terminal reason/count. | `failed`; no further provider attempt. | PENDING |
| Duplicate prevention | Submit same synthetic idempotency key twice. | Queue/job/log counts. | One job/one delivery lineage only. | PENDING |

All evidence must state that mock transport was used and no `UrlFetchApp`
provider call or real recipient was involved.

## 4. Workspace isolation evidence

Create independent disposable staging Workspaces and identities. Capture only
masked labels, route/action, HTTP/API result, code, time, and redacted logs.

| Caller | Same-Workspace test | Expected | Cross-Workspace / role test | Expected | Status |
| --- | --- | --- | --- | --- | --- |
| Workspace A landlord | Read authorized A workspace projection. | PASS | Read B data or tenant-only route. | DENY before projection. | PENDING |
| Workspace A tenant | Read own home/bills/contract/authorized message projection. | PASS | Read B/Tenant B or landlord route. | DENY before projection. | PENDING |
| Workspace B landlord | Read authorized B workspace projection. | PASS | Read A data or tenant-only route. | DENY before projection. | PENDING |
| Workspace B tenant | Read own home/bills/contract/authorized message projection. | PASS | Read A/Tenant A or landlord route. | DENY before projection. | PENDING |
| Invalid/expired session | No protected access. | DENY | Any protected route. | DENY before resolver/Sheet access. | PENDING |
| Caller-supplied alternate IDs | None. | DENY | Alternate workspace/tenant/landlord identifier. | Server-derived identity wins. | PENDING |

A same-Workspace **PASS** and any expected cross-Workspace/cross-role **DENY**
are both required. Any leaked projection or metadata is an immediate NO-GO.

## 5. Migration / rollback evidence

| Evidence | Required content | Acceptance criteria | Owner | Status |
| --- | --- | --- | --- | --- |
| Backup point | Sheet/export checkpoint, schema snapshot, deployment/version snapshot, trigger/Properties presence snapshot. | Timestamp, storage/restore owner, and validation method recorded without secrets. | TBD | PENDING |
| Migration sequence | Approved additive migration IDs, dependency order, preflight results. | No rename/reorder/delete/overwrite; compatibility validated. | TBD | PENDING |
| Rollback procedure | Frontend revision, backend immutable version, schema migration-log recovery, notification stop path. | Ordered, named, and repeatable in staging clone. | TBD | PENDING |
| Rollback verification | Staging-clone restore/reversal record. | Headers, rows, canonical keys, `workspace_id`, endpoint, and isolation checks pass. | TBD | PENDING |

Historical reference only: Production serving baseline was documented as v74
with v73 rollback target. Both must be re-confirmed immediately before a
separately authorized release.

## 6. Release artifact manifest evidence

| Field | Evidence required | Current value |
| --- | --- | --- |
| Release ID | Approved immutable release label. | `RC-TBD` |
| Frontend SHA | Clean isolated Production-only artifact; second reviewer recomputation. | `TBD` |
| Frontend revision | Immutable hosting revision plus prior rollback revision. | `TBD` |
| Backend SHA | Per-file Apps Script manifest from clean isolated tree; second reviewer match. | `TBD` |
| Backend Version | Immutable Apps Script version assigned only during authorized deployment. | `TBD` |
| Schema Version | Explicit approved additive migration IDs. | `TBD` |
| Timestamp | Freeze date/time/timezone plus reviewers. | `TBD` |

The artifact must exclude local credentials, `.clasp.json`, tests, diagnostics,
repair/migration/fixture tooling, `STAGING_*`, test identities, mock transport,
and unapproved workflow modules.

## 7. Final gate update

### GO

Only after all evidence tables above are complete and approved: credential and
trigger scope matches Production; exact artifact/SHA/schema are frozen; backup
and rollback rehearsal pass; mock worker recovery passes; two-Workspace
isolation passes; and named release/backup/rollback owners approve the window.

### CONDITIONAL GO

Allows read-only Production evidence collection and staging/mock validation
only. It does not allow Production migration, deployment, trigger/Property
change, queue/log write, or real LINE send.

### NO-GO — current decision

Evidence has not yet been collected for the serving Production environment,
trigger inventory, artifact freeze, backup/rollback rehearsal, worker recovery,
or full Workspace isolation matrix.

### Remaining human actions

1. Collect masked credential, Property, OAuth, deployment, and trigger evidence
   from the serving Production consoles.
2. Run staging mock notification recovery evidence tests and two-Workspace
   isolation tests with disposable fixtures.
3. Approve/exclude optional schema/workflow scope and create the clean RC.
4. Freeze and independently review frontend/backend/schema manifests.
5. Verify backup/rollback owners and attach staging restore evidence, then
   convene a separate Production release approval.

## Validation record

Run `npm run validate`, the staging validator, and `git diff --check` for this
Phase. Those checks validate static source/artifact integrity only; they do not
constitute serving-Production evidence.
