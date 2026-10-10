# Phase 109 — Production Release Candidate Manifest + SHA Freeze

Date: 2026-07-23  
Release candidate status: **NOT FROZEN / NO-GO**

## Scope and manifest rule

This document defines the complete, traceable manifest that must accompany a
future Production release candidate. It does not produce a deployable artifact,
calculate a Production candidate hash from the dirty working tree, modify
Production, deploy, commit, or push.

The historical Phase 80 artifact is useful evidence of an earlier isolated
boundary, but it is **not automatically this release candidate**. Its hashes
must not be copied into an RC created after later source changes. A new RC is
valid only after it is rebuilt from a clean isolated tree and independently
verified by a second reviewer.

## 1. Release Candidate identity

| Field | Value | Freeze condition |
| --- | --- | --- |
| Release ID | `RC-TBD` | Use an approved date/version identifier after scope freeze. |
| Candidate timestamp | `TBD` | UTC/local timestamp at immutable artifact creation. |
| Source commit/revision | `TBD` | Must refer to reviewed source; no aggregate dirty worktree. |
| Frontend revision | `TBD` | Immutable Production hosting revision from RC artifact. |
| Frontend SHA-256 manifest | `TBD` | Second reviewer independently recomputes. |
| Backend Apps Script source SHA-256 manifest | `TBD` | Second reviewer independently recomputes. |
| Backend immutable Apps Script version | `TBD` | Assigned only during separately authorized deployment. |
| Current serving baseline | Historical v74 | Re-confirm immediately before execution. |
| Backend rollback version | Historical v73 | Re-confirm selectable on existing Web App deployment. |
| Schema migration version(s) | `TBD` | Include only explicitly approved additive migrations. |
| Manifest reviewer A / B | `TBD` | Two named independent reviewers required. |

## 2. Artifact manifest

### 2.1 Historical isolated boundary reference

`release/phase80/RELEASE-MANIFEST.json` describes an earlier built-but-not-
deployed isolated payload: 30 Apps Script modules plus `appsscript.json`, and
four tenant HTML files. It is a reference for release-boundary construction;
it is not the Phase 109 RC unless every byte is rebuilt and re-approved.

### 2.2 Candidate frontend manifest

The final RC must list each Production file and hash. The current minimum
historical boundary is shown below; candidate inclusion remains `TBD` until a
clean artifact is built.

| Frontend file / asset | Purpose | Candidate inclusion | SHA-256 |
| --- | --- | --- | --- |
| `tenant-bind.html` | Tenant LINE entry/binding flow | TBD | TBD |
| `tenant-home.html` | Tenant home portal | TBD | TBD |
| `tenant-bills.html` | Tenant billing portal | TBD | TBD |
| `tenant-message.html` | Tenant landlord-message portal | TBD | TBD |
| Required shared JS/CSS/environment assets | Only assets referenced by the selected Production HTML files. | TBD | TBD |
| Hosting revision | Immutable Production hosting revision for this exact artifact. | TBD | N/A |

Candidate frontend proof:

- [ ] All canonical `.html` routes and required static assets exist.
- [ ] Internal link scan passes.
- [ ] No staging host, LIFF, endpoint, test UID, mock transport, fixture, or
      fallback exists in the artifact.
- [ ] API/JSONP and LIFF configuration retain approved Production contracts.

### 2.3 Candidate backend manifest

The historical Phase 80 runtime boundary listed the following modules. The
final RC must re-derive this list based on approved scope and file dependency
analysis; no file is included merely because it appears here.

| Module / entry point | Historical Phase 80 role | Candidate inclusion | SHA-256 |
| --- | --- | --- | --- |
| `程式碼.js` | Web App dispatcher / route entry point | TBD | TBD |
| `V2_API.js` | Canonical API handlers | TBD | TBD |
| `V2_RUNTIME_SNAPSHOT.js` | Request snapshot and Spreadsheet-handle reuse dependency | TBD | TBD |
| `V2_TENANT_RUNTIME_RESOLVER.js` | Canonical tenant/contract/property/room resolver | TBD | TBD |
| `V2_TENANT_BINDING_PHONE.js` | Tenant binding workflow | TBD | TBD |
| `V2_TENANT_LEASE_ONBOARDING.js` | Tenant lease onboarding support | TBD | TBD |
| `V2_TENANT_MESSAGES.js` | Tenant/landlord message resolution | TBD | TBD |
| `V2_TENANT_PAYMENT_REPORTS.js` | Tenant payment reports | TBD | TBD |
| `V2_TENANT_CHECKIN_MANAGEMENT.js` | Tenant check-in support | TBD | TBD |
| `V2_BILLING_MANAGEMENT.js` | Core billing management | TBD | TBD |
| `V2_BILL_NOTIFICATIONS.js` | Existing bill notification support | TBD | TBD |
| `V2_AUTO_PAYMENT_REMINDER.js` | Existing automated payment reminder support | TBD | TBD |
| `V2_PAID_BILL_MANAGEMENT.js` | Paid-bill workflow support | TBD | TBD |
| `V2_PAYMENT_SETTLEMENT.js` | Existing payment settlement support | TBD | TBD |
| `V2_PAYMENT_REVERSAL.js` | Existing payment reversal support | TBD | TBD |
| `V2_MANUAL_SETTLEMENT.js` | Existing manual settlement support | TBD | TBD |
| `V2_CONTRACT_REQUESTS.js` | Existing contract-request workflow | TBD | TBD |
| `V2_PROPERTY_ROOM_MANAGEMENT.js` | Property/room support | TBD | TBD |
| `V2_SYSTEM_SETTINGS.js` | System settings | TBD | TBD |
| `V2_SETTINGS_INTEGRATION.js` | Settings integration | TBD | TBD |
| `V2_WORKSPACES.js` | Workspace helpers | TBD | TBD |
| `V2_WORKSPACE_CREATION.js` | Existing workspace creation support | TBD | TBD |
| `V2_WORKSPACE_LANDLORD_ACCESS.js` | Workspace landlord authorization | TBD | TBD |
| `V2_WORKSPACE_DASHBOARD_NATIVE.js` | Workspace dashboard support | TBD | TBD |
| `V2_WORKSPACE_NOTIFICATIONS.js` | Workspace notification support | TBD | TBD |
| `V2_WORKSPACE_OPERATION_AUDIT.js` | Workspace operation auditing | TBD | TBD |
| `V2_TEAM_MANAGEMENT.js` | Team management support | TBD | TBD |
| `V2_LANDLORD_MANAGEMENT.js` | Landlord management support | TBD | TBD |
| `V2_LANDLORD_ONBOARDING.js` | Landlord onboarding support | TBD | TBD |
| `V2_ANNOUNCEMENT_MANAGEMENT.js` | Announcement support | TBD | TBD |
| `appsscript.json` | Apps Script manifest | TBD | TBD |

Backend entry-point and trigger policy:

- `程式碼.js` is the single route dispatcher in the candidate runtime.
- No new notification worker is included or enabled unless the queue schema,
  worker recovery evidence, feature flag, and explicit V2 approval are all
  attached to this manifest.
- Existing trigger handlers must be listed in a separate serving-Production
  inventory with function, schedule, owner, and environment evidence.

### 2.4 Excluded backend/module classes

The following are excluded by default and must never enter the RC without an
explicit Production-safe exception:

```text
TESTS.js and admin diagnostics
V2_TENANT_RUNTIME_DATA_REPAIR.js
V2_TENANT_RUNTIME_VALIDATION.js
V2_LEGACY_BILL_IMPORT.js
repair/migration/fixture scripts and STAGING_* modules
local .clasp.json/.clasprc.json, OAuth credentials, tokens, keys
staging config, test UIDs, mock transports
unapproved notification queue/lifecycle/repair/move-out/settlement modules
```

### 2.5 Schema manifest

| Migration file / version | Required tables/headers | Candidate inclusion | Rollback reference |
| --- | --- | --- | --- |
| Existing baseline schema | Existing approved V2 tables only | TBD | Pre-release schema snapshot / backup. |
| Notification queue/log/template additions | Queue/log/template tables and additive headers only when approved | TBD | Migration-owned rows/log; disable flag/trigger first. |
| Contract/billing lifecycle additions | Approved additive fields only | TBD | Migration-specific backup/log. |
| Repair/move-out/settlement additions | New workflow tables/ledger | Excluded unless separately approved | Separate financial/workflow rollback plan. |

No migration may rename, reorder, delete, or overwrite an existing Production
column. All approved steps require schema preflight, row-count/key checks,
`workspace_id` coverage, a migration version, and a restore reference.

### 2.6 Documentation and tests

| Category | Required manifest entry | Status |
| --- | --- | --- |
| Documentation | Release notes, deployment plan, rollback plan, human verification record, incident contacts. | TBD |
| Canonical static validation | Route/handler/declaration/credential/manifest/link result. | PASS for current source; rerun on RC. |
| Staging static validation | Staging route/handler/declaration/credential/link result. | PASS for current staging artifact; rerun for approved scope. |
| Runtime evidence | Staging mock-notification recovery, two-Workspace isolation, LIFF identity/role smoke evidence. | PENDING |
| Production read-only evidence | Environment, trigger, deployment, rollback, and configuration presence/scope checklist. | PENDING HUMAN CONFIRMATION |

## 3. SHA manifest procedure

For each file in the selected frontend, backend, schema, and release-document
trees, record the following without including secrets:

| Filename | SHA-256 | Source tree | Environment | Reviewer A | Reviewer B |
| --- | --- | --- | --- | --- | --- |
| `TBD` | `TBD` | `TBD` | Production RC | `TBD` | `TBD` |

Procedure:

1. Build a fresh isolated RC tree from approved source only.
2. Scan it for credentials, staging references, excluded files, duplicate
   declarations, route/handler regressions, and broken links.
3. Generate SHA-256 manifests inside the RC directory.
4. Have a second reviewer regenerate and compare every hash/file list.
5. Freeze the artifact location read-only for the release window.
6. Invalidate the RC if any source, environment mapping, manifest, or hash
   changes; rebuild rather than editing a frozen candidate in place.

## 4. Environment separation

All entries are existence/scope checks. No secret, token, complete identifier,
or endpoint token is permitted in this document or manifest.

| Resource | Staging expectation | Production expectation | RC status |
| --- | --- | --- | --- |
| LIFF | Staging LIFF/channel and staging origin only. | Production LIFF/channel and approved Production origin only. | PENDING HUMAN CONFIRMATION |
| LINE Login | Staging callback/audience only. | Production callback/audience only. | PENDING HUMAN CONFIRMATION |
| LINE Messaging | Staging channel/token only. | Separate Production channel/token Property only. | PENDING HUMAN CONFIRMATION |
| Apps Script Properties | Staging project and values only. | Serving Production project, presence/scope verified by key name only. | PENDING HUMAN CONFIRMATION |
| Trigger inventory | Staging trigger owners/functions only. | Production trigger owners/functions only, no staging reference. | PENDING HUMAN CONFIRMATION |
| Spreadsheet binding | Staging-owned data only. | Production-owned data only. | PENDING HUMAN CONFIRMATION |

## 5. Rollback package

| Surface | Required rollback evidence | Current state |
| --- | --- | --- |
| Previous Production version | Serving baseline and immutable rollback version documented. | Historical v74 / v73; re-confirm immediately before release. |
| Schema rollback point | Backup checkpoint, migration log, restore owner, and approved no-destructive rollback procedure. | TBD |
| Backend rollback path | Existing Web App deployment can be repointed to verified prior immutable version while retaining URL. | Historical; re-confirm. |
| Frontend rollback path | Prior approved hosting revision and artifact SHA identified. | TBD |
| Notification rollback | Feature flag off, worker trigger disabled, queue/log retained for reconciliation. | TBD |
| Data recovery plan | Restore only migration-owned rows after review; retain additive headers/Sheets disabled rather than deleting. | TBD |

## 6. Release gate status

### READY

- [x] Current canonical static validation passes: 68 routes and 68/68 handlers,
      with zero duplicate declarations, blocking credentials, or missing links.
- [x] Current staging static validation passes: 87 routes and 87/87 handlers,
      with zero duplicate declarations, blocking credentials, or missing links.
- [x] Historical isolated Phase 80 manifest demonstrates a prior release-tree
      boundary and exclusion strategy.
- [x] Phase 109 does not modify Production, deploy, commit, or push.

### BLOCKED

- [ ] A clean isolated Phase 109 candidate file list and SHA-256 manifest are
      not generated or independently reviewed.
- [ ] Candidate source revision, frontend hosting revision, backend immutable
      version, and schema migration version are not frozen.
- [ ] Serving Production environment, credential presence, trigger inventory,
      and project/deployment binding remain pending sanitized human evidence.
- [ ] Backup/restore rehearsal, notification recovery, and two-Workspace
      isolation evidence are incomplete.
- [ ] Optional lifecycle/workflow scope has not been approved for Production.

### Human approval required

1. Approve/exclude the exact backend, frontend, schema, and notification scope.
2. Build the isolated candidate and complete Sections 1–3 with two reviewers.
3. Complete Production environment and trigger presence/scope verification.
4. Confirm backup, rollback, and release owners; attach staging recovery and
   isolation evidence.
5. Obtain explicit authorization before any future deployment phase.

## Final decision

**NO-GO.** This is a complete manifest template and historical-boundary
reference, not a frozen Production Release Candidate. Production remains
untouched.

## Validation record

`npm run validate`, the staging validator, and `git diff --check` are run for
this Phase. They validate source integrity but do not replace RC SHA generation
from a clean isolated tree or the required human environment evidence.
