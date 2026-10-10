# Phase 81C — Staging Google Resources

Date: 2026-07-21  
Branch: `chore/v2-production-consolidation`  
Status: **PARTIALLY CONFIGURED — RESOURCES CREATED; ACCOUNT ALIGNMENT REQUIRED**

## Objective

Create real, isolated Google resources for CMWebs V2 staging without changing business logic, touching production deployment or reusing production credentials.

## Resources Created

### Staging Google Sheet

| Field | Result |
|---|---|
| Title | `CMWebs V2 STAGING Data 2026-07-21` |
| Type | Native Google Sheets |
| Tabs | 18 |
| Locale | `zh_TW` |
| Timezone | `Asia/Taipei` |
| Production data | None |
| Credentials or UIDs | None |
| Fixture rows | None |
| Masked Spreadsheet ID | `1ol3Ds…U-Iw` |
| Spreadsheet ID SHA-256 | `06c48cbe61bdb074db32f6b29860c6b79d1849c15fd6cdfb9b862455d9329d5d` |

The workbook contains a staging setup tab and schema-only headers for the Tenant identity, Workspace, property, room, contract, bill, runtime View, message and log paths. No production Sheet was read, copied or modified.

### Staging Apps Script project

| Field | Result |
|---|---|
| Title | `CMWebs V2 STAGING 2026-07-21` |
| Type | Standalone Apps Script |
| Masked Script ID | `19pMa6…dgsl` |
| Script ID SHA-256 | `270a3db779c4e8df585454034f201176ada94509f2f9fcb54ba8ebe4e8c7e1b3` |
| Different from verified production | Yes |
| Different from historical snapshot project | Yes |
| Local binding | `release/staging/.clasp.json` |
| Binding tracked by Git | No; ignored |
| Clasp `rootDir` | `apps-script` |

The Phase 80 backend was pushed to this new staging project only:

- Apps Script files pushed: 31;
- JavaScript modules: 30;
- manifest: 1;
- production/test/repair/migration exclusions preserved;
- canonical and production bindings were not used.

### Staging Web App deployment

| Field | Result |
|---|---|
| Deployment created | Yes |
| Version | 1 |
| Deployment inventory | `@HEAD` control deployment plus immutable version 1 Web App deployment |
| Masked deployment token | `AKfycb…LBV3w` |
| Deployment ID SHA-256 | `ca59ed8a26567248718f1c74bec4e206e2153289da835bcf04dff96b35cd9f59` |
| Endpoint stored locally | Yes, ignored frontend/resource mapping |
| Anonymous HTTP check | **FAIL — HTTP 403 / access denied** |
| Production deployment changed | No |

The deployment exists, but it is not yet usable as a staging Web App. The endpoint returns an access-denied page before `doGet`. Access/execute-as settings require verification in the owning Apps Script account.

## Local Resource Mapping

Actual staging resource identifiers are stored only in ignored local files:

```text
release/staging/.clasp.json
release/staging/.staging-resources.local.json
release/staging/frontend/cmweb-env.local.js
```

Tracked files contain placeholders or masked fingerprints only. No production ID or credential was added.

Current local mapping status:

| Mapping | Status |
|---|---|
| Staging Script ID → `.clasp.json` | Configured |
| Staging Spreadsheet ID → local property plan | Configured locally, not yet set remotely |
| Staging Web App URL → frontend `apiUrl` | Configured locally |
| Staging LIFF ID → frontend `liffId` | Missing |
| Staging test tenant UID → frontend/backend property | Missing |
| Staging LINE token | Intentionally disabled/unset |
| ECPay staging properties | Intentionally unset; sandbox only if later approved |

## Script Properties Status

Required remote property:

```text
CMWEBS_SPREADSHEET_ID = <new staging Spreadsheet ID>
```

This property is **not yet set in the staging Apps Script project**.

Reason: the Apps Script project was created under the authenticated clasp OAuth account, while the available in-app browser profile cannot access that new project. The staging Sheet was created through the connected Drive account. Cross-account ownership and Sheet sharing must be resolved explicitly before entering the Spreadsheet ID.

No temporary property setter, HTTP route, repair function or business-logic change was added to bypass this boundary.

## Account Alignment Required

An authorized operator must choose one safe resolution:

1. Sign the browser into the same Google account that owns the staging Apps Script project, then share the staging Sheet with that account as editor; or
2. Recreate the staging Apps Script project under the Google account that owns the staging Sheet, then update the ignored clasp binding after confirming the production fingerprint does not match.

Do not copy production credentials or grant access to production Sheets.

After account alignment:

1. Open the staging Apps Script project by its masked/fingerprinted identity.
2. Open Project Settings → Script Properties.
3. Add `CMWEBS_SPREADSHEET_ID` using the new staging Sheet ID.
4. Add `TEST_TENANT_LINE_UID` only after an approved staging test identity exists.
5. Leave LINE token and ECPay keys unset unless separate sandbox credentials are approved.
6. Open Deploy → Manage deployments.
7. Set the staging Web App to execute as the staging project owner and use the approved staging access level.
8. Verify the endpoint returns the Apps Script `doGet` response rather than HTTP 403.

## LIFF Configuration Status

No staging LIFF resource or staging LINE channel information was supplied. Therefore:

- `liffId` remains a fail-closed placeholder;
- `testLineUserId` remains a fail-closed placeholder;
- no LINE token was configured;
- no LINE action or callback test was executed.

Create or identify a staging LIFF app in a staging/test LINE Developers channel, set its endpoint/callback to the staging frontend, then populate the ignored local frontend mapping. Production LIFF ID and production LINE credentials must not be reused.

## Validation

| Check | Result |
|---|---|
| New staging Sheet created | PASS |
| Native Sheet conversion | PASS |
| Sheet tabs | PASS — 18 |
| Sheet timezone | PASS — `Asia/Taipei` |
| Production data absent | PASS |
| New staging Apps Script created | PASS |
| Staging Script ID differs from production | PASS |
| Phase 80 source pushed to staging | PASS — 31 files |
| Staging deployment created | PASS — version 1 |
| Web App endpoint availability | **FAIL — HTTP 403** |
| Remote `CMWEBS_SPREADSHEET_ID` | **NOT SET** |
| Staging LIFF ID | **NOT PROVIDED** |
| Staging test UID | **NOT PROVIDED** |
| Staging configuration completeness | **FAIL / incomplete** |
| Production configuration untouched | PASS |

## Safety Declaration

Phase 81C created only new staging resources and ignored staging-local mappings. It did not modify application business logic, API schema, canonical HTML, production Script Properties, production Google Sheets, production Apps Script source, production Web App deployment, production endpoint, production LIFF configuration or production credentials. No LINE or payment action was executed.
