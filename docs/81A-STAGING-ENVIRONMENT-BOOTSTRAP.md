# Phase 81A — Staging Environment Bootstrap

Date: 2026-07-21  
Branch: `chore/v2-production-consolidation`  
Status: **BOOTSTRAPPED — CONFIGURATION REQUIRED; NOT PUSHED OR DEPLOYED**

## Objective

Create a fail-closed staging deployment boundary from the Phase 80 release artifact. This phase separates staging deployment configuration from production without changing Apps Script business logic, API routes, response schemas or canonical frontend behavior.

## Staging Boundary

```text
release/staging/
├── .clasp.json                         # ignored invalid placeholder
├── appsscript.json                     # review copy
├── README.md
├── apps-script/
│   ├── appsscript.json                 # actual clasp manifest
│   ├── V2_RUNTIME_SNAPSHOT.js
│   ├── 程式碼.js
│   └── 其餘 28 個 production JavaScript modules
└── frontend/
    ├── cmweb-env.js                    # tracked fail-closed loader
    ├── cmweb-env.local.js              # ignored local staging values
    ├── cmweb-env.local.js.example      # placeholder template
    ├── tenant-bind.html
    ├── tenant-home.html
    ├── tenant-bills.html
    └── tenant-message.html
```

### Source provenance

- `apps-script/` is a byte-for-byte copy of `release/phase80/apps-script/`.
- The four HTML files began as byte-for-byte Phase 80 copies.
- Staging-only HTML changes are limited to loading the local environment file and reading `API_URL`, `LIFF_ID` and `TEST_LINE_USER_ID` from `window.CMWEB_RUNTIME_CONFIG`.
- The production endpoint, production LIFF ID and production test identity are absent from the staging HTML copies.
- Canonical repository HTML and `release/phase80` were not modified.

### Clasp boundary

The local file `release/staging/.clasp.json` contains:

```json
{
  "scriptId": "__REQUIRED_STAGING_SCRIPT_ID__",
  "rootDir": "apps-script"
}
```

The placeholder is intentionally invalid. It prevents an accidental push until an authorized operator supplies the verified staging Script ID. `.gitignore` already excludes every `.clasp.json`, so the real ID must remain local.

The root-level `appsscript.json` is a requested review copy. Only `release/staging/apps-script/appsscript.json` is inside the clasp `rootDir` and eligible for a future push.

## Required Staging Information

### 1. Apps Script Script ID

Required evidence:

- staging project name;
- masked Script ID and SHA-256 fingerprint;
- explicit confirmation that it differs from the verified production Script ID;
- authorized owner/operator;
- existing staging deployments and immutable rollback version, if any;
- installable trigger inventory.

Storage rule: the full Script ID exists only in the ignored local `.clasp.json`. It must not be copied into Git or this document.

### 2. Spreadsheet ID

Required evidence:

- a dedicated staging spreadsheet;
- confirmation that it is not the production spreadsheet;
- schema compatibility with the Phase 80 backend;
- staging-only Workspace, tenant, contract, room and bill fixtures;
- permission for the staging Apps Script executing account.

The staging Spreadsheet ID must be stored only in the staging project's Script Properties under `CMWEBS_SPREADSHEET_ID`. It must not be added to source or frontend configuration.

### 3. Properties namespace

Apps Script Properties are isolated by Script project. The staging project itself is the namespace boundary; production and staging must never share a Script project.

Expected keys used by the Phase 80 runtime are:

| Key | Staging requirement | Purpose |
|---|---|---|
| `CMWEBS_SPREADSHEET_ID` | Required | Dedicated staging spreadsheet |
| `TEST_TENANT_LINE_UID` | Required for approved Tenant test flow | Staging test tenant identity |
| `TEST_LANDLORD_LINE_UID` | Required only for approved landlord test flow | Staging test landlord identity |
| `LINE_CHANNEL_ACCESS_TOKEN` | Disabled or staging/test channel only | LINE notification API |
| `ECPAY_MERCHANT_ID` | Sandbox only or unset | ECPay payment functions |
| `ECPAY_HASH_KEY` | Sandbox only or unset | ECPay signing |
| `ECPAY_HASH_IV` | Sandbox only or unset | ECPay signing |

No actual value is stored in the repository. ECPay values are lazy-loaded; leaving them unset blocks payment functions without blocking read-only Tenant routes. LINE push tests remain prohibited until a staging-only channel is independently verified.

### 4. LINE LIFF staging endpoint

Required evidence:

- staging LIFF ID;
- LIFF endpoint URL pointing to the staging frontend host/path;
- callback URL allow-list entry;
- staging Web App URL associated with the staging Apps Script deployment;
- staging/test LINE channel ownership and access policy;
- approved staging test UID.

The ignored local file `release/staging/frontend/cmweb-env.local.js` holds these staging-only frontend values:

```javascript
window.CMWEB_ENV_OVERRIDES = Object.freeze({
  apiUrl: '__REQUIRED_STAGING_WEB_APP_URL__',
  liffId: '__REQUIRED_STAGING_LIFF_ID__',
  testLineUserId: '__REQUIRED_STAGING_TEST_LINE_UID__'
});
```

`cmweb-env.js` validates all three values. Missing or placeholder values throw a configuration error before any API or LIFF request. There is no fallback to production.

## Production / Staging Separation

| Concern | Production | Staging |
|---|---|---|
| Source artifact | `release/phase80` | Copy under `release/staging` |
| Apps Script binding | Verified production binding, untouched | Ignored local placeholder pending staging ID |
| Spreadsheet | Production Script Property | Dedicated staging Script Property |
| Web App endpoint | Existing production endpoint in canonical HTML | Local environment override only |
| LIFF | Existing production LIFF | Dedicated staging LIFF ID and callback |
| Test identity | Production-approved configuration | Dedicated staging test UID |
| Credentials | Production Script Properties | Staging/sandbox values or unset |
| Deployment | Existing production Web App | Separate staging Web App only |

The staging frontend cannot silently fall back to production. The staging backend cannot be pushed while the placeholder Script ID remains.

## Deployment Checklist

### A. Environment approval

- [ ] Verify staging Script ID privately and replace only the ignored placeholder.
- [ ] Confirm staging Script ID fingerprint differs from production.
- [ ] Confirm staging Spreadsheet ID and schema.
- [ ] Confirm staging Script Properties are configured without copying production secrets.
- [ ] Confirm staging LINE/LIFF channel and callback URL.
- [ ] Confirm payment credentials are sandbox-only or absent.
- [ ] Confirm no trigger can access production Sheets or send production LINE messages.

### B. Artifact integrity

- [ ] Compare all 31 files under `release/staging/apps-script/` with Phase 80 SHA-256 values.
- [ ] Confirm exactly 30 JavaScript modules plus `appsscript.json`.
- [ ] Confirm `TESTS.js`, repair, migration, validation and legacy modules are absent.
- [ ] Confirm no `.clasprc.json`, OAuth credential or token file exists.
- [ ] Run isolated Apps Script validation: 68 routes and 68/68 handlers.
- [ ] Run `npm run validate` from repository root.

### C. Binding preflight

- [ ] Run `clasp status` only after replacing the placeholder with the verified staging Script ID.
- [ ] Confirm `rootDir` is `apps-script`.
- [ ] Confirm the tracked clasp payload is exactly the 31 approved backend files.
- [ ] Inventory existing staging versions and deployments for rollback.
- [ ] Stop immediately if the target matches the production fingerprint.

### D. Future staging push and deployment

- [ ] Obtain a separate explicit approval for `clasp push`.
- [ ] Push only from `release/staging/` using its verified local binding.
- [ ] Review the remote file inventory after push.
- [ ] Create or update only the staging Web App deployment.
- [ ] Record masked deployment ID, version, execute-as and access settings.
- [ ] Do not update or delete any production deployment.

### E. Frontend and smoke tests

- [ ] Populate ignored `cmweb-env.local.js` with staging-only values.
- [ ] Publish the staging frontend to the approved staging host.
- [ ] Confirm network requests use the staging endpoint fingerprint.
- [ ] Verify `tenant-bind.html` opens and LIFF callback returns correctly.
- [ ] Run approved staging tests for binding, `tenant_home`, `tenant_bills` and `tenant_message_init`.
- [ ] Review Apps Script execution logs for errors.
- [ ] Record actual PASS/FAIL/BLOCKED results; do not prefill PASS.

### F. Rollback

- [ ] Record the pre-push staging source/version.
- [ ] Repoint only the staging deployment to its prior immutable version if smoke testing fails.
- [ ] Restore the prior staging frontend environment file and HTML publication.
- [ ] Re-run endpoint and Tenant read-only checks.
- [ ] Never use the production deployment as a staging rollback target.

## Validation and Safety Checks

Required before Phase 81 resumes:

- JavaScript syntax for all 30 Apps Script modules;
- inline JavaScript syntax for four staging HTML files;
- `cmweb-env.js` and local-template syntax;
- no production endpoint, production LIFF ID or production hardcoded test UID in staging HTML;
- backend equality with Phase 80;
- `.clasp.json` and `cmweb-env.local.js` ignored by Git;
- `npm run validate`: PASS;
- `git diff --check`: PASS.

## Current Gate

Staging structure is ready, but the environment remains **NOT DEPLOYABLE** until the four required staging information groups are supplied and verified. `clasp push`, version creation, deployment, Sheet access and LINE actions remain blocked.

## Bootstrap Validation Results

| Check | Result |
|---|---|
| Staging backend versus Phase 80 | PASS — byte-identical 31/31 |
| Apps Script syntax | PASS — 30/30 |
| Staging HTML inline JavaScript syntax | PASS — 4/4 |
| Environment script syntax | PASS — loader, local placeholder and example |
| Production endpoint/LIFF/test UID absent from staging HTML | PASS |
| Isolated staging backend validation | PASS — 68 unique routes, 68/68 handlers |
| Duplicate top-level declarations | PASS — 0 |
| Blocking credentials / hardcoded LINE UID | PASS — 0/0 |
| Canonical `npm run validate` | PASS |
| Local `clasp status` payload inventory | PASS — 30 JavaScript modules plus manifest |
| `.clasp.json` ignored | PASS |
| `cmweb-env.local.js` ignored | PASS |
| `git diff --check` | PASS |
| Verified staging Script ID | **NOT PROVIDED** |
| Staging push/deployment | **NOT RUN** |

## No-Production-Change Declaration

Phase 81A created only the isolated staging structure, local placeholders, staging frontend configuration layer and this document. It did not modify Apps Script business logic, canonical HTML, API routes, response schemas, production bindings, production endpoints, Script Properties, Google Sheets, LIFF settings or deployments. It did not run `clasp push`, deploy, commit or Git push.
