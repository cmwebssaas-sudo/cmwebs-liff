# Phase 41 — Tenant Runtime Data Consistency Repair

## Status

- Implementation status: ready for review; not deployed.
- Production Sheet diagnosis: **NOT EXECUTED in this phase**. This workspace has no authorized Google Sheets read session, and the phase explicitly prohibits guessing or writing production data.
- Production repair preview: **NOT EXECUTED**. Run `previewRepairTestTenantRuntimeData()` manually in Apps Script only after the code is reviewed and published to a non-production execution version.
- Production repair: **NOT EXECUTED**.
- `clasp push`, deployment, commit, and push: **NOT EXECUTED**.

## Root Cause

The test tenant identity is present in the canonical tenant and contract sources, but the runtime read models are incomplete:

1. `tenant_binding_status` can identify the test tenant from `V2_tenants`, so the bind page reports that the tenant is already bound.
2. `tenant_contract_init` can resolve the tenant and active contract from `V2_tenants` / `V2_contracts`, so contract C000019 and room label 603 can load.
3. The previous `tenant_home` implementation required a matching `V2_tenant_home_view.line_user_id` row with `account_status=active`. A missing view row or blank status caused a bound tenant to fail Home and return to the bind flow.
4. The previous `tenant_bills` implementation used the bill view LINE UID as its primary lookup. Missing relation fields made a valid zero-bill tenant indistinguishable from a missing identity.
5. `tenant_message_init` depended on `tenant_home`, then separately searched `V2_landlord_tenant_list_view`. The same incomplete view relation therefore caused Message to fail even when Contract worked.

Phase 41 introduces a fail-closed canonical resolver whose order is:

```text
TEST_TENANT_LINE_UID / tenant LINE UID
  ↓ exact match; exactly one row
V2_tenants
  ↓ tenant_id; exactly one active contract
V2_contracts
  ↓ same workspace_id + property_id + unique room_id/room label
V2_properties + V2_rooms
  ↓ same tenant_id + workspace_id
V2_tenant_home_view / V2_tenant_bill_view /
V2_landlord_tenant_list_view / V2_bills
```

The resolver never selects a room by property alone. It requires either one explicit `room_id` or one room label that matches exactly one `V2_rooms` row within the same Workspace and property.

## Canonical IDs

The following values are the only values supported by the human observations already supplied. Blank items must be confirmed by `diagnoseTestTenantRuntimeDataDetailed()`; they are not inferred in this document.

| Identifier | Current evidence | Canonical status |
|---|---|---|
| `tenant_id` | T000020 was shown by the bind page | Expected canonical; detailed diagnosis required |
| `contract_id` | C000019 was shown by the contract page | Expected canonical active contract; uniqueness must be confirmed |
| `workspace_id` | Not included in the supplied diagnostic excerpt | **UNCONFIRMED** |
| `landlord_id` | Not included in the supplied diagnostic excerpt | **UNCONFIRMED** |
| `property_id` | P000001 | Expected canonical; property row uniqueness must be confirmed |
| `room_id` | Blank in the supplied diagnostic excerpt | **MISSING / UNRESOLVED** |
| `room_no` / `room_name` | Contract UI reportedly shows 603; diagnostic excerpt is blank | Candidate relation only; must match exactly one same-Workspace `V2_rooms` row |

The test LINE UID is intentionally not recorded in this document.

## Missing and Conflicting Data

Confirmed from the supplied diagnostic excerpt:

| Field | Observed state | Impact |
|---|---|---|
| `property_id` | P000001 | Provides a property constraint for safe room resolution |
| `room_id` | blank | Home, Message, and view synchronization cannot rely on a canonical room key |
| `room_no` | blank in diagnostic summary | A unique room cannot be proven from that output alone |
| `contract_status` | active | Allows the active contract to participate in canonical resolution |
| `account_status` | blank | Previous Home logic rejected the view row because it required literal `active` |
| `binding_status` | blank | Binding metadata is incomplete even though the LINE UID resolves |
| bill identity/status fields | blank | May represent zero bills or an unmatched bill view; detailed counts are required |

Items that remain unknown until the detailed diagnosis is run:

- whether `V2_tenants` contains exactly one test-UID row;
- whether C000019 is the only active contract for T000020;
- the canonical `workspace_id`, `landlord_id`, `room_id`, and room label;
- whether all related rows use the same `tenant_id` and `workspace_id`;
- whether a home/list view row is missing entirely or only has blank relation fields;
- whether `V2_bills` truly has zero related rows;
- whether duplicate home, bill-view, landlord-list, room, or property rows exist.

Any duplicate, non-empty conflicting value, ambiguous room, or cross-Workspace relation blocks both preview and repair. The repair does not guess which row is correct.

## New Diagnostic and Repair Functions

All three functions are in `apps-script/V2_TENANT_RUNTIME_DATA_REPAIR.js`.

### `diagnoseTestTenantRuntimeDataDetailed()`

- Reads `TEST_TENANT_LINE_UID` from Script Properties.
- Reads only the eight specified Sheets.
- Returns masked UID, canonical IDs, matched row numbers, relation fields, statuses, and row counts.
- Does not call a route, log-access helper, repair/migration function, LINE API, or Sheet write method.
- Returns the precise resolution error when uniqueness or Workspace validation fails.

### `previewRepairTestTenantRuntimeData()`

- Re-runs the same canonical resolution.
- Returns `Sheet`, row, field, old value, new value, and operation for every proposed cell.
- Returns `dry_run=true` and `writes_performed=0`.
- Does not write any cell.
- Never plans a change to `V2_bills`, bill/payment status, or other payment fields.

### `repairTestTenantRuntimeData()`

- Can resolve only `TEST_TENANT_LINE_UID`; it has no UID argument.
- Acquires `ScriptLock`, then re-reads all source rows under the lock.
- Requires exactly one tenant, one active contract, one property, and one same-Workspace/same-property room.
- Stops on duplicate rows, ambiguous room labels, mismatched Workspace, mismatched tenant UID, or any non-empty field conflict.
- Performs a complete preflight to ensure every target cell still equals the previewed old value.
- Outputs `ROLLBACK_BACKUP_BEFORE_WRITE` with every cell and restore value before the first write.
- Only fills blank relationship/status cells in `V2_tenants`, `V2_contracts`, and physical runtime views.
- Does not create bills, change contract state, change payment state, or send LINE messages.

If a physical Home or landlord-list view row is entirely missing, the repair may populate a new row using only headers already present in that Sheet. It does not create headers. When no bill exists, the new Home read-model row uses zero summary values; it does not create a financial record. No empty `V2_tenant_bill_view` row is invented.

## Runtime Behavior Changes

### Tenant Home

- Existing and missing Home view rows resolve through the canonical tenant resolver.
- Missing room fields are supplemented only from the unique active contract, same-Workspace property, and unique same-property room.
- A blank tenant account status is treated as active only after a unique active contract and canonical relation have been proven.
- Cross-Workspace rows fail closed.

### Tenant Bills

- Bill view rows are selected using canonical `tenant_id` plus Workspace validation, not only view LINE UID.
- A canonical tenant with zero bill rows returns:

```json
{
  "success": true,
  "ok": true,
  "code": "OK_EMPTY",
  "message": "目前沒有帳單",
  "data": [],
  "bills": []
}
```

- `tenant-bills.html` renders `目前沒有帳單` when the complete result set is empty.

### Tenant Message

- Message init and submit now use the same `resolveCanonicalTenantRuntimeByLineUid_()` identity resolver as Home.
- Landlord and room context is constrained by the same canonical tenant and Workspace.
- Phase 41 does not execute message submission and does not send LINE.

## Dry-Run and Test Results

### Production Sheet result

`diagnoseTestTenantRuntimeDataDetailed()`, `previewRepairTestTenantRuntimeData()`, and `repairTestTenantRuntimeData()` were **not executed against Google Sheets** in this phase. Therefore no production change count or final canonical room/workspace value is claimed.

### Local pure-data safety test

`testTenantRuntimeDataRepairSafety_()` was run in a local JavaScript sandbox with an in-memory fixture representing:

- one bound tenant with blank room relation;
- one active contract with room label 603;
- one matching room in the same Workspace/property;
- zero bills;
- one unrelated tenant.

Result: **PASS**.

Validated behaviors:

- Bind identity resolves to Home without requiring a Home view row.
- Home receives the unique room relation.
- zero bills returns a successful empty response;
- contract status is not included in the repair plan;
- Message uses the canonical identity;
- a property Workspace mismatch stops resolution;
- duplicate matching rooms stop resolution;
- no plan entry targets `V2_bills`, payment fields, or the unrelated tenant.

The fixture produced 46 proposed cells because both physical view rows were absent. This number is fixture-specific and is **not** a production dry-run result.

## Modified Files

- `apps-script/V2_TENANT_RUNTIME_DATA_REPAIR.js` — canonical resolver, detailed diagnosis, dry-run, guarded repair, rollback output, and safety test.
- `apps-script/V2_API.js` — Home and Bills use the canonical resolver; zero Bills returns a successful empty response.
- `apps-script/V2_TENANT_MESSAGES.js` — Message init and submit use the same canonical resolver.
- `tenant-bills.html` — distinguishes a true zero-bill result from an empty filter result.
- `docs/41-TENANT-RUNTIME-DATA-REPAIR.md` — this incident repair and execution record.

No route name, handler signature, Sheet schema, LIFF ID, API endpoint, Web App URL, payment flow, or contract API was changed.

## Manual Diagnosis and Repair Procedure

Do not skip steps or execute repair when any result is ambiguous.

1. After code review, publish the reviewed Apps Script source to a controlled execution version. Do not change `TEST_TENANT_LINE_UID`.
2. In Apps Script, run `diagnoseTestTenantRuntimeDataDetailed()`.
3. Save the execution output outside the repository. Confirm:
   - one `V2_tenants` row;
   - one active `V2_contracts` row;
   - one `V2_properties` row;
   - one `V2_rooms` row within the same `workspace_id` and `property_id`;
   - one canonical `tenant_id`, `contract_id`, `workspace_id`, `landlord_id`, `property_id`, `room_id`, and room label;
   - no resolution error, duplicate key, UID conflict, or Workspace conflict.
4. Run `previewRepairTestTenantRuntimeData()`.
5. Confirm `dry_run=true`, `writes_performed=0`, and review every proposed row/field/value.
6. Reject the preview if it contains:
   - any tenant other than the test tenant;
   - `V2_bills`;
   - bill/payment status fields;
   - a non-empty old value being replaced;
   - an unexpected Workspace, property, room, landlord, or contract.
7. Export or copy the relevant Sheet rows as an external backup.
8. Only after human approval, run `repairTestTenantRuntimeData()` once.
9. Save both the `ROLLBACK_BACKUP_BEFORE_WRITE` output and returned `rollback` array before closing the execution log.
10. Run `diagnoseTestTenantRuntimeDataDetailed()` again and compare canonical IDs and row counts.
11. Re-run `previewRepairTestTenantRuntimeData()`; the expected result is `change_count=0`.

## Rollback

The repair output contains one rollback record per changed cell:

```text
Sheet → row → field → restore_value
```

If rollback is required:

1. Stop runtime retesting and do not run repair again.
2. Use the saved pre-write output and external Sheet backup.
3. Restore each listed cell to `restore_value` in reverse order.
4. For a newly populated view row, clear only the cells listed by the rollback output; do not delete an unrelated row or Sheet.
5. Run the detailed diagnosis again and verify that the pre-repair state is restored.
6. Roll back the reviewed Apps Script/Web frontend release to the prior deployment and prior GitHub Pages commit if runtime code must also be reverted.

No automatic rollback function is provided because an automatic rollback without re-validation could overwrite subsequent legitimate Sheet changes.

## Real-Device Retest URLs and Order

Use the reviewed GitHub Pages release. Do not put a LINE UID in any URL.

1. Bind status and transition:
   - `https://cmwebssaas-sudo.github.io/cmwebs-liff/tenant-bind.html?test=1`
   - confirm the existing test tenant, then enter Home.
2. Home:
   - `https://cmwebssaas-sudo.github.io/cmwebs-liff/tenant-home.html?test=1`
   - confirm no bind loop, correct tenant, property, and room.
3. Bills:
   - `https://cmwebssaas-sudo.github.io/cmwebs-liff/tenant-bills.html?test=1`
   - with zero bills, confirm `目前沒有帳單` and no API failure.
4. Contract regression:
   - `https://cmwebssaas-sudo.github.io/cmwebs-liff/tenant-contract.html?test=1`
   - confirm C000019 and the same property/room relation remain readable.
5. Message init only:
   - `https://cmwebssaas-sudo.github.io/cmwebs-liff/tenant-message.html?test=1`
   - confirm landlord contact data loads; do not submit a message.
6. Navigate Bills → Home → Contract → Message and confirm `test=1` remains present.
7. Repeat Home/Bills/Message with a non-test tenant only after Workspace isolation has been independently approved.

Until these real-device steps are executed, their status remains **NOT TESTED** and no release PASS is claimed.

## Regression Risk

- **P0:** an ambiguous tenant, active contract, room, landlord link, or Workspace now fails closed instead of selecting the first row. This is intentional security behavior but can expose existing data debt.
- **P1:** older tenants whose `V2_rooms.workspace_id` is blank cannot use contract fallback until their relation is diagnosed; the resolver does not infer Workspace from landlord alone.
- **P1:** Message init can still lack display contact details if the canonical landlord relation contains no landlord name/LINE field; repair will not invent them.
- **P2:** runtime resolver reads the eight canonical Sheets for each affected request. Performance should be measured after correctness is confirmed; caching is intentionally deferred.

## Non-Deployment Statement

This phase did not execute `clasp push`, `clasp deploy`, GitHub Pages deployment, Google Sheets writes, LINE push, commit, or Git push.
