# Phase 78 — Production Release Tree

日期：2026-07-21

狀態：**BOUNDARY VERIFIED — CLEAN TREE SPECIFIED, NOT MATERIALIZED OR DEPLOYED**

## 1. Scope

本文件把 Phase 77 manifest 具體化為 production release tree 規格，逐一檢查目前
`apps-script/` 的 34 個 JavaScript 模組，並標記：

- 是否直接使用 `runtimeSpreadsheet_()`；
- 是否需要 `V2_RUNTIME_SNAPSHOT.js`；
- 是否屬 production path；
- 是否納入 minimum deploy set。

本階段只建立文件。沒有複製或修改 production code、API schema、frontend behavior、
manifest、Sheet、clasp binding 或 deployment。由於目前 canonical source 仍有明確
orphan dependency，建立實體 `release/phase78` source tree 必須等該 boundary 依 Phase
77 的 sanitized-v74 provenance rule 產生並驗證後才能進行。

## 2. Target release tree

下一個乾淨 release artifact 應採以下結構：

```text
release/phase78/
├── apps-script/
│   ├── appsscript.json
│   ├── 程式碼.js
│   ├── V2_RUNTIME_SNAPSHOT.js
│   ├── V2_TENANT_RUNTIME_RESOLVER.js
│   └── 其餘 27 個 production runtime modules
├── public/
│   ├── tenant-bind.html
│   ├── tenant-home.html
│   ├── tenant-bills.html
│   └── tenant-message.html
├── APPS-SCRIPT-SHA256SUMS
├── FRONTEND-SHA256SUMS
└── RELEASE-MANIFEST.json
```

This is a target layout only. It was not created in Phase 78.

## 3. Production included — Apps Script modules

Counts below are direct call-site counts in the current canonical source. “Needs snapshot” means
the module cannot execute its current Spreadsheet path unless `V2_RUNTIME_SNAPSHOT.js` is loaded in
the same Apps Script project.

| Module | `runtimeSpreadsheet_()` calls | Other snapshot use | Production path | Include |
|---|---:|---|---|---|
| `程式碼.js` | 0 | `runtimeSnapshotBegin_()` | `doGet` dispatcher for 68 routes | YES |
| `V2_API.js` | 12 | value reader + two finish calls | Tenant Home/Bills, output and shared API helpers | YES |
| `V2_RUNTIME_SNAPSHOT.js` | defines helper | defines lifecycle, value/context cache and counters | Mandatory request runtime foundation | YES |
| `V2_TENANT_RUNTIME_RESOLVER.js` | 1 | value reader + context get/set/reuse | Canonical tenant identity chain | YES |
| `V2_ANNOUNCEMENT_MANAGEMENT.js` | 7 | via helper | Announcement routes/workflows | YES |
| `V2_AUTO_PAYMENT_REMINDER.js` | 3 | via helper | Reminder scheduling/runtime | YES |
| `V2_BILLING_MANAGEMENT.js` | 7 | via helper | Billing init/generation routes | YES, sanitized source only |
| `V2_BILL_NOTIFICATIONS.js` | 5 | via helper | Bill-notification routes | YES |
| `V2_CONTRACT_REQUESTS.js` | 6 | one snapshot value reader | Tenant/landlord contract routes | YES, sanitized source only |
| `V2_LANDLORD_MANAGEMENT.js` | 3 | via helper | Compatibility/shared landlord runtime | YES |
| `V2_LANDLORD_ONBOARDING.js` | 5 | via helper | Landlord onboarding routes | YES |
| `V2_MANUAL_SETTLEMENT.js` | 5 | via helper | Manual settlement route dependencies | YES |
| `V2_PAID_BILL_MANAGEMENT.js` | 1 | via helper | Paid-bill route dependencies | YES |
| `V2_PAYMENT_REVERSAL.js` | 3 | via helper | Payment reversal route dependencies | YES |
| `V2_PAYMENT_SETTLEMENT.js` | 2 | via helper | Payment settlement route dependencies | YES |
| `V2_PROPERTY_ROOM_MANAGEMENT.js` | 10 | via helper | Property/room routes | YES, sanitized source only |
| `V2_SETTINGS_INTEGRATION.js` | 2 | via helper | Settings compatibility/runtime dependency | YES |
| `V2_SYSTEM_SETTINGS.js` | 8 | via helper | Settings routes | YES |
| `V2_TEAM_MANAGEMENT.js` | 11 | via helper | Team and invitation routes | YES |
| `V2_TENANT_BINDING_PHONE.js` | 6 | via helper | Tenant binding routes | YES, sanitized source only |
| `V2_TENANT_CHECKIN_MANAGEMENT.js` | 5 | via helper | Tenant check-in routes | YES |
| `V2_TENANT_LEASE_ONBOARDING.js` | 5 | via helper | Tenant creation/lease routes | YES, sanitized source only |
| `V2_TENANT_MESSAGES.js` | 2 | resolver indirectly uses snapshot | Tenant Message routes and recipient isolation | YES |
| `V2_TENANT_PAYMENT_REPORTS.js` | 3 | via helper | Tenant payment-report routes | YES |
| `V2_WORKSPACES.js` | 8 | one snapshot value reader | Workspace identity/context routes | YES |
| `V2_WORKSPACE_CREATION.js` | 1 | via helper | Additional Workspace route | YES |
| `V2_WORKSPACE_DASHBOARD_NATIVE.js` | 1 | via helper | Native landlord dashboard routes | YES |
| `V2_WORKSPACE_LANDLORD_ACCESS.js` | 2 | via helper | Workspace landlord proxy/compatibility routes | YES |
| `V2_WORKSPACE_NOTIFICATIONS.js` | 9 | via helper | Notification routes/runtime | YES |
| `V2_WORKSPACE_OPERATION_AUDIT.js` | 4 | via helper | Workspace activity routes | YES |

Production JavaScript count: **30**.

`appsscript.json` is also included unchanged, giving **31 Apps Script push files**.

## 4. Production included — frontend HTML

| HTML | Production purpose | Include |
|---|---|---|
| `tenant-bind.html` | Bound/test identity navigation continuity | YES |
| `tenant-home.html` | Primary Home render plus lazy contract/property state | YES |
| `tenant-bills.html` | Bills payload compatibility and test identity continuity | YES |
| `tenant-message.html` | Message API test identity continuity | YES |

These four files form an independent GitHub Pages publication unit. They are not placed under the
clasp source root and must not be mixed into the Apps Script checksum.

## 5. Runtime dependencies

### Core lifecycle

```text
程式碼.js / doGet
  ↓ runtimeSnapshotBegin_(v2_action)
V2_RUNTIME_SNAPSHOT.js
  ↓
route handler module
  ↓ runtimeSpreadsheet_()
Spreadsheet handle
  ↓ runtimeSnapshotGetValues_() when supported
request-level values/context
  ↓
V2_API.js / jsonOutput_ or htmlBridgeOutput_
  ↓ runtimeSnapshotFinish_()
response
```

### Tenant critical paths

```text
tenant_home
  → V2_API.js
  → V2_TENANT_RUNTIME_RESOLVER.js
  → V2_RUNTIME_SNAPSHOT.js
  → V2_tenants / contracts / home view / bill view / room / property / landlord link

tenant_bills
  → V2_API.js
  → V2_RUNTIME_SNAPSHOT.js
  → tenant / contract / bill view / bills

tenant_contract_init
  → V2_CONTRACT_REQUESTS.js
  → V2_RUNTIME_SNAPSHOT.js

tenant_message_init
  → V2_TENANT_MESSAGES.js
  → V2_TENANT_RUNTIME_RESOLVER.js
  → V2_RUNTIME_SNAPSHOT.js
```

### Dependency result

- 28 production modules directly call `runtimeSpreadsheet_()`.
- `V2_RUNTIME_SNAPSHOT.js` defines the helper and is mandatory.
- `程式碼.js` starts request state through `runtimeSnapshotBegin_()`.
- `V2_API.js` ends request state through `runtimeSnapshotFinish_()`.
- The only direct `SpreadsheetApp.openById()` and
  `SpreadsheetApp.getActiveSpreadsheet()` calls are inside the snapshot helper.
- Apps Script top-level symbols are project-global, so every included caller can resolve the helper
  when all 31 files are pushed atomically.

Designed release dependency result: **COMPLETE**.

## 6. Excluded Apps Script modules

| Module | Canonical direct helper use | Classification | Exclusion reason |
|---|---:|---|---|
| `TESTS.js` | 5 `runtimeSpreadsheet_()` calls | Development/test only | Diagnostics and fixtures are not Web App runtime |
| `V2_TENANT_RUNTIME_DATA_REPAIR.js` | 5 calls | Admin/repair/write tooling | Contains repair and derived-View synchronization |
| `V2_TENANT_RUNTIME_VALIDATION.js` | none directly | Validation utility | Manual read-only verification, no route dependency |
| `V2_LEGACY_BILL_IMPORT.js` | 1 call | Migration only | Manual legacy bill import; no production route or retained runtime edge |

Also excluded:

- `.clasp.json` and `.clasprc.json`;
- OAuth/client-secret/credential files;
- Script Property values, tokens and UIDs;
- debug-only fixtures and temporary scripts;
- `syncTenantRuntimeViewsForTenant_()` and all callers;
- repair, migration, preview, diagnosis and rollback entrypoints;
- documentation and checksum files from the clasp source root.

`V2_RUNTIME_SNAPSHOT.js` is **not** debug-only. Although it contains counters and Logger output, it
also owns the required Spreadsheet handle and snapshot functions.

## 7. Per-module production-path conclusion

| Classification | Modules | Result |
|---|---:|---|
| Production runtime | 30 JavaScript modules | Include atomically |
| Test/development only | `TESTS.js` | Exclude |
| Admin/repair | `V2_TENANT_RUNTIME_DATA_REPAIR.js` | Exclude |
| Validation utility | `V2_TENANT_RUNTIME_VALIDATION.js` | Exclude |
| Migration only | `V2_LEGACY_BILL_IMPORT.js` | Exclude |
| Frontend production | 4 tenant HTML files | Publish as separate atomic unit |

Phase 55 previously found no removable module inside the 29-module v74 production runtime after
legacy import was excluded. Phase 69–71 adds one new mandatory production module—the snapshot
helper—so no included production module is currently classified as unused.

## 8. Release blockers

### P0 — current canonical orphan dependency

The current `apps-script/` root contains six production write-path calls to
`syncTenantRuntimeViewsForTenant_()`:

| Caller module | Calls |
|---|---:|
| `V2_BILLING_MANAGEMENT.js` | 1 |
| `V2_CONTRACT_REQUESTS.js` | 1 |
| `V2_PROPERTY_ROOM_MANAGEMENT.js` | 1 |
| `V2_TENANT_BINDING_PHONE.js` | 2 |
| `V2_TENANT_LEASE_ONBOARDING.js` | 1 |

The only definition is in excluded `V2_TENANT_RUNTIME_DATA_REPAIR.js`.

Consequences:

- Pushing the whole canonical tree includes repair/write tooling and violates the release boundary.
- Removing the repair module from the canonical tree leaves six orphan calls.
- First-row or silent no-op fallback is prohibited.

Resolution required before tree materialization: use the sanitized v74 versions of these five
modules as the base, then apply only the Phase 71B mechanical `runtimeSpreadsheet_()` changes. Do
not include the View-sync calls.

### P0 — stale Phase 54 tree

`release/phase54/apps-script/` is the v74 source baseline but cannot be redeployed as the Phase 78
performance build because it lacks:

- `V2_RUNTIME_SNAPSHOT.js`;
- Phase 69 Home read profile;
- Phase 70 snapshot integration;
- Phase 71B helper substitutions.

It remains rollback/source-provenance material only.

### P1 — mixed source provenance

`V2_API.js`, `程式碼.js`, resolver, Messages, and the four tenant HTML files contain changes from
multiple phases. A release builder must apply or select reviewed deltas rather than copy the entire
dirty worktree without comparison to v74.

### P1 — Logger instrumentation

`runtimeSnapshotFinish_()` can log structured counters for many runtime executions. It does not
expose IDs or secrets and does not alter API payloads, but retention must be explicitly approved for
Phase 75 measurement or gated in a separate reviewed change.

### P1 — validation status

The canonical repository validator can pass while the proposed excluded-module tree is not yet
materialized. The actual Phase 78 tree must receive its own validator, syntax, dependency and
checksum run before any clasp operation.

## 9. Orphan dependency findings

| Finding | Current canonical | Designed release tree |
|---|---|---|
| `runtimeSpreadsheet_()` definition | Present | Present |
| Callers have snapshot module | Yes when whole canonical is loaded | Yes |
| Repair/View-sync symbol closure | Depends on excluded repair module | Zero references required |
| TESTS dependency from production route | None found | Absent |
| Validation utility dependency from production route | None found | Absent |
| Legacy import dependency from production route | None found | Absent |

Confirmed orphan blocker: the six View-sync calls only. No orphan is accepted in the final tree.

## 10. Unused-module findings

- `V2_LEGACY_BILL_IMPORT.js`: unused by production routes; migration-only; exclude.
- `V2_TENANT_RUNTIME_VALIDATION.js`: no production route/handler dependency; exclude.
- `TESTS.js`: no production route dependency; exclude.
- `V2_TENANT_RUNTIME_DATA_REPAIR.js`: required only by unapproved View-sync/repair paths; exclude
  together with all callers.
- No included production module is currently proven unused at module granularity.
- Definition-only manual Apps Script entrypoints are not automatically dead code because Apps
  Script may invoke them by name; they require separate symbol-level cleanup, not removal during
  this release.

## 11. Minimum deploy file list

### Backend — Apps Script whole-project source

```text
apps-script/appsscript.json
apps-script/程式碼.js
apps-script/V2_RUNTIME_SNAPSHOT.js
apps-script/V2_API.js
apps-script/V2_TENANT_RUNTIME_RESOLVER.js
apps-script/V2_ANNOUNCEMENT_MANAGEMENT.js
apps-script/V2_AUTO_PAYMENT_REMINDER.js
apps-script/V2_BILLING_MANAGEMENT.js
apps-script/V2_BILL_NOTIFICATIONS.js
apps-script/V2_CONTRACT_REQUESTS.js
apps-script/V2_LANDLORD_MANAGEMENT.js
apps-script/V2_LANDLORD_ONBOARDING.js
apps-script/V2_MANUAL_SETTLEMENT.js
apps-script/V2_PAID_BILL_MANAGEMENT.js
apps-script/V2_PAYMENT_REVERSAL.js
apps-script/V2_PAYMENT_SETTLEMENT.js
apps-script/V2_PROPERTY_ROOM_MANAGEMENT.js
apps-script/V2_SETTINGS_INTEGRATION.js
apps-script/V2_SYSTEM_SETTINGS.js
apps-script/V2_TEAM_MANAGEMENT.js
apps-script/V2_TENANT_BINDING_PHONE.js
apps-script/V2_TENANT_CHECKIN_MANAGEMENT.js
apps-script/V2_TENANT_LEASE_ONBOARDING.js
apps-script/V2_TENANT_MESSAGES.js
apps-script/V2_TENANT_PAYMENT_REPORTS.js
apps-script/V2_WORKSPACES.js
apps-script/V2_WORKSPACE_CREATION.js
apps-script/V2_WORKSPACE_DASHBOARD_NATIVE.js
apps-script/V2_WORKSPACE_LANDLORD_ACCESS.js
apps-script/V2_WORKSPACE_NOTIFICATIONS.js
apps-script/V2_WORKSPACE_OPERATION_AUDIT.js
```

The paths above describe destination names in the future isolated source root. They do not authorize
copying the current canonical bytes; the five sanitized-source exceptions in Section 8 are
mandatory.

### Frontend — GitHub Pages publication

```text
tenant-bind.html
tenant-home.html
tenant-bills.html
tenant-message.html
```

### Not deploy files

```text
docs/78-PRODUCTION-RELEASE-TREE.md
release manifests and SHA-256 files
rollback metadata
local clasp binding
```

## 12. Build and deployment boundary

Phase 78 does not authorize these steps. The next build phase must:

1. Create a new directory; never overwrite Phase 54 or Phase 57 artifacts.
2. Use deployed v74 sanitized source as the base.
3. Add only reviewed Phase 69–71 deltas and the snapshot helper.
4. Copy the four reviewed frontend files separately.
5. Generate two independent SHA-256 manifests.
6. Validate the isolated backend with 68 routes and 68/68 handlers.
7. Assert zero excluded-module references and zero View-sync calls.
8. Run isolated `clasp status` only after a verified ignored binding is provided.
9. Obtain separate approval for push, immutable version creation, existing-deployment update, and
   frontend publication.

Backend must deploy and pass smoke testing before frontend publication. Rollback boundaries remain:

- backend: same Web App deployment → verified version 73;
- frontend: previous four-file GitHub Pages commit;
- data: no migration, repair or Sheet rollback.

## 13. Final decision

- Production modules classified: **34/34**.
- Production Apps Script minimum: **30 JavaScript + 1 manifest**.
- Frontend minimum: **4 HTML files**.
- Snapshot dependency: **complete in the designed tree**.
- Excluded tooling isolation: **defined**.
- Current canonical direct-push safety: **FAIL — six orphan View-sync calls if repair is excluded**.
- Existing Phase 54 direct reuse: **FAIL — performance dependencies absent**.
- Safe to deploy now: **NO**.

This Phase made no production code, API, frontend, configuration, Sheet or deployment change.
