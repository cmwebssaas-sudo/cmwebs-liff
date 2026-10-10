# Phase 45 — Tenant Deployment Verification

Date: 2026-07-20  
Status: **REVIEW REQUIRED — no deployment performed**

## Scope and safety boundary

This phase verifies the repository, canonical Apps Script source, current deployment metadata, and the Home, Message, and Bills runtime contracts. It does not call the live tenant routes because the current handlers may write LIFF access logs. It does not modify Google Sheets, Script Properties, routes, handlers, frontend endpoints, LIFF configuration, or deployment state.

The only Apps Script addition is the local read-only test function `verifyTenantDeploymentReadOnly()` in `apps-script/TESTS.js`. It has not been pushed or executed in Apps Script.

## Repository state

- Branch: `chore/v2-production-consolidation`.
- The working tree contains uncommitted changes accumulated from earlier consolidation phases.
- `apps-script/.clasp.json` exists locally, is ignored, and is not tracked by Git.
- Phase 44's result is `FAIL`, with no missing related rows and no UID mismatch.
- No existing test status has been changed to PASS.

## Deployment metadata verification

Read-only `clasp deployments` and `clasp versions` checks produced the following conclusions:

- the project configured by `apps-script/.clasp.json` exposes one `@HEAD` deployment;
- the configured project has no immutable deployed script versions;
- the deployment identifier returned for that project does not match the Web App deployment identifier embedded in `tenant-home.html`, `tenant-message.html`, and `tenant-bills.html`;
- all three repository Tenant pages use the same frontend API endpoint.

Deployment IDs and full URLs are deliberately omitted from this document. The mismatch means the canonical Apps Script project configured in this repository cannot currently be proven to be the backend serving the repository Tenant pages. The frontend endpoint may point to a different Apps Script project or an older deployment that is not represented by the current `.clasp.json` project.

No deployment was created, changed, or deleted during this verification.

## Runtime call chains

### Tenant Home

```text
tenant-home.html
  → JSONP v2_action=tenant_home
  → 程式碼.js doGet(e)
  → resolveTenantRequestLineUserId_(e, "tenant_home", line_user_id)
  → getTenantHomeByLineUid(lineUserId)
  → resolveCanonicalTenantRuntimeByLineUid_(lineUserId)
  → tenantRuntimeResolveCanonicalFromSnapshot_(...)
  → V2_landlord_tenant_list_view relationship resolution
  → tenantRuntimeHomeData_(...)
  → jsonOutput_(result, callback)
  → callback(JSON payload);
```

`test=1` is handled centrally by `resolveTenantRequestLineUserId_()`, which replaces the request UID with `TEST_TENANT_LINE_UID` for all `tenant_*` actions. The frontend includes `test=1` in the Home JSONP request.

Current blocker: the canonical resolver finds two related landlord-link rows and returns `MULTIPLE_TENANT_LANDLORD_LINKS`. The Home frontend treats that as an error rather than as an unbound tenant unless an older endpoint converts it to a binding-related code.

### Tenant Message

```text
tenant-message.html
  → JSONP v2_action=tenant_message_init
  → 程式碼.js doGet(e)
  → resolveTenantRequestLineUserId_(...)
  → getTenantMessageInitByLineUid(lineUserId)
  → resolveCanonicalTenantRuntimeByLineUid_(lineUserId)
  → landlord relationship/contact resolution
  → jsonOutput_(result, callback)
  → callback(JSON payload);
```

Message shares the same canonical resolver as Home and is blocked by the same two landlord-link candidates.

Repository risk: `tenant-message.html` preserves `test=1` during page navigation but does not append `test=1` to its JSONP request. It currently supplies a legacy test UID value from frontend code instead, so the backend does not apply the Script Property override for that request. The value is not reproduced here. This is not modified in Phase 45, but it must be corrected before canonical frontend deployment so all three pages rely on `TEST_TENANT_LINE_UID` server-side.

### Tenant Bills

```text
tenant-bills.html
  → JSONP v2_action=tenant_bills
  → 程式碼.js doGet(e)
  → resolveTenantRequestLineUserId_(e, "tenant_bills", line_user_id)
  → getTenantBillsByLineUid(lineUserId)
  → getTenantBillsRuntimePayloadByLineUid_(lineUserId)
  → tenantBillsRuntimeResolveIdentity_(lineUserId)
  → V2_tenants → active V2_contracts
  → V2_tenant_bill_view
  → V2_bills fallback when the view has no usable bill rows
  → tenantBillsRuntimeJsonSafeValue_(...)
  → jsonOutput_(result, callback)
  → callback(JSON payload);
```

Bills uses a dedicated identity resolver and does not depend on `V2_landlord_tenant_list_view`. The frontend includes `test=1`, so the dispatcher uses the Script Property identity.

## JSONP contract

`jsonOutput_(obj, callback)` serializes the object once. With a callback it returns JavaScript with the form:

```text
callbackName(JSON);
```

Without a callback it returns JSON. The current canonical helper therefore matches the JSONP loading strategy used by all three frontend pages.

The local read-only verifier checks:

- the three route handler functions exist;
- `test=1` resolves through the same Script Property for all three actions;
- the Home/Message shared resolver result;
- the Bills read-only payload structure and JSON serializability;
- top-level and nested bill arrays;
- callback wrapping and JavaScript MIME type;
- the relevant landlord-link candidate fields without logging a LINE UID.

It intentionally does not invoke `doGet()` or `getTenantHomeByLineUid()` because those paths can write LIFF access logs. It does not invoke message submission, bill creation, payment, repair, migration, or LINE functions.

## Tenant Bills schema comparison

### Canonical backend response

The current backend returns both compatibility and canonical fields:

```json
{
  "success": true,
  "ok": true,
  "code": "OK",
  "message": "查詢成功",
  "tenant": {},
  "bills": [],
  "items": [],
  "count": 0,
  "data": {
    "tenant": {},
    "bills": [],
    "count": 0
  }
}
```

When there are no bills, the same shape is returned with `success=true`, `ok=true`, `code=OK_EMPTY`, and empty arrays. Bill dates are normalized through the JSON-safe conversion path before output.

### Repository frontend acceptance

`tenant-bills.html` accepts:

- `ok === true` or `success === true`;
- `data.bills`;
- top-level `bills`;
- nested or top-level `items` as compatibility fallback;
- a direct array payload;
- an empty array without treating it as an API failure.

### Decision

The current canonical backend and repository frontend schemas are compatible. The known production bill and bill-view rows are present and consistent. The observed online Bills failure is therefore not explained by a missing row, an empty-array check, or the current canonical wrapping level.

The strongest verified cause is deployment identity mismatch: the frontend calls an endpoint that is not the deployment listed for the repository's canonical Apps Script project. Because the live route was not called under the no-write constraint, the exact payload emitted by that older/different endpoint remains unverified. JSONP callback failure inside that endpoint is possible but not demonstrated by the current source.

## Read-only verifier

Function: `verifyTenantDeploymentReadOnly()`  
Location: `apps-script/TESTS.js`

Expected safe output includes:

- `read_only=true`;
- no test UID value;
- Boolean test-identity checks for all three actions;
- handler-presence checks;
- canonical non-secret IDs;
- landlord-link row numbers, Workspace, tenant, contract, room, landlord, status, and update timestamp;
- Home/Message shared-resolver code;
- Bills `success`, `ok`, array presence, count, first bill summary, and JSON serialization result;
- JSONP wrapping result for all three payload shapes;
- `writes_performed=0` and `line_pushes_performed=0`.

The function must not be pushed or executed until its diff is separately approved. If approved, run it once from the Apps Script editor and redact tenant identifiers before placing output in repository documentation.

## Files that would require deployment

### Backend

The following backend changes are candidates for a separately approved deployment after review:

- `apps-script/程式碼.js`: centralized test identity and previously prepared dispatcher/runtime compatibility changes;
- `apps-script/V2_API.js`: canonical Home/Bills runtime handling and Bills payload normalization;
- `apps-script/V2_TENANT_RUNTIME_DATA_REPAIR.js`: shared canonical resolver containing the landlord-link policy, only after the Phase 46 selection change is implemented and reviewed;
- `apps-script/V2_TENANT_MESSAGES.js`: Message use of the shared resolver;
- any other dirty Apps Script dependency must be reviewed as part of the complete clasp source set before push.

`apps-script/TESTS.js` is validation-only and does not require Web App deployment for runtime behavior, though it must be pushed if the verifier is to be run in Apps Script.

### Frontend

- `tenant-home.html`: previously prepared test-query/navigation behavior;
- `tenant-bills.html`: canonical Bills response compatibility and test-query behavior;
- `tenant-message.html`: still requires a minimal change so JSONP requests preserve `test=1` and stop relying on frontend test identity data.

No frontend file is modified in Phase 45.

## Safe deployment order

1. Human-review every dirty Apps Script file and isolate the exact canonical backend push set.
2. Record the current serving Web App project, deployment ID, executable version, URL, and source rollback point privately.
3. Resolve whether the repository `.clasp.json` project or the endpoint currently embedded in HTML is the intended canonical production backend. Do not change URLs until ownership is explicitly decided.
4. Run the approved read-only verifier against the intended backend source project.
5. If landlord-link resolver remediation is approved, implement and validate it locally; do not alter Sheet rows.
6. Push the reviewed backend source to the confirmed canonical project.
7. Create an immutable Apps Script version and update the existing canonical Web App deployment while preserving its URL.
8. Smoke-test the three read-only Tenant routes with a controlled test identity. Account for access-log writes in the authorization plan.
9. After backend success, publish the reviewed frontend changes to GitHub Pages.
10. Re-run the five observed real-device cases and security/isolation checks. Do not mark PASS before direct observation.

## Rollback

- Preserve a complete source pull and the prior immutable Apps Script version before any future push/deployment.
- Record the prior Web App deployment/version mapping privately.
- If backend verification fails, repoint the same Web App deployment to the recorded prior version; do not change the Web App URL.
- If frontend verification fails, restore the prior Git commit for the affected HTML pages.
- Do not roll back by deleting or manually rewriting landlord-link rows.
- Re-run the read-only diagnostic after rollback and retain the real-device cases as `NOT TESTED` or their previously observed failure states until retested.

## Current decision

Do not deploy. First resolve backend deployment ownership and approve the deterministic landlord-link selection design in `docs/46-TENANT-LINK-REMEDIATION-PLAN.md`.

