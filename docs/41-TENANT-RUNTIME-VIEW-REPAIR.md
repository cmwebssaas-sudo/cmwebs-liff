# Phase 41 — Tenant Runtime View Repair

## 1. Scope

This phase repairs missing derived View rows from existing canonical master data. It does not create a tenant, contract, room, property or bill. It does not change contract status, bill status, payment status or any LINE notification state.

Repository work in this phase has not been pushed, deployed or executed against Google Sheets.

## 2. Confirmed Runtime State

The approved read-only diagnosis established the following canonical relation:

| Field | Confirmed value |
|---|---|
| Tenant | `T000020` |
| Tenant user | `U000022` |
| Active contract | `C000019` |
| Workspace | `W000001` |
| Landlord | `L000001` |
| Property | `P000001` |
| Room | `R000019` / `603` |
| Master bill | One issued, unpaid July 2026 bill |
| Test identity source | `TEST_TENANT_LINE_UID` Script Property; value is not recorded here |

Missing derived rows:

| View | Matching row count before repair |
|---|---:|
| `V2_tenant_home_view` | 0 |
| `V2_tenant_bill_view` | 0 |
| `V2_landlord_tenant_list_view` | 0 |

## 3. Root Cause

The master records are valid enough to resolve a unique tenant, active contract, Workspace, property, room and bill. The failure is in derived-View maintenance, not in the existence of the canonical records.

The previous flows had five related gaps:

1. `bindTenantByLineUid_()` returned immediately for an already-bound tenant. That branch never attempted to rebuild missing Views.
2. `tenantBindingSyncLineUidAcrossData_()` only updated rows that already existed. A zero-row View remained empty.
3. `billingSyncBillViews_()` could insert the bill View, but Home and landlord-list summaries were only updated when their rows already existed.
4. Tenant onboarding View upserts used `tenant_id` alone rather than a Workspace-aware canonical key.
5. Contract and room changes did not consistently call one shared synchronizer.

The exact historical event that originally created these particular master rows cannot be proven from the current Sheet snapshot alone. They may have come from an older deployment, import path or interrupted multi-sheet operation. The general defect is confirmed: once a View row was absent, the normal already-bound/read flows did not self-heal it.

## 4. Canonical Source and Keys

All repair values are derived from these master sheets:

```text
V2_tenants
  ↓ tenant_id / tenant_user_id / TEST_TENANT_LINE_UID
V2_contracts
  ↓ contract_id / workspace_id / property_id / room_id
V2_properties + V2_rooms
  ↓ same Workspace relation
V2_bills
  ↓ existing bill_id and financial statuses
Derived Views
```

Canonical keys:

| View | Canonical key | Required relation |
|---|---|---|
| `V2_tenant_home_view` | `(workspace_id, tenant_id)` | One row for the canonical current contract and room |
| `V2_tenant_bill_view` | `(workspace_id, bill_id)` | One row per existing master bill; tenant, contract and room must remain in the same Workspace |
| `V2_landlord_tenant_list_view` | `(workspace_id, tenant_id)` | One row for the landlord/tenant/current-contract relation |

An existing row with the same tenant or bill key and a different nonblank `workspace_id` is a conflict. It is never overwritten or adopted automatically.

## 5. Shared Production Synchronization

`syncTenantRuntimeViewsForTenant_()` is the shared internal synchronizer. It accepts a tenant identity and optional contract/Workspace constraints, resolves canonical master rows, builds all desired View rows, performs a conflict preflight and then applies the View-only changes.

The synchronizer is now invoked by:

| Production event | Synchronization behavior |
|---|---|
| Tenant/lease creation | Workspace-aware Home and landlord-list upsert, followed by shared consistency synchronization |
| New tenant binding | UID propagation followed by shared synchronization |
| Already-bound tenant entering binding flow | Missing Views can be rebuilt rather than returning before synchronization |
| Bill create/update | Bill View plus Home and landlord-list summaries are synchronized from the saved master bill |
| Occupied room update | The unique active contract/tenant relation is resynchronized |
| Completed contract update | The affected tenant Views are resynchronized; a rejected sync restores the original contract row |

No route name or handler interface changes are required.

## 6. Repair Function

Function:

```text
repairTestTenantRuntimeViews()
```

Safety properties:

- Reads the UID only from `TEST_TENANT_LINE_UID`.
- Resolves tenant, active contract, property, room and bills from canonical master sheets.
- Requires unique tenant, contract, property and room relations.
- Requires exact Workspace consistency.
- Writes only the three derived Views.
- Does not write `V2_bills`, `V2_contracts`, `V2_tenants`, `V2_rooms` or `V2_properties`.
- Does not create bills or send LINE messages.
- Does not modify contract or payment status in master data.
- Stops before writes if a duplicate canonical key, orphan bill View or cross-Workspace row exists.
- If an unexpected write error occurs after preflight, already-applied View cells are restored and inserted rows are cleared; an incomplete rollback is reported explicitly.

Return statistics for each View:

```text
inserted
updated
unchanged
conflict
```

For the confirmed zero-row baseline, the expected first-run result is one inserted Home row, one inserted bill row and one inserted landlord-list row. This is an expectation only; it must not be recorded as an observed result until the function is manually approved and executed.

## 7. Idempotence Strategy

1. The synchronizer identifies rows only by their Workspace-aware canonical key.
2. It scans for duplicate and foreign-Workspace identity rows before any write.
3. Missing keys are inserted once.
4. Existing rows are compared field by field against master-derived values.
5. A row is updated only when at least one derived value differs.
6. `updated_at` changes only with an actual View update.
7. A second run with unchanged master data returns `unchanged`, with no insert or update operation.
8. Orphan or duplicate rows are reported as conflicts; they are not deleted automatically.

## 8. Read-Only Verification

Function:

```text
verifyTestTenantRuntimeViews()
```

The function performs no Sheet writes and verifies:

- exactly one Home row for the canonical tenant;
- exactly one landlord-list row for the canonical tenant;
- exactly one bill View row for every canonical master bill;
- matching Workspace, tenant, contract and room IDs;
- no duplicate or foreign-Workspace row;
- Home route data readiness;
- Bills route data readiness with at least one master/view bill.

It masks the test LINE UID in its output.

## 9. Local Static Tests

`testTenantRuntimeViewSyncPlanning_()` uses in-memory rows only. It verifies:

- all three missing View rows are planned exactly once;
- the second identical synchronization produces zero operations;
- a duplicate bill View key is rejected;
- Workspace-aware keys are used;
- master bill payment status remains unchanged;
- master contract status remains unchanged.

These tests do not access Google Sheets and do not prove production repair success.

## 10. Human Execution Order

The following steps are pending separate deployment and data-write approval:

1. Export or copy the three View sheets as a rollback snapshot.
2. Confirm the intended Apps Script project and existing Web App deployment ID without changing either.
3. Run `diagnoseTestTenantRuntimeDataDetailed()` and retain a redacted result.
4. Confirm the canonical IDs, one active contract, one room, one property, one master bill and zero View duplicates.
5. Run `verifyTestTenantRuntimeViews()`; the expected pre-repair result is `success=false` because the Views are absent.
6. Select and run `repairTestTenantRuntimeViews()` once.
7. Inspect all three `inserted / updated / unchanged / conflict` summaries. Stop if any conflict is nonzero.
8. Run `verifyTestTenantRuntimeViews()` and require all checks to pass.
9. Run `repairTestTenantRuntimeViews()` a second time and require all three View summaries to report only `unchanged`.
10. Perform read-only smoke tests in order: Bind, Home, Bills, Message, Contract.
11. Update `docs/39-TENANT-REAL-DEVICE-RESULTS.md` only from newly observed device evidence.

Do not run a bind submit, bill generation, payment, repair-all, migration or LINE notification function during this procedure.

## 11. Rollback

Before execution, retain a snapshot of the three Views with row numbers and canonical keys. If the post-repair verification fails:

1. Stop all runtime testing.
2. Preserve the repair and verification logs with the UID masked.
3. Do not rerun the repair against changed data.
4. Restore only the affected View rows from the approved pre-repair snapshot through a separately reviewed rollback action.
5. Do not modify master tenant, contract, bill, property or room rows as part of View rollback.
6. Run the read-only verifier again and document the resulting state.

No rollback or production write was performed in this repository phase.

## 12. Deployment Statement

This phase changed repository code and documentation only. It did not run `commit`, `push`, `clasp push`, `clasp deploy`, create an Apps Script version, update a Web App deployment, edit Google Sheets or send LINE messages.
