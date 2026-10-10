# Phase 44 — Tenant Production Data Consistency Diagnosis Result

Date: 2026-07-20  
Execution window: 08:28:02–08:28:08 (Asia/Taipei)  
Diagnostic function: `diagnoseTenantDataConsistency()`  
Final Logger result: **FAIL**

## Executive result

The read-only production-data diagnosis completed successfully and returned `RESULT: FAIL`.

The failure does **not** indicate a missing tenant, contract, bill, tenant home view, or tenant bill view. All seven required Sheets contain at least one row related to the test tenant, all exposed LINE UIDs agree with `TEST_TENANT_LINE_UID`, and the non-empty tenant, contract, workspace, room, and bill identifiers are internally consistent.

The material inconsistency is in `V2_landlord_tenant_list_view`: two rows are related to the same tenant identity. Physical row 2 is an incomplete legacy-style row without `workspace_id`, `contract_id`, or `room_id`; physical row 4 contains the canonical Workspace/tenant/contract/room relationship. The production resolver treats both rows as related and rejects the identity as ambiguous with `MULTIPLE_TENANT_LANDLORD_LINKS`. This explains the Home and Message failures.

The Bills failure is not explained by missing Sheet data: both `V2_bills` and `V2_tenant_bill_view` contain the same bill. The current source handler has enough data to return it. Because Phase 44 updated only the editable Apps Script source and intentionally did not create or update a Web App deployment, the remaining online Bills failure is consistent with a deployed-version or response-contract mismatch and requires deployment/version verification in a separately approved phase.

No repair, migration, Sheet write, LINE push, route change, frontend change, or Web App deployment was performed.

## Execution record

To keep the diagnosis-only source update isolated from unrelated working-tree changes:

1. The current production Apps Script project was pulled into a temporary directory.
2. The pulled source was backed up in a separate temporary directory.
3. The local `TESTS.js` was compared with the pulled project. The production portion was byte-for-byte equal; the only difference was the appended read-only `diagnoseTenantDataConsistency()` implementation.
4. All JavaScript files in the isolated project passed syntax checking.
5. The isolated project was pushed with `clasp push`. The command listed the complete 32-file Apps Script project, but the pre-push comparison confirmed that only `TESTS.js` differed from the freshly pulled source.
6. No `clasp deploy` was executed.
7. `clasp run diagnoseTenantDataConsistency` was unavailable because the project is not deployed as an Apps Script API executable. No API executable was created.
8. The function was selected and run once from the Apps Script editor. It completed normally and emitted the JSON result followed by `RESULT: FAIL`.

The full LINE UID is intentionally omitted from this repository document. Every occurrence below represents the same value read from the existing `TEST_TENANT_LINE_UID` Script Property.

## Sanitized complete Logger result

```json
{
  "diagnostic": "diagnoseTenantDataConsistency",
  "read_only": true,
  "test_tenant_line_uid": "[REDACTED: TEST_TENANT_LINE_UID]",
  "sheets_checked": [
    "V2_users",
    "V2_tenants",
    "V2_contracts",
    "V2_bills",
    "V2_tenant_home_view",
    "V2_tenant_bill_view",
    "V2_landlord_tenant_list_view"
  ],
  "rows": [
    {
      "sheet": "V2_users",
      "row": 23,
      "workspace_id": "",
      "tenant_id": "",
      "contract_id": "",
      "bill_id": "",
      "line_uid": "[REDACTED: TEST_TENANT_LINE_UID]",
      "tenant_code": "",
      "room_id": ""
    },
    {
      "sheet": "V2_tenants",
      "row": 21,
      "workspace_id": "",
      "tenant_id": "T000020",
      "contract_id": "",
      "bill_id": "",
      "line_uid": "[REDACTED: TEST_TENANT_LINE_UID]",
      "tenant_code": "",
      "room_id": ""
    },
    {
      "sheet": "V2_contracts",
      "row": 20,
      "workspace_id": "W000001",
      "tenant_id": "T000020",
      "contract_id": "C000019",
      "bill_id": "",
      "line_uid": "[REDACTED: TEST_TENANT_LINE_UID]",
      "tenant_code": "",
      "room_id": "R000019"
    },
    {
      "sheet": "V2_bills",
      "row": 20,
      "workspace_id": "W000001",
      "tenant_id": "T000020",
      "contract_id": "C000019",
      "bill_id": "BILL-202607-C000019",
      "line_uid": "[REDACTED: TEST_TENANT_LINE_UID]",
      "tenant_code": "",
      "room_id": "R000019"
    },
    {
      "sheet": "V2_tenant_home_view",
      "row": 21,
      "workspace_id": "W000001",
      "tenant_id": "T000020",
      "contract_id": "C000019",
      "bill_id": "",
      "line_uid": "[REDACTED: TEST_TENANT_LINE_UID]",
      "tenant_code": "",
      "room_id": "R000019"
    },
    {
      "sheet": "V2_tenant_bill_view",
      "row": 4,
      "workspace_id": "W000001",
      "tenant_id": "T000020",
      "contract_id": "C000019",
      "bill_id": "BILL-202607-C000019",
      "line_uid": "[REDACTED: TEST_TENANT_LINE_UID]",
      "tenant_code": "",
      "room_id": "R000019"
    },
    {
      "sheet": "V2_landlord_tenant_list_view",
      "row": 2,
      "workspace_id": "",
      "tenant_id": "T000020",
      "contract_id": "",
      "bill_id": "",
      "line_uid": "[REDACTED: TEST_TENANT_LINE_UID]",
      "tenant_code": "",
      "room_id": ""
    },
    {
      "sheet": "V2_landlord_tenant_list_view",
      "row": 4,
      "workspace_id": "W000001",
      "tenant_id": "T000020",
      "contract_id": "C000019",
      "bill_id": "",
      "line_uid": "[REDACTED: TEST_TENANT_LINE_UID]",
      "tenant_code": "",
      "room_id": "R000019"
    }
  ],
  "checks": {
    "missing_data": [
      {
        "type": "MISSING_CANONICAL_KEY",
        "field": "",
        "sheet": "V2_landlord_tenant_list_view",
        "rows": [2],
        "values": [],
        "detail": "相關列缺少 canonical key"
      },
      {
        "type": "MISSING_CANONICAL_KEY",
        "field": "",
        "sheet": "V2_landlord_tenant_list_view",
        "rows": [4],
        "values": [],
        "detail": "相關列缺少 canonical key"
      }
    ],
    "duplicate": [],
    "workspace_id": ["W000001"],
    "tenant_id": ["T000020"],
    "line_uid": ["[REDACTED: TEST_TENANT_LINE_UID]"],
    "contract_id": ["C000019"]
  },
  "mismatches": [
    {
      "type": "MISSING_CANONICAL_KEY",
      "field": "",
      "sheet": "V2_landlord_tenant_list_view",
      "rows": [2],
      "values": [],
      "detail": "相關列缺少 canonical key"
    },
    {
      "type": "MISSING_CANONICAL_KEY",
      "field": "",
      "sheet": "V2_landlord_tenant_list_view",
      "rows": [4],
      "values": [],
      "detail": "相關列缺少 canonical key"
    }
  ],
  "status": "FAIL"
}
RESULT: FAIL
```

## Missing rows

No required related row is missing.

| Sheet | Related row count | Missing related row |
|---|---:|---|
| `V2_users` | 1 | No |
| `V2_tenants` | 1 | No |
| `V2_contracts` | 1 | No |
| `V2_bills` | 1 | No |
| `V2_tenant_home_view` | 1 | No |
| `V2_tenant_bill_view` | 1 | No |
| `V2_landlord_tenant_list_view` | 2 | No |

The Logger reported two `MISSING_CANONICAL_KEY` findings, both in `V2_landlord_tenant_list_view`. These are incomplete-key findings, not missing-Sheet or missing-row findings.

## Duplicate and ambiguous rows

The diagnostic's formal `checks.duplicate` array is empty because it groups duplicates using the raw canonical-key fields. Nevertheless, `V2_landlord_tenant_list_view` contains two rows related to the same test tenant:

| Physical row | Workspace | Tenant | Contract | Room | Interpretation |
|---:|---|---|---|---|---|
| 2 | blank | `T000020` | blank | blank | Incomplete legacy-style relationship row |
| 4 | `W000001` | `T000020` | `C000019` | `R000019` | Complete canonical relationship row |

This is an operational identity ambiguity even though it is not represented as `DUPLICATE_ROW` by the diagnostic. The canonical runtime resolver relates landlord-view rows by LINE UID, tenant ID, tenant user ID, or contract ID, then explicitly stops when more than one related landlord link remains. Therefore these two rows trigger `MULTIPLE_TENANT_LANDLORD_LINKS`.

No row was deleted, merged, updated, or selected as authoritative during Phase 44.

## UID consistency

- UID mismatch count: **0**.
- Every non-empty `line_uid` emitted by the diagnostic matches the value read from `TEST_TENANT_LINE_UID`.
- No UID was taken from a URL or hardcoded by the diagnostic.
- The complete UID is not recorded in this document.

## Tenant, contract, bill, and view consistency

| Entity/source | Canonical IDs found | Consistency result |
|---|---|---|
| Tenant | `tenant_id=T000020` | Unique and consistent |
| Contract | `workspace_id=W000001`, `tenant_id=T000020`, `contract_id=C000019`, `room_id=R000019` | Consistent with tenant identity |
| Bill master | `BILL-202607-C000019`, `W000001`, `T000020`, `C000019`, `R000019` | Unique and consistent |
| Tenant home view | `W000001`, `T000020`, `C000019`, `R000019` | Matches contract |
| Tenant bill view | `BILL-202607-C000019`, `W000001`, `T000020`, `C000019`, `R000019` | Matches bill master and contract |
| Landlord tenant list view | Two related rows; only row 4 contains the complete normalized relationship | Ambiguous for the shared runtime resolver |

The sparse `V2_tenants` row does not expose Workspace, contract, or room identifiers in this diagnostic output, but the single active contract supplies one unambiguous canonical relationship. That incompleteness should be reviewed later; it is not evidence that the contract, home view, or bill view is missing.

## Diagnostic limitation

The Logger flags both landlord-view rows as missing a canonical key. Physical row 2 is genuinely incomplete. Physical row 4, however, is normalized in the output as `contract_id=C000019` while still being flagged. This indicates that the diagnostic display accepts a compatibility field such as `current_contract_id`, whereas its raw row-key calculation expects `contract_id` specifically.

Accordingly, the row 4 `MISSING_CANONICAL_KEY` finding is a diagnostic/schema-alias limitation, not proof that its normalized tenant relationship is absent. This limitation does not change the operational duplicate finding: two landlord-view rows still resolve to the same tenant.

## Five API data-source comparison

| API flow | Primary identity/data path | Diagnosis |
|---|---|---|
| Tenant bind | `V2_users` and `V2_tenants` binding identity | Related rows exist; explains why binding recognizes the tenant |
| Tenant home | Shared canonical runtime resolver, including `V2_landlord_tenant_list_view`, then home data | Blocked by two related landlord-view rows before the valid home-view row can be used |
| Tenant contract | Independent contract-request identity resolver and active contract lookup | Does not depend on the ambiguous shared landlord-link resolution; explains why contract loading succeeds |
| Tenant message | Same shared canonical runtime resolver as Home, then landlord contact data | Blocked by the same two related landlord-view rows |
| Tenant bills | Dedicated tenant/bill identity path through tenant, contract, `V2_tenant_bill_view`, with `V2_bills` data available | Required bill row exists and is consistent; current online failure is not a missing-data result |

## Root cause by failing page

### Home

The test tenant has two related rows in `V2_landlord_tenant_list_view`. The shared resolver refuses to choose between them and throws `MULTIPLE_TENANT_LANDLORD_LINKS`. This occurs before the valid `V2_tenant_home_view` row is consumed. The true source-data cause is the incomplete legacy row coexisting with the canonical row.

### Message

Message uses the same shared canonical resolver as Home. It fails for the same ambiguous landlord-link relationship before landlord contact data is returned.

### Bills

The production data required by Bills is present and mutually consistent: the bill master and bill view contain the same bill, tenant, contract, Workspace, and room identifiers. Therefore missing tenant or bill rows are ruled out.

The remaining evidence points to a runtime publication or response-contract mismatch: Phase 44 changed the editable Apps Script source only and did not create a new Web App version or update the live deployment. A subsequent approved phase must verify which Apps Script version the current Web App deployment executes and compare its actual `tenant_bills` payload with the current canonical handler. No deployment was performed to test this hypothesis in Phase 44.

## Phase 45 decision inputs

Phase 44 stops without repair. Before any Phase 45 action, human approval is required for separate, auditable decisions:

1. Decide how to handle physical row 2 of `V2_landlord_tenant_list_view` after confirming its history and rollback data. Do not delete it solely from this report.
2. Decide whether the compatibility alias used by row 4 should be normalized in data, supported by the diagnostic key calculation, or both.
3. Review the current Web App deployment version and the live `tenant_bills` response before deciding whether source deployment is required.
4. If data repair is approved, require a dry-run, Workspace isolation, exact-row backup, idempotency, and post-repair verification before any write.
5. Re-run Home, Message, and Bills real-device tests only after the separately approved data/runtime action is complete.

## Safety statement

This phase performed one isolated Apps Script source push to add the read-only diagnostic function and one manual execution of that function. It did not run repair or migration code, write any Google Sheet, send LINE messages, modify routes or frontend files, create an Apps Script deployment, change a Web App URL, commit Git changes, or push Git commits.
