# Phase 103 — Production Migration Dry Run & Rollback Validation

Date: 2026-07-23  
Decision: **NO-GO — dry-run plan complete; Production execution remains blocked**

## Scope and safety boundary

This is a non-mutating rehearsal package. It defines the exact order, evidence,
and stop conditions for a future Production migration. It does not change
Production Apps Script, Sheets, Script Properties, LIFF, triggers, deployments,
or frontend hosting. It also does not commit or push.

All executable rehearsal steps must first use disposable staging fixtures and
the same approved release artifact structure. Production may be touched only
after the named release owner authorizes a separate execution window.

## 1. Migration inventory

### Release inputs

| Area | Candidate input | Inclusion rule | Current state |
| --- | --- | --- | --- |
| Production baseline | Existing Apps Script Web App version 74 | Preserve as current serving baseline. | Historical evidence only; re-confirm immediately before release. |
| Backend rollback | Existing immutable version 73 | Keep selectable on the same Web App deployment. | Historical rollback target; re-confirm. |
| Backend artifact | Isolated Production Apps Script tree | Include only approved runtime modules and `appsscript.json`; exclude tests, repair, diagnostics, migrations, fixtures, and `STAGING_*`. | SHA-256 not frozen. |
| Frontend artifact | Isolated tenant/landlord hosting artifact | Include only approved Production HTML/assets and Production environment configuration. | Revision/SHA not frozen. |
| Phase 83 binding correction | Read-only reconciliation classifier plus single-flight frontend behavior | Include only after separate Production frontend review; it must retain the existing route contract. | Staging-tested; not approved for Production. |

### Schema changes

| Category | Candidate schema/module | Migration classification | Dry-run decision |
| --- | --- | --- | --- |
| Notification delivery | Queue, template, log, security-failure support | Additive and feature-flagged only. | Optional; do not enable worker before recovery proof. |
| Contract/billing lifecycle | Contract, bill, and payment lifecycle additions | Additive and compatibility-reviewed only. | Optional; require legacy data preflight. |
| Repair workflow | Repair ticket schema and workflow | New product workflow. | Excluded unless explicitly approved for V2. |
| Move-out/settlement | Move-out, settlement, ledger schema | Financial workflow with rollback requirements. | Excluded unless separately approved. |
| Staging support | `STAGING_*`, fixture setup, allowlists, local resource config | Incompatible with a Production release. | Always excluded. |

Schema migration rules:

1. Create new Sheets or append new headers only; never rename, reorder, or
   delete existing Production columns.
2. Each approved migration needs a unique migration version, preflight result,
   row-count record, and rollback metadata.
3. Dependent feature flags remain disabled until the schema, runtime, trigger,
   and read-only smoke steps all pass.

### Trigger and Properties dependencies

| Dependency | Dry-run check | Release rule |
| --- | --- | --- |
| Existing Production triggers | Capture function, schedule, owner, enabled state, and environment using masked evidence. | Do not alter a trigger during dry run. |
| Notification worker | Confirm only one approved worker trigger exists if the queue feature is enabled. | Must be absent while queue feature is disabled. |
| Legacy/import/diagnostic triggers | Confirm none target test, repair, migration, diagnostics, or unapproved legacy code. | Fail closed. |
| Script Properties | Verify presence, environment purpose, owner, and scope by key name only. | Never print values, tokens, IDs, or UIDs. |
| Environment flags | Verify each newly introduced feature defaults to disabled. | Enable one approved feature at a time after its proof. |

## 2. Migration execution plan

The following sequence is a rehearsal order, not authorization to execute it
against Production.

```text
backup
  → schema migration
  → backend deployment
  → frontend deployment
  → trigger verification
  → smoke test
```

| Step | Required evidence before proceeding | Stop / rollback condition |
| --- | --- | --- |
| 0. Freeze release | Approved isolated backend/frontend SHA-256 manifests; approved schema subset; named release owner. | Any source, SHA, environment, or approval mismatch. |
| 1. Backup | Spreadsheet version/export checkpoint, Sheet header/row-count snapshot, deployment metadata, Properties presence matrix, trigger inventory. | Missing restore owner, checkpoint, or validation method. |
| 2. Schema migration | Read-only preflight confirms Sheet/header/key/workspace integrity; only additive approved operations are queued. | Header mismatch, duplicate canonical key, cross-workspace row, or unknown migration version. |
| 3. Backend deployment | Payload matches frozen SHA; project binding and current/rollback versions are verified using masked identifiers. | Any unexpected file, secret scan finding, route/handler regression, or binding mismatch. |
| 4. Frontend deployment | Artifact matches frozen SHA; Production host/LIFF environment settings are independently checked. | Wrong origin, staging reference, missing asset, or route regression. |
| 5. Trigger verification | Inventory confirms intended owner/function/schedule; staging and Production triggers are separated. | Duplicate worker, unapproved trigger, or test/migration/repair target. |
| 6. Read-only smoke test | Endpoint, LIFF identity, role boundary, resolver, and primary tenant/landlord projections return expected safe results. | Authentication failure, cross-role/workspace access, loop, payload incompatibility, or elevated runtime errors. |

No step may skip a failed predecessor. Any write-capable migration is performed
only once, with an idempotency/migration marker and a human observer.

## 3. Rollback plan

### Rollback triggers

Start rollback immediately if any of the following occurs:

- Cross-workspace or cross-role data access.
- Authentication, LIFF verification, or binding behavior prevents normal
  approved users from accessing their correct portal.
- Duplicate binding, notification, payment, or settlement side effect.
- Schema preflight/post-check mismatch, duplicate canonical key, or migration
  log inconsistency.
- Notification worker stalls jobs in `processing`, repeatedly duplicates work,
  or exposes sensitive logs.

### Rollback actions

| Surface | First safe action | Restoration action | Validation |
| --- | --- | --- | --- |
| Schema | Disable dependent feature flags; stop related trigger. | Restore only migration-owned rows from the verified checkpoint/migration log after review. Do not delete/reorder additive columns or Sheets by default. | Header/key/row-count and Workspace-isolation post-check. |
| Backend | Stop feature rollout and preserve incident evidence. | Point the existing Web App deployment back to immutable version 73 while retaining the existing URL. | Endpoint availability plus agreed read-only route smoke tests. |
| Frontend | Stop rollout to the new revision. | Restore the prior approved hosting revision; retain Production LIFF endpoint and origin mapping. | Asset SHA, `.html` route, LIFF redirect, and login-entry check. |
| Notification | Disable queue/worker feature flag and worker trigger before provider calls continue. | Leave queue/log evidence intact; return to prior runtime; manually reconcile only explicitly approved migration-owned jobs. | No new sends, sanitized logs, and no stuck processing lease. |

Rollback is complete only after the release owner records the incident,
restored artifact/version, affected scope, and read-only verification outcome.

## 4. Backup verification

### Required backup point

- [ ] Spreadsheet version/export checkpoint exists for every affected Sheet.
- [ ] Read-only schema snapshot records Sheet names, headers, row counts,
      canonical-key duplicate scan, and Workspace-key coverage.
- [ ] Current Web App deployment metadata records the serving version and the
      rollback target (historical baseline: v74; rollback target: v73).
- [ ] Production frontend hosting revision and artifact hash are recorded.
- [ ] Trigger inventory and Properties presence-only matrix are captured.
- [ ] Backup owner, timestamp, storage location, and restore approver are
      identified without embedding credentials in this document.

### Restore procedure rehearsal

1. Reproduce the approved migration against a disposable staging clone or
   explicit staging test boundary.
2. Capture before/after schema and migration-log evidence.
3. Trigger a defined rollback condition without using real Production users.
4. Restore migration-owned rows only; keep additive schema disabled rather
   than deleting it.
5. Re-run header, row-count, canonical-key, Workspace isolation, and endpoint
   checks.
6. Record elapsed time and any manual step that could prevent Production
   recovery inside the agreed release window.

The Production validation method is the same read-only comparison: expected
headers, expected row-count bounds, canonical-key uniqueness, and workspace
key consistency must match the approved snapshot after any operation.

## 5. Notification worker recovery rehearsal

Run only against a disposable staging queue and a safe provider/test boundary.
Do not use Production recipients or tokens for this rehearsal.

| State / scenario | Expected transition | Required proof |
| --- | --- | --- |
| `pending` | Worker claims one job as `processing`. | Single claim, durable queue ID, no duplicate worker claim. |
| `processing` | Successful provider result transitions to `sent`. | One sanitized delivery/log record and `sent_at`. |
| `processing` timeout | Lease recovery transitions to `retrying` or terminal `failed`. | Timeout threshold and recovery owner captured; no duplicate delivery. |
| `retrying` | Eligible retry returns to `processing`; delay respects retry policy. | Retry count and next-retry time update once. |
| Retry exhausted | Terminal `failed`; no further provider attempt. | Sanitized error and final count; no fourth attempt. |
| Duplicate event | Existing idempotency key suppresses duplicate queue creation. | One durable queue job/log lineage only. |

The Production worker remains disabled until this evidence, an approved trigger
owner, and a feature-flag rollback path are all confirmed.

## 6. Workspace isolation final matrix

Use two disposable staging Workspaces with independently authenticated roles.
No Production person, tenant, landlord, or business record is required.

| Caller | Request | Expected result |
| --- | --- | --- |
| Landlord A | Read Workspace A permitted data | Allow only authorized A-scoped data. |
| Landlord A | Read Workspace B tenant/contract/bill/message data | Deny before projection; return no B metadata. |
| Landlord B | Read Workspace A data | Deny before projection; return no A metadata. |
| Tenant A | Read own home, bills, contract, and authorized messages | Allow only Tenant A canonical identity chain. |
| Tenant A | Read Tenant B data | Deny before fallback or view lookup. |
| Tenant A | Invoke landlord route | Deny by RBAC. |
| Landlord A | Invoke tenant-only route | Deny by RBAC. |
| Either role | Supply another `workspace_id`, `tenant_id`, or `landlord_id` in request | Deny closed; server-derived identity remains authoritative. |
| Invalid/expired authentication | Any role route | Deny before resolver/Sheet access. |

The same matrix must be repeated after the final Production release artifact is
frozen, but before any new feature flag is enabled for Production traffic.

## 7. Release decision

### GO

Production migration may be approved only when all conditions are true:

- Approved, clean, isolated backend and frontend artifacts have matching
  SHA-256 manifests.
- Production Properties/LIFF/LINE/Spreadsheet binding inventory is confirmed
  by presence, scope, and environment only.
- Serving Web App version and rollback version are re-confirmed.
- Production trigger inventory/ownership is complete and separated from
  staging.
- The approved additive schema subset passes preflight, backup verification,
  and staging restore rehearsal.
- Notification recovery and two-Workspace isolation proofs pass.
- Named release owner and rollback owner approve the execution window.

### CONDITIONAL GO

Permitted only for a strictly non-mutating Production inventory or a read-only
preflight with no schema, backend, frontend, trigger, Property, or feature-flag
change. It is not approval to deploy or migrate.

### NO-GO — current decision

Production deployment and migration are blocked because the following
evidence is still incomplete:

1. Production credential/Property/LIFF/LINE configuration inventory is pending
   human confirmation.
2. Serving Production trigger inventory, ownership, and environment separation
   are pending confirmation.
3. Clean isolated frontend/backend artifact hashes and approved release scope
   are not frozen.
4. Approved additive schema subset, backup snapshot, restore rehearsal, and
   migration owner are not complete.
5. Notification worker remote recovery and two-Workspace isolation evidence
   are incomplete.

### Remaining human operations

1. Complete the sanitized Production inventory in the serving Apps Script,
   hosting, and LINE consoles; do not copy secrets into Git or reports.
2. Approve or exclude each optional schema/module category explicitly.
3. Freeze the exact release artifacts and have a second reviewer verify hashes.
4. Execute the staging restore and notification/isolation rehearsals, then
   attach sanitized evidence.
5. Name a release owner, backup owner, rollback owner, and release-window
   observer before any Production action is considered.

## Validation record

This document is planning-only. Local validation and staging validation must
pass before it is handed to release review; their command results are recorded
with this Phase execution rather than treated as Production evidence.
