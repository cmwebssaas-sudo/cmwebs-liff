# Phase 46 — Tenant Landlord-Link Remediation Plan

Date: 2026-07-20  
Status: **PLAN ONLY — no data or resolver remediation executed**

## Problem statement

The test tenant has one consistent tenant, active contract, room, bill, Home View row, and Bill View row. `V2_landlord_tenant_list_view` contains two related rows:

| Row | Workspace | Tenant | Contract | Room | Current interpretation |
|---:|---|---|---|---|---|
| 2 | blank | `T000020` | blank | blank | Incomplete legacy-style relationship |
| 4 | `W000001` | `T000020` | `C000019` | `R000019` | Complete canonical relationship |

The existing shared resolver matches rows broadly by tenant ID, tenant user ID, LINE UID, or contract ID and fails whenever more than one row remains. As a result, one incomplete historical row can block an otherwise unique active contract and canonical relationship.

Phase 44 did not expose `landlord_id`, status, or `updated_at` for these two rows. Therefore this plan does not assert that row 4 is active solely from its physical position, and it does not authorize deletion of row 2. The Phase 45 read-only verifier was added to collect those non-secret fields after separate approval.

## Required canonical inputs

Selection must begin from master data, not from the order of the View:

1. Resolve exactly one tenant from `TEST_TENANT_LINE_UID` or the authenticated production LINE UID.
2. Resolve exactly one active contract for that tenant.
3. Derive the contract's `workspace_id`, `tenant_id`, `contract_id`, `property_id`, `room_id`, and `landlord_id`.
4. Confirm property and room belong to the same Workspace and landlord.
5. Only then evaluate `V2_landlord_tenant_list_view` candidates.

If the tenant or active contract is not unique, the resolver must fail closed before evaluating landlord-link rows.

## Candidate classification

Each related landlord-link row should be classified into one of these groups:

### Exact canonical candidate

All required non-empty values match the active contract chain:

- `workspace_id`;
- `tenant_id`;
- `contract_id` or compatibility alias `current_contract_id`;
- `room_id`;
- `landlord_id`.

If a status field exists, it must be active/current/enabled or otherwise compatible with the active contract.

### Incomplete compatible legacy candidate

The row matches the tenant but omits one or more canonical fields. Every non-empty canonical field it does contain agrees with the active contract chain. It may be retained for migration review but must not outrank an exact canonical candidate.

### Conflicting candidate

Any non-empty Workspace, tenant, contract, room, landlord, or tenant LINE UID conflicts with the active contract chain. A conflicting active row must cause fail-closed behavior and be reported; it must never be silently ignored as legacy data.

### Different Workspace candidate

A non-empty different `workspace_id` is not automatically a valid second relationship. It is valid only if master data contains a separate, uniquely active contract for that tenant in that Workspace and the current request explicitly resolves to it. If the authenticated identity maps to simultaneous active contracts across Workspaces without another disambiguating authorization boundary, fail closed.

## Recommended deterministic selection rule

1. Require one canonical tenant and one active contract.
2. Filter candidates by exact `tenant_id` and reject any non-empty UID mismatch.
3. Reject candidates whose non-empty Workspace, contract, room, or landlord values conflict with the active contract chain.
4. Prefer exact canonical candidates over incomplete compatible legacy candidates.
5. If exactly one exact canonical candidate exists, select it and emit a non-blocking diagnostic warning for compatible incomplete legacy candidates.
6. If no exact candidate exists and exactly one incomplete compatible candidate exists, do not silently treat it as canonical; return an explicit incomplete-link error unless a separately approved fallback can derive every missing field from the active contract without conflict.
7. If multiple exact candidates have different business values or status, fail closed.
8. If multiple exact candidates have the same canonical business key and equivalent protected fields, collapse them logically for reads only. Prefer an active status; use `updated_at` only as a deterministic tie-break among otherwise equivalent rows. Record a duplicate warning for later data cleanup.
9. Never use physical row order or first-row-wins.

For the currently observed data, row 4 is the only candidate with the complete Workspace/tenant/contract/room chain. It is the likely canonical read candidate, subject to confirming its landlord, status, and timestamp fields and confirming that row 2 has no conflicting non-empty values.

## Resolver change design

The proposed code change belongs in the shared canonical runtime resolver, not separately in Home and Message:

```text
resolveCanonicalTenantRuntimeByLineUid_
  → resolve unique tenant
  → resolve unique active contract
  → derive canonical Workspace/property/room/landlord
  → classify landlord-link candidates
  → select one exact canonical relationship
  → warn on compatible incomplete legacy rows
  → fail closed on genuine conflicts
```

The resolver should return non-sensitive diagnostics such as:

- selected canonical key;
- candidate count;
- ignored compatible-legacy count;
- equivalent-duplicate count;
- conflict code when applicable.

It must not expose LINE UIDs, tokens, Script Properties, or contact credentials in client responses.

## Data remediation boundary

No row deletion or update is authorized by this plan. If later data cleanup is approved:

1. export and checksum the exact landlord-view rows;
2. identify whether the View is derived or manually maintained;
3. trace which sync path created row 2 and row 4;
4. fix the general sync/upsert key before changing data;
5. run a dry-run showing Sheet, physical row, field, old value, and new value;
6. obtain human approval for the exact row-level changes;
7. preserve a rollback payload;
8. update or archive only the proven legacy row;
9. verify no other tenant or Workspace changed.

Deleting row 2 merely to make the test pass is prohibited.

## Tests required before implementation approval

- one complete canonical candidate and one compatible incomplete legacy candidate selects the complete candidate;
- two identical complete candidates collapse logically and emit a warning;
- two complete candidates with different Workspace IDs fail closed;
- a candidate with a different tenant ID or UID fails closed;
- a candidate with a conflicting contract, room, or landlord fails closed;
- no exact candidate returns an explicit incomplete-link result;
- Home and Message resolve the same canonical landlord link;
- Bills remains independent of landlord-link ambiguity;
- Workspace isolation remains enforced;
- no resolver test writes Sheets or sends LINE;
- no other tenant's records are returned or changed.

## Implementation files requiring later review

No implementation is performed in Phase 45. A future approved resolver change is expected to affect:

- `apps-script/V2_TENANT_RUNTIME_DATA_REPAIR.js` for shared selection logic;
- `apps-script/TESTS.js` for resolver fixture tests;
- possibly `apps-script/V2_API.js` and `apps-script/V2_TENANT_MESSAGES.js` only if their result handling must expose a safe warning code;
- API and test documentation if the external response contract changes.

Home and Message must not implement separate selection algorithms.

## Rollback strategy

- Keep the current resolver source and Apps Script version as the rollback baseline.
- Make the selection change in one shared helper so it can be reverted without touching route names or frontend contracts.
- Deploy only through a new immutable Apps Script version while preserving the Web App URL.
- On any Workspace isolation, wrong-contact, or wrong-tenant result, immediately restore the previous version.
- Do not modify Sheet data as part of code rollback.
- Re-run the read-only consistency diagnosis and the Home/Message verifier after rollback.

## Human decisions required

1. Confirm which Apps Script project and deployment is the canonical backend for the endpoint embedded in repository HTML.
2. Approve whether one exact candidate may outrank compatible incomplete legacy rows for read operations.
3. Confirm row 4's `landlord_id`, status, and `updated_at`, and confirm row 2 contains no conflicting non-empty identifiers.
4. Decide whether equivalent duplicate rows should be logically collapsed for reads before Sheet cleanup.
5. Separately authorize any future Sheet remediation, including exact rollback data.

Until these decisions are complete, do not deploy resolver changes and do not alter either T000020 row.
