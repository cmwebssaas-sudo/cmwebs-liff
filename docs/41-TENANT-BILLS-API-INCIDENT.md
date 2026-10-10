# Phase 41 — Tenant Bills API Incident

Date: 2026-07-20

Status: fixed and validated in the local canonical source; production execution and real-device retest are NOT TESTED; not deployed

## Scope and constraints

This phase used the already-confirmed diagnosis supplied by the operator. `diagnoseTestTenantRuntimeData()` was not executed again.

The confirmed master data contains one tenant, one active contract, one `V2_tenant_bill_view` row, and the matching `V2_bills` row. No Google Sheet row, duplicate landlord-list row, LINE message, repair, migration, LIFF ID, Web App URL, route name, JSONP callback name, or deployment was changed.

## Runtime route trace

The formal read path is:

```text
Apps Script doGet
  -> v2_action=tenant_bills
  -> resolveTenantRequestLineUserId_()
       test=1 -> TEST_TENANT_LINE_UID Script Property
  -> getTenantBillsByLineUid(lineUserId)
  -> getTenantBillsRuntimePayloadByLineUid_(lineUserId)
  -> tenantBillsRuntimePayload_(lineUserId)
       -> tenantBillsRuntimeResolveIdentity_()
            -> V2_tenants
            -> V2_contracts
       -> tenantBillsRuntimeIdentityRows_()
            -> V2_tenant_bill_view
            -> V2_bills
       -> tenantBillsRuntimePublicBill_()
       -> tenantBillsRuntimeJsonSafeValue_()
  -> jsonOutput_(result, callback)
       -> JSON.stringify
       -> unchanged JSONP callback
```

The route remains named `tenant_bills`, and its public handler remains `getTenantBillsByLineUid(lineUserId)`.

## Root cause

The blocking read path was not missing bill data. The pre-fix Bills handler depended on the all-purpose canonical tenant resolver. That resolver also required `V2_landlord_tenant_list_view` to have no duplicate relationship row. The known two-row landlord-list condition could therefore return `MULTIPLE_TENANT_LANDLORD_LINKS` before the valid bill View and master bill rows were consumed.

The Bills handler is now isolated from that unrelated View. It resolves the tenant and active contract from canonical master data, enforces one Workspace, reads `V2_tenant_bill_view`, and safely falls back to `V2_bills`.

The API boundary also previously lacked an explicit guarantee that every returned date-like field and every optional field was normalized before `jsonOutput_()` called `JSON.stringify`. Native `Date` normally serializes to an ISO string, so this was a response-contract risk rather than evidence of the primary failure. The response is now explicitly sanitized so runtime behavior does not depend on implicit `Date.toJSON()` or omission of `undefined` properties.

## Canonical response contract

A successful response contains both the new canonical flags and legacy compatibility fields:

```json
{
  "ok": true,
  "success": true,
  "code": "OK",
  "message": "查詢成功",
  "tenant": {
    "tenant_id": "T000020",
    "contract_id": "C000019",
    "workspace_id": "W000001"
  },
  "bills": [
    {
      "bill_id": "BILL-202607-C000019",
      "bill_month": "2026-07",
      "bill_status": "issued",
      "payment_status": "unpaid"
    }
  ],
  "count": 1,
  "data": {
    "tenant": "same canonical tenant fields",
    "bills": "same bill content as the top-level bills array",
    "count": 1
  }
}
```

The production response contains the existing display fields omitted from this abbreviated example. It does not return the LINE UID.

When a valid tenant has no bill, the contract is still successful:

```json
{
  "ok": true,
  "success": true,
  "code": "OK_EMPTY",
  "bills": [],
  "count": 0,
  "data": {
    "bills": [],
    "count": 0
  }
}
```

`bill_month` is normalized to `yyyy-MM`. `due_date` is normalized to `yyyy-MM-dd`. Any other returned `Date` becomes an ISO string before the payload leaves the handler. `undefined` becomes an explicit empty string, non-finite numbers become `null`, and circular or non-serializable values fail with an explicit API error instead of leaking into JSONP generation.

## Read-only test function

`testTenantBillsApiResponse()` is defined in `apps-script/V2_API.js`.

It reads `TEST_TENANT_LINE_UID`, invokes the same read-only payload builder used by the handler, and outputs:

- the complete raw handler response under `handler_response`;
- `success`, `ok`, and whether they agree;
- `error`, `code`, and `message`;
- whether top-level `bills` and `data.bills` are arrays;
- whether top-level and nested bill arrays have identical JSON content;
- `bills_length`;
- the first bill's ID, month, bill status, and payment status;
- whether `JSON.stringify` succeeded;
- whether the response contains a `Date`, `undefined`, circular reference, or other non-serializable value;
- path-only serialization findings without printing the test LINE UID.

It calls the payload builder instead of the public logging wrapper, so it does not append a LIFF access-log row. It performs no Sheet write, LINE push, bill creation, repair, migration, or payment update.

With the confirmed production data, the expected summary is:

```text
success=true
ok=true
success_ok_consistent=true
code=OK
bills_is_array=true
data_bills_is_array=true
top_level_and_data_bills_match=true
bills_length=1
first_bill.bill_id=BILL-202607-C000019
first_bill.bill_month=2026-07
first_bill.bill_status=issued
first_bill.payment_status=unpaid
json_stringify_success=true
contains_date=false
contains_undefined=false
contains_circular_reference=false
contains_non_serializable_value=false
```

This is the expected output. It is not marked PASS until a human runs the function against the approved Apps Script version.

## Frontend envelope review

In `tenant-bills.html`, the JSONP callback receives the complete backend result and resolves it unchanged. `unwrapTenantBillsPayload()` then:

- accepts either `ok=true` or `success=true`;
- treats `data.bills` as canonical;
- remains compatible with a legacy `data` array, `data.items`, top-level `bills`, and top-level `items`;
- normalizes a missing compatible array to `bills=[]`;
- does not treat an empty array as an API failure;
- preserves the canonical tenant object;
- displays the existing empty state for zero bills;
- rejects only an explicit failed envelope or a JSONP load/timeout failure.

The backend creates top-level `bills` and `data.bills` from the same canonical bill collection, and `testTenantBillsApiResponse()` checks that their JSON content matches.

`tenant-home.html` uses a helper that accepts `success=true`. `tenant-message.html` checks `success=true` directly in its JSONP callback. These formats differ structurally from the Bills parser but remain compatible because the backend continues to return `success=true` as well as `ok=true`. There is no shared frontend parser file requiring a change, so neither Home nor Message was modified in this phase.

## Files

Directly changed in this phase:

- `apps-script/V2_API.js`
- `docs/41-TENANT-BILLS-API-INCIDENT.md`

Already present in the uncommitted incident fix and reviewed without an additional Phase 41 edit:

- `tenant-bills.html`
- `apps-script/程式碼.js` route dispatcher

Not modified:

- `tenant-home.html`
- `tenant-message.html`
- all Google Sheets and deployments

## Local validation

- API response mock with one View/master bill: PASS
- JSON safety mock: Date 0, undefined 0, circular 0, non-serializable 0
- `V2_bills` fallback mock: PASS
- valid tenant with zero bills: PASS with empty arrays
- canonical and legacy frontend envelope compatibility: PASS
- Apps Script JavaScript syntax: PASS
- `npm run validate`: PASS
- 68 unique routes; handler coverage 68/68
- `git diff --check`: PASS

No Apps Script production execution or real-device result is marked PASS.

## Duplicate landlord-list rows

The two `V2_landlord_tenant_list_view` rows do not need to be deleted for `tenant_bills` to work after this fix, because that View is no longer a Bills dependency. They remain a separate data-quality issue for landlord-facing workflows and should be compared read-only before any human-approved cleanup. This phase does not delete, merge, or update them.

## Manual review and deployment order

After approval only:

1. preserve the Apps Script source/version and Web App deployment rollback point;
2. push the reviewed backend source and create a new Apps Script version while preserving the existing Web App URL;
3. run `testTenantBillsApiResponse()` in the Apps Script editor;
4. verify the expected one-bill and JSON-safety fields above;
5. publish the reviewed `tenant-bills.html` change through the normal GitHub Pages workflow;
6. retest `tenant-bills.html?test=1`, then Home → Bills → Home;
7. perform a minimal formal LIFF read-only smoke test.

No commit, push, `clasp push`, deployment, repair, migration, LINE push, or Sheet write was performed in this phase.
