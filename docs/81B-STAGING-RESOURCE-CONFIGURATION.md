# Phase 81B — Staging Resource Configuration

Date: 2026-07-21  
Branch: `chore/v2-production-consolidation`  
Status: **CONFIGURATION MAPPING READY — REAL VALUES NOT PROVIDED; NOT DEPLOYABLE**

## Objective

Define the exact resource mapping and verification checklist required to turn `release/staging/` into a real, isolated CMWebs V2 staging environment without changing business logic, API routes, response schemas or any production resource.

This phase does not guess or create identifiers. No actual Script ID, Spreadsheet ID, Web App URL, LIFF ID, token or Script Property value is stored in this document.

## Placeholder Verification

The local staging clasp configuration exists at:

```text
release/staging/.clasp.json
```

Verified state:

| Field | Result |
|---|---|
| File exists | PASS |
| `scriptId` | `__REQUIRED_STAGING_SCRIPT_ID__` placeholder |
| `rootDir` | `apps-script` |
| Git ignored | PASS through `**/.clasp.json` |
| Safe for `clasp push` | **NO — placeholder is intentionally invalid** |

The staging frontend local configuration also remains unconfigured:

| Field | Current state |
|---|---|
| `apiUrl` | Placeholder |
| `liffId` | Placeholder |
| `testLineUserId` | Placeholder |
| Local file ignored | PASS |

The environment therefore fails closed and cannot silently use production.

## Environment Variable Mapping

### Resource-level mapping

| Logical resource | Source of truth | Local staging location | Remote staging location | Exposure rule | Current state |
|---|---|---|---|---|---|
| Apps Script ID | Staging Apps Script Project Settings | `release/staging/.clasp.json` → `scriptId` | Apps Script project | Keep full value local; document only masked value and fingerprint | Missing |
| Spreadsheet ID | Dedicated staging Google Sheet | Not stored in source | Script Property `CMWEBS_SPREADSHEET_ID` | Never commit; must differ from production | Missing |
| Web App URL | Staging Web App deployment | `release/staging/frontend/cmweb-env.local.js` → `apiUrl` | Apps Script Manage deployments | Local/hosting environment only; no production fallback | Missing |
| LIFF ID | Staging LINE Developers channel | `release/staging/frontend/cmweb-env.local.js` → `liffId` | LINE LIFF app | Staging LIFF only; callback must target staging frontend | Missing |
| Tenant test UID | Approved staging LINE account | `release/staging/frontend/cmweb-env.local.js` → `testLineUserId` | Script Property `TEST_TENANT_LINE_UID` | Values must privately match; never document full UID | Missing |
| Script Properties | Staging Apps Script project | Not stored in repository | Project Settings → Script Properties | Staging project is the namespace boundary | Missing |

### Apps Script Property mapping

The Phase 80 runtime reads the following exact keys. Key names cannot be prefixed or renamed without changing business logic, so environment isolation is provided by using a separate staging Apps Script project.

| Script Property key | Required for staging bootstrap | Value class | Rule |
|---|---|---|---|
| `CMWEBS_SPREADSHEET_ID` | Yes | Staging Spreadsheet ID | Must identify only the dedicated staging Sheet |
| `TEST_TENANT_LINE_UID` | Yes for `test=1` Tenant smoke tests | Staging test LINE UID | Must match frontend `testLineUserId` privately |
| `TEST_LANDLORD_LINE_UID` | Only for landlord test flows | Staging test LINE UID | Do not reuse a production landlord identity |
| `LINE_CHANNEL_ACCESS_TOKEN` | No for read-only bootstrap | Staging/test channel token | Leave unset until LINE actions are separately approved |
| `ECPAY_MERCHANT_ID` | No for Tenant read smoke tests | ECPay sandbox identifier | Never use production credentials in staging |
| `ECPAY_HASH_KEY` | No for Tenant read smoke tests | ECPay sandbox secret | Store only in Script Properties |
| `ECPAY_HASH_IV` | No for Tenant read smoke tests | ECPay sandbox secret | Store only in Script Properties |

The three ECPay properties are lazy-loaded. Leaving them unset blocks payment functions explicitly without preventing non-payment Tenant read routes from loading.

## Staging Configuration Checklist

### A. Apps Script project

- [ ] Select an existing, dedicated staging Apps Script project or create one under separate authorization.
- [ ] Confirm it is not the verified production project.
- [ ] Record its project name, masked Script ID and SHA-256 fingerprint.
- [ ] Confirm the staging operator has editor/deployer access.
- [ ] Inventory existing files, versions, deployments and installable triggers.
- [ ] Record an existing staging rollback version, or record `NONE` for a new staging project.
- [ ] Privately replace `__REQUIRED_STAGING_SCRIPT_ID__` in the ignored `.clasp.json`.
- [ ] Re-run `git check-ignore` and confirm `.clasp.json` remains ignored.
- [ ] Run `clasp status`; do not push.
- [ ] Confirm the clasp payload is exactly 30 JavaScript modules plus `appsscript.json`.

### B. Staging spreadsheet

- [ ] Identify a dedicated staging Spreadsheet.
- [ ] Privately compare its ID against the production Spreadsheet ID and confirm they differ.
- [ ] Verify the required V2 Sheet tabs and headers are schema-compatible.
- [ ] Ensure staging fixtures contain no copied production personal data unless separately authorized and sanitized.
- [ ] Grant only the staging Apps Script executing identity the required access.
- [ ] Set `CMWEBS_SPREADSHEET_ID` in the staging project Script Properties.
- [ ] Do not place the Spreadsheet ID in Git, HTML, logs or documentation.

### C. Script Properties namespace

- [ ] Open only the staging Apps Script project’s Project Settings.
- [ ] Confirm the masked Script ID before entering properties.
- [ ] Add `CMWEBS_SPREADSHEET_ID`.
- [ ] Add `TEST_TENANT_LINE_UID` for the approved staging tenant.
- [ ] Add `TEST_LANDLORD_LINE_UID` only when a landlord test is required.
- [ ] Leave `LINE_CHANNEL_ACCESS_TOKEN` unset unless a staging-only LINE channel is approved.
- [ ] Leave all ECPay properties unset unless sandbox payment testing is explicitly approved.
- [ ] If ECPay testing is approved, use sandbox values only.
- [ ] Verify no production property value was copied.
- [ ] Do not screenshot or export property values.

### D. Staging Web App

- [ ] Confirm the staging project manifest matches `release/staging/apps-script/appsscript.json`.
- [ ] After a separately approved push, create or update only a staging Web App deployment.
- [ ] Record deployment type, execute-as, access level and numeric version.
- [ ] Record only a masked deployment ID and Web App URL fingerprint.
- [ ] Confirm the Web App URL differs from production.
- [ ] Privately place the staging Web App URL in ignored `cmweb-env.local.js` as `apiUrl`.
- [ ] Do not change any production deployment or endpoint.

### E. LINE LIFF staging configuration

- [ ] Use a dedicated staging/test LINE Developers channel.
- [ ] Create or select a staging LIFF app.
- [ ] Set its endpoint to the approved staging frontend host/path.
- [ ] Add the exact staging callback URL where required.
- [ ] Confirm the LIFF app does not reference the production frontend.
- [ ] Privately place the staging LIFF ID in ignored `cmweb-env.local.js` as `liffId`.
- [ ] Privately place the approved staging tenant UID as `testLineUserId`.
- [ ] Confirm `testLineUserId` privately matches `TEST_TENANT_LINE_UID`.
- [ ] Do not place a complete UID in filenames, reports or screenshots.

### F. Cross-resource consistency

- [ ] Staging `.clasp.json` Script ID matches the staging Apps Script project.
- [ ] Staging Web App deployment belongs to that same Script project.
- [ ] `CMWEBS_SPREADSHEET_ID` points to the dedicated staging Sheet.
- [ ] Staging test tenant rows belong only to staging Workspace data.
- [ ] Frontend `apiUrl` points to the staging deployment.
- [ ] Frontend `liffId` points to the staging LIFF app.
- [ ] LIFF endpoint/callback points to the staging frontend.
- [ ] Frontend test UID equals the backend test tenant property privately.
- [ ] No staging resource equals its production counterpart.

## Required Non-sensitive Evidence

Supply only the following for review:

```text
staging_project_name: ...
masked_staging_script_id: first6…last4
staging_script_id_sha256: ...
script_id_differs_from_production: YES / NO
masked_spreadsheet_id: first6…last4
spreadsheet_id_differs_from_production: YES / NO
staging_schema_verified: YES / NO
script_properties_keys_configured: comma-separated key names only
production_property_values_copied: NO
masked_web_app_deployment_id: first6…last4 / NONE
web_app_url_sha256: ... / NONE
web_app_differs_from_production: YES / NO
masked_liff_id: first4…last4
liff_callback_points_to_staging: YES / NO
test_uid_frontend_backend_match: YES / NO
line_push_disabled_or_staging_only: YES / NO
ecpay_unset_or_sandbox_only: YES / NO
```

Do not provide complete IDs, URLs, UIDs, tokens, credentials, property values, account emails or Sheet data.

## Validation Gate Before Push

- [ ] All required non-sensitive evidence is complete.
- [ ] `.clasp.json` and `cmweb-env.local.js` remain ignored.
- [ ] Placeholder scan returns zero required placeholders in the two local configuration files.
- [ ] Production endpoint, LIFF ID and test UID scan returns zero in staging frontend HTML/config.
- [ ] Backend remains byte-identical with Phase 80: 31/31.
- [ ] Apps Script syntax passes: 30/30.
- [ ] Isolated routes pass: 68 unique, handlers 68/68.
- [ ] Frontend inline JavaScript syntax passes: 4/4.
- [ ] `npm run validate` passes.
- [ ] `git diff --check` passes.
- [ ] A separate explicit `clasp push` approval is obtained.

## Current Decision

The resource mapping and checklist are complete, but real staging values have not been provided. The environment remains **NOT CONFIGURED** and **NOT SAFE TO PUSH**. The next safe action is private entry and verification of the staging resource values, followed by read-only `clasp status` and consistency checks.

## No-change Declaration

Phase 81B adds documentation only. It does not modify business logic, Apps Script source, frontend behavior, API schema, manifest, placeholders, Script Properties, Google Sheets, LINE configuration, Web App configuration or production resources. It does not execute `clasp push`, deploy, commit or Git push.
