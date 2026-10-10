# Phase 61C — HTTP-Only Production Validation Diagnosis

Date: 2026-07-21  
Production Web App version: 74  
Rollback version: 73  
Result: **PARTIAL — SAFE HTTP PATH EXISTS, TENANT RESOLVER OUTPUT IS NOT EXPOSED READ-ONLY**

## Scope

This phase diagnoses and exercises only HTTP requests that provably return
before any Google Sheets write. It does not modify runtime code, push source,
deploy, invoke LINE, alter configuration or create a new validation endpoint.

## Safe HTTP validation path

### 1. Endpoint availability

Request:

```text
GET {existing-web-app}/exec?v2_action=tenant_binding_status
```

The request intentionally omits `line_user_id` and `test=1`.

Result:

- HTTP status: 200;
- response parsed as JSON;
- `success`: false;
- `code`: `MISSING_LINE_UID`;
- structured `data` object: present.

This is a successful endpoint/error-contract probe, not a tenant identity test.

### 2. Second route/response check

Request:

```text
GET {existing-web-app}/exec?v2_action=tenant_message_init
```

The request also omits all identity parameters.

Result:

- HTTP status: 200;
- response parsed as JSON;
- `success`: false;
- `code`: `MISSING_LINE_UID`;
- structured `data` object: present.

### 3. Dashboard shell

Request:

```text
GET https://cmwebssaas-sudo.github.io/cmwebs-liff/tenant-home.html
```

Result:

- HTTP status: 200;
- LIFF initialization marker: present;
- bottom-navigation marker: present;
- `visualViewport`/app-height marker: present.

This proves delivery of the dashboard shell only. It does not prove authenticated
dashboard data projection.

## No-Sheet-write proof

`getTenantBindingStatusByLineUid_()` in
`V2_TENANT_BINDING_PHONE.js` validates an empty UID and returns
`MISSING_LINE_UID` before calling `SpreadsheetApp.getActiveSpreadsheet()` or
`tenantBindingLogAccess_()`.

`getTenantMessageInitByLineUid()` in `V2_TENANT_MESSAGES.js` likewise returns
`MISSING_LINE_UID` before calling the canonical resolver, reading Sheets or
calling `logLiffAccess_()`.

The dashboard shell probe is a static GitHub Pages request and does not call the
Apps Script API.

Therefore the HTTP requests executed in Phase 61C perform no Sheet write and no
LINE action.

## Tenant resolver feasibility

### Result: not possible through the existing Web App without a Sheet write

The existing identity-bearing routes behave as follows:

- `tenant_home` calls `resolveCanonicalTenantRuntimeByLineUid_()`, projects data
  through `tenantRuntimeHomeData_()`, then calls `logLiffAccess_()` on success or
  failure;
- `tenant_bills` obtains its read payload, then unconditionally calls
  `logLiffAccess_()`;
- `tenant_message_init` resolves canonical identity and landlord recipient, then
  calls `logLiffAccess_()` on successful output;
- binding and contract identity routes also maintain access-log Sheets after a
  non-empty identity lookup.

`logLiffAccess_()` opens or creates `V2_liff_access_logs` and appends a row.
Consequently, any HTTP request that returns real tenant identity,
workspace/property/room resolution, dashboard data projection or a successful
core tenant payload violates the no-Sheet-write constraint.

The pure functions exist in the runtime source:

- `resolveCanonicalTenantRuntimeByLineUid_()`;
- `tenantRuntimeHomeData_()`;
- `getTenantBillsRuntimePayloadByLineUid_()`.

They are not exposed by a read-only HTTP route. The production project is not
deployed as an Apps Script API executable, so `clasp run` is not an alternative.

## Validation matrix

| Requirement | Result | Evidence |
|---|---|---|
| Endpoint availability | PASS | HTTP 200 |
| HTTP response | PASS | Valid `MISSING_LINE_UID` JSON contract |
| Tenant resolver output | NOT AVAILABLE | No log-free HTTP route |
| Workspace/property/room resolution | NOT AVAILABLE | Requires canonical resolver route |
| Dashboard shell response | PASS | HTTP 200 and 3/3 shell markers |
| Authenticated dashboard projection | NOT AVAILABLE | `tenant_home` writes access log |
| Core API read response with tenant identity | NOT AVAILABLE | Current wrappers write access log |
| No Sheet writes in executed probes | PASS | Both handlers return before Sheet access |

## Diagnosis

The corrected HTTP-only smoke-test approach is safe for deployment availability,
response-contract and static-shell validation. It cannot validate real tenant
resolution or data projection using the existing version 74 Web App while also
guaranteeing zero Sheet writes.

This is an interface limitation of the deployed runtime, not evidence of a
resolver defect or missing production data. No runtime change is proposed or
implemented in this phase.

## No-change declaration

Phase 61C did not change Apps Script source, GitHub Pages, deployment version,
Web App URL, Google Sheets, LINE configuration, Script Properties or Git state.
It did not run `clasp push`, create a version or deploy.
