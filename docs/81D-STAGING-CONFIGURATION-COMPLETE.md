# Phase 81D — Staging Configuration Complete

Date: 2026-07-21  
Branch: `chore/v2-production-consolidation`  
Status: **BACKEND CONFIGURATION PASS — LIFF ACTIVATION PENDING**

## Objective

Complete the isolated staging backend configuration, remove the Web App HTTP 403 boundary, and preserve a fail-closed staging LIFF mapping without changing business logic or any production resource.

## Account and Resource Boundary

The authorized staging operator account is `cmwebs.saas@gmail.com`.

| Resource | Result |
|---|---|
| Staging Spreadsheet | Existing schema-only staging workbook; editable by the staging operator |
| Apps Script project | Replaced the standalone staging binding with a container-bound project owned by the staging operator |
| Project title | `CMWebs V2 STAGING BOUND 2026-07-21` |
| Masked Script ID | `1ZfX86…k23T` |
| Local clasp binding | `release/staging/.clasp.json` (ignored by Git) |
| Source root | `release/staging/apps-script/` |
| Production binding | Unchanged |

The container-bound project is required because the current runtime uses `SpreadsheetApp.getActiveSpreadsheet()` through `runtimeSpreadsheet_()` on multiple production paths. Binding the staging backend to the staging workbook preserves existing behavior and avoids a staging-only business-logic fork.

The earlier standalone staging project and its deployment were not deleted. They are no longer the canonical staging binding.

## Staging Source Push

The Phase 80 artifact was pushed only to the new container-bound staging project:

- JavaScript modules: 30;
- manifest: 1;
- total pushed files: 31;
- excluded: `TESTS.js`, repair modules, migration modules, diagnostics and credential files;
- runtime/API schema changes: none in Phase 81D.

## Script Properties

Configured remotely in Project Settings:

| Property key | Purpose | Status |
|---|---|---|
| `CMWEBS_SPREADSHEET_ID` | Explicit staging workbook reference for runtime paths and triggers that cannot rely on an active workbook | SET |
| `CMWEBS_ENVIRONMENT` | Non-secret environment marker | SET to `staging` |

Intentionally not configured:

- `TEST_TENANT_LINE_UID` and `TEST_LANDLORD_LINE_UID`: no approved staging identities were supplied;
- `LINE_CHANNEL_ACCESS_TOKEN`: staging LINE channel is not yet approved;
- ECPay properties: no sandbox credentials were supplied;
- production credentials, IDs and UIDs: never reused.

No placeholder value was written to Script Properties.

## Web App Deployment

The canonical staging Web App deployment was created from the bound project and the endpoint mapping was updated only in ignored staging-local files.

| Check | Result |
|---|---|
| Source version | Immutable version 1 |
| Execute as | Deploying staging owner |
| Access | Anyone / anonymous Web App access |
| Masked deployment token | `AKfycb…lULQ8g` |
| HTTP availability | PASS — HTTP 200 |
| Content type | PASS — `application/json; charset=utf-8` |
| `doGet` execution | PASS |
| Anonymous request without LINE UID | Expected read-only `MISSING_LINE_UID` response |
| Previous HTTP 403 | RESOLVED |

An additional immutable staging version 2 was created by the interrupted UI authorization flow. It is not referenced by the staging frontend and was not selected as canonical. It was retained for auditability and not deleted.

The verified version 1 endpoint is recorded only in:

```text
release/staging/.staging-resources.local.json
release/staging/frontend/cmweb-env.local.js
```

Both files are ignored by Git.

## LIFF Staging Placeholder

The tracked placeholder mapping is:

```text
release/staging/frontend/liff-staging.config.example.json
```

It defines separate staging placeholders for:

- LIFF ID;
- staging frontend endpoint URL;
- callback URL.

The runtime local override continues to fail closed while the staging LIFF ID and staging test identity are missing. No production LIFF ID, callback or LINE credential was copied.

## Configuration Completeness

| Boundary | Result |
|---|---|
| Correct staging Google account | PASS |
| Staging workbook access | PASS |
| Container-bound Apps Script project | PASS |
| Staging clasp binding | PASS |
| Phase 80 source present | PASS |
| Required backend Script Properties | PASS |
| Web App anonymous endpoint | PASS — HTTP 200 |
| HTTP 403 removal | PASS |
| Environment-separated frontend endpoint | PASS |
| LIFF placeholder mapping | PASS |
| Actual staging LIFF application | PENDING — not supplied/created |
| Approved staging test UID | PENDING — not supplied |
| LINE/ECPay staging credentials | INTENTIONALLY UNSET |

Backend staging configuration is complete and reachable. End-to-end LIFF smoke testing remains blocked until an isolated staging LIFF app and approved staging test identity are provided.

## Manual LIFF Activation

1. Create or select a LIFF app in a staging/test LINE Developers channel.
2. Point its endpoint and callback only to the staging frontend.
3. Populate `release/staging/frontend/cmweb-env.local.js` with the staging LIFF ID.
4. Set `TEST_TENANT_LINE_UID` only after an approved staging test identity exists.
5. Leave production LIFF, production UID and production LINE token unchanged.
6. Re-run staging-only bind, home, bills and message smoke tests.

## Validation and Safety

- Repository `npm run validate`: **PASS** — 68 unique routes and 68/68 handler coverage.
- Staging backend validation: **PASS** — 30 Apps Script files, 68 unique routes, 68/68 handlers, no duplicate declarations and no blocking credential finding.
- Phase 80 and staging backend trees: **IDENTICAL** by recursive content comparison.
- Staging frontend link audit: five links target `tenant-contract.html` or `tenant-payment-report.html`, which are outside the Phase 80 four-page staging artifact. This does not affect endpoint availability, but must be resolved before a complete cross-page staging regression run.
- `git diff --check`: **PASS**.
- The public staging Web App endpoint returns HTTP 200 and reaches `doGet`.
- The endpoint availability request omitted a LINE UID and performed no repair, migration, payment, LINE push or Sheet write.
- No business logic, API schema or Sheet schema was changed.
- No production Script Property, Apps Script project, deployment, Sheet, Web App endpoint, LIFF configuration or credential was modified.
- No commit or Git push was performed.
