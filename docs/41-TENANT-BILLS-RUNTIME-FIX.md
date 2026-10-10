# Phase 40.1 — Tenant Bills Runtime Fix

Date: 2026-07-20
Status: implemented locally; real-device retest not yet performed; not deployed

## Scope and confirmed baseline

The supplied read-only production diagnosis confirms one canonical test tenant, one active contract, one tenant home View row, one tenant bill View row, and one master bill row. The required rows and `workspace_id` / `tenant_id` relationships are present and consistent.

`V2_landlord_tenant_list_view` contains two related rows. This phase does not delete, edit, or otherwise repair those rows because that View is not a Tenant Bills data source.

No Google Sheet data, Web App URL, LIFF ID, GitHub Pages base URL, route name, or deployment was changed.

## Root cause

The local pre-fix `tenant_bills` handler depended on `resolveCanonicalTenantRuntimeByLineUid_()`. That general runtime resolver also reads `V2_landlord_tenant_list_view` and rejects more than one matching landlord/tenant relationship with `MULTIPLE_TENANT_LANDLORD_LINKS`.

The known duplicate landlord-list rows therefore stopped identity resolution before the handler could consume the valid `V2_tenant_bill_view` and `V2_bills` rows. The failure was caused by an unrelated View being a mandatory dependency of the Bills read path, not by missing Tenant Bills master data.

Two response-shape risks were also present:

- the legacy frontend accepted only `success === true` and primarily expected `data` to contain the bills;
- a Sheet `Date` value for `bill_month` could reach JSONP as a full date/time value rather than the canonical month key.

## Route and test identity review

The `tenant_bills` route remains registered once in `apps-script/程式碼.js` and still calls `getTenantBillsByLineUid(lineUserId)`. The route name and handler interface were not changed.

Before dispatch, `resolveTenantRequestLineUserId_()` applies the existing tenant request rule:

- when `test=1` is absent, use the LIFF request identity;
- when `test=1` is present on a `tenant_*` route, ignore the browser-supplied identity and require `TEST_TENANT_LINE_UID` from Script Properties;
- never put the Script Property value into the URL or response.

The test identity constants currently present in the eight Tenant HTML pages were compared by SHA-256 without printing their values. All eight contain the same value. The backend Script Property remains authoritative for `test=1`.

## Canonical backend read chain

`getTenantBillsByLineUid()` now delegates to a Bills-only, read-only payload builder. Its dependency order is:

1. resolve the LINE UID against exactly one row in `V2_tenants`;
2. obtain canonical `tenant_user_id` and `tenant_id`;
3. resolve exactly one active `V2_contracts` row and require a single consistent `workspace_id`;
4. query `V2_tenant_bill_view` inside that Workspace, supporting identity matching by LINE UID, then `tenant_user_id`, then `tenant_id`;
5. read `V2_bills` with the same Workspace and identity constraints;
6. use `V2_bills` as a safe fallback when the View has no usable bill row;
7. reject duplicate bill IDs instead of guessing;
8. serialize `bill_month` as `yyyy-MM` for a Sheet `Date`, `yyyy-MM`, `yyyy/M`, `yyyyMM`, or another parseable date string.

The Bills handler no longer reads or depends on `V2_landlord_tenant_list_view`. It does not broaden identity checks or query across Workspaces.

## Canonical payload

For a successful one-bill lookup, the canonical response has this shape:

```json
{
  "success": true,
  "ok": true,
  "code": "OK",
  "message": "查詢成功",
  "tenant": {
    "tenant_id": "T000020",
    "tenant_user_id": "U000022",
    "contract_id": "C000019",
    "workspace_id": "W000001",
    "property_id": "P000001",
    "room_id": "R000019"
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
    "tenant": "same tenant object as above",
    "bills": "same bills array as above",
    "count": 1
  }
}
```

The live payload contains the existing non-sensitive bill display fields in addition to the abbreviated example above. It does not include the LINE UID.

If the identity is valid but no bill exists, the handler returns `success=true`, `ok=true`, `code=OK_EMPTY`, `bills=[]`, and `count=0`. A missing or conflicting identity returns `success=false`, `ok=false`, an explicit error code, and empty bill collections.

## Frontend compatibility

`tenant-bills.html` now treats the new payload as canonical while remaining compatible with:

- legacy `success=true` plus `data` array;
- legacy `data.items` or top-level `items`;
- top-level `bills`;
- the canonical `data={tenant,bills,count}` envelope;
- an empty bills array, which renders the existing empty state instead of the error state.

JSONP script-load failure now clears the timeout and callback immediately and displays an API load error. Successful callbacks continue to remove their temporary script and callback.

## Read-only diagnostic

`testGetTenantBillsRuntimePayload()` is located in `apps-script/V2_API.js`. It:

1. reads `TEST_TENANT_LINE_UID` through `getRequiredScriptProperty_()`;
2. invokes the same payload builder used by the formal handler;
3. logs and returns the payload;
4. performs no Sheet write, repair, LINE push, bill creation, payment update, or access-log write.

With the supplied production diagnosis, the expected diagnostic result is:

- `ok=true` and `success=true`;
- `count=1`;
- the canonical tenant, contract, Workspace, property, and room IDs shown above;
- bill ID `BILL-202607-C000019`;
- `bill_month=2026-07`;
- `bill_status=issued` and `payment_status=unpaid`;
- `source=V2_tenant_bill_view` when the View row is usable, otherwise `source=V2_bills_fallback`;
- no LINE UID in the returned payload.

This is an expected result, not a claimed production or real-device PASS. It must be confirmed after an approved Apps Script deployment.

## Validation performed

- Apps Script JavaScript syntax: PASS
- local read-only mock — View path: PASS
- local read-only mock — `V2_bills` fallback: PASS
- local read-only mock — zero-bill empty state: PASS
- local read-only mock — diagnostic payload: PASS
- tenant HTML test identity equality check: eight files, one distinct value
- `npm run validate`: PASS
- Routes: 68 unique, duplicate routes 0
- Handler coverage: 68/68
- Duplicate top-level declarations: 0
- Blocking credentials: 0
- Hardcoded LINE UID validator finding: 0
- `git diff --check`: PASS

No real-device case is marked PASS by this document.

## Deployment and retest order

Only after human approval:

1. preserve the current Apps Script version and deployment rollback point;
2. push the approved canonical `apps-script/` source;
3. create a new Apps Script version and update the existing Web App deployment without changing its URL;
4. run `testGetTenantBillsRuntimePayload()` in the Apps Script editor and verify the expected one-bill payload;
5. commit and push the approved `tenant-bills.html` change so GitHub Pages updates;
6. wait for the Pages artifact to reflect the new commit;
7. retest `tenant-bills.html?test=1`, then navigate Home → Bills → Home;
8. perform a formal LIFF smoke test without payment, notification, repair, or data mutation.

Backend is deployed before frontend so the canonical response exists when the new parser becomes public. The frontend remains backward-compatible during the transition.

## Rollback

If the backend diagnostic fails, restore the recorded Apps Script version/deployment rollback point. If only the frontend regresses, revert the `tenant-bills.html` commit and allow GitHub Pages to rebuild. Do not repair or delete the duplicate landlord-list View rows as part of this rollback.

## Unresolved item outside this phase

The two `V2_landlord_tenant_list_view` rows require a separate read-only comparison and human decision. They are deliberately excluded from the Tenant Bills runtime path and were not modified here.
