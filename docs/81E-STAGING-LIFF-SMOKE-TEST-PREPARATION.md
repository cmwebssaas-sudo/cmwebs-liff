# Phase 81E — Staging LIFF Smoke Test Preparation

Date: 2026-07-21  
Branch: `chore/v2-production-consolidation`  
Status: **PREPARATION COMPLETE — EXTERNAL LIFF VALUES REQUIRED**

## Objective

Prepare an isolated, fail-closed staging LINE/LIFF configuration and smoke-test procedure without changing frontend behavior, Apps Script business logic, production LIFF, the production LINE channel or production credentials.

## Staging LIFF Configuration

Tracked templates:

```text
release/staging/frontend/liff-staging.config.example.json
release/staging/frontend/staging-test-uid-allowlist.example.json
release/staging/frontend/cmweb-env.local.js.example
```

Ignored local files:

```text
release/staging/frontend/liff-staging.config.local.json
release/staging/frontend/staging-test-uid-allowlist.local.json
release/staging/frontend/cmweb-env.local.js
```

The configuration remains fail closed while any value begins with `__SET_`, `__REQUIRED_` or `__OPTIONAL_`. No production value is used as a fallback.

## Required External Values

An authorized operator must supply these values from a dedicated staging/test LINE Developers channel:

| Value | Destination | Current state |
|---|---|---|
| Staging LIFF ID | `cmweb-env.local.js` and `liff-staging.config.local.json` | PLACEHOLDER |
| Staging frontend base URL | `liff-staging.config.local.json` | PLACEHOLDER |
| Approved staging tenant UID | local allowlist, `cmweb-env.local.js`, staging Script Property | PLACEHOLDER |
| Optional staging landlord UID | local allowlist and staging Script Property | PLACEHOLDER |

Production LIFF ID, production LINE channel secret/token and production test UIDs must not be copied.

## Endpoint and Callback Mapping

The dedicated staging LIFF app must use:

| Setting | Staging mapping |
|---|---|
| LIFF endpoint URL | `<staging-frontend-base>/tenant-bind.html` |
| Primary callback URL | `<staging-frontend-base>/tenant-bind.html` |
| Allowed Tenant pages | `tenant-bind.html`, `tenant-home.html`, `tenant-bills.html`, `tenant-message.html` |
| Scopes | `openid`, `profile` |
| Bot prompt | Disabled for smoke preparation |

The exact HTTPS host must be supplied before activation. A production GitHub Pages URL is not an acceptable staging placeholder.

## Test UID Allowlist

The allowlist is deny by default:

- unknown UID: denied;
- production UID reuse: denied;
- UID in URL: denied;
- LINE push during smoke test: denied;
- Sheet writes during read-only smoke checks: denied.

Before testing, the same approved staging tenant UID must be placed privately in:

1. `staging-test-uid-allowlist.local.json`;
2. `cmweb-env.local.js` as `testLineUserId`;
3. the staging Apps Script `TEST_TENANT_LINE_UID` Script Property.

Do not document or commit the full UID. Confirm equality by masked suffix or local SHA-256 comparison.

## LINE Developers Setup Checklist

- [ ] Select or create a channel explicitly marked staging/test.
- [ ] Confirm the channel is not the production LINE channel.
- [ ] Create a separate LIFF app for CMWebs staging.
- [ ] Set endpoint URL to the staging `tenant-bind.html` URL.
- [ ] Set the callback URL to the same staging origin/path.
- [ ] Enable only `openid` and `profile` scopes needed by the existing frontend.
- [ ] Copy the LIFF ID only into ignored staging-local configuration.
- [ ] Register one approved staging Tenant test identity.
- [ ] Confirm no production access token, channel secret or UID was copied.
- [ ] Confirm the staging Web App endpoint still returns HTTP 200.

## Smoke Test Checklist

All cases begin as **NOT TESTED**. Phase 81E does not mark a case PASS without actual execution.

| Case | Procedure | Expected result | Status | Evidence |
|---|---|---|---|---|
| LIFF-01 LIFF open | Open the staging LIFF URL inside LINE | Staging `tenant-bind.html` opens; no production host appears | NOT TESTED | — |
| LIFF-02 LINE user identity | Complete `liff.init()` and retrieve the profile | UID matches the private staging allowlist; UID is not shown in the URL | NOT TESTED | — |
| LIFF-03 Tenant binding | Query binding status, then follow the approved staging-only bind case | Only the staging Sheet is read/updated; no production tenant changes | NOT TESTED | — |
| LIFF-04 Tenant home | Navigate to `tenant-home.html` | Identity/property/status load from the staging endpoint | NOT TESTED | — |
| LIFF-05 Bills | Navigate to `tenant-bills.html` | Staging bill data or the canonical empty state renders without API failure | NOT TESTED | — |
| LIFF-06 Message | Navigate to `tenant-message.html` | Staging landlord contact projection loads; no LINE message is sent | NOT TESTED | — |

## Execution Order

1. Populate the ignored LIFF configuration and UID allowlist.
2. Set the matching staging Script Property.
3. Publish the four-page frontend to an approved staging-only HTTPS host.
4. Configure the staging LIFF endpoint/callback.
5. Verify endpoint availability without a UID.
6. Run LIFF-01 and LIFF-02 first.
7. Run binding only against staging fixture data.
8. Run Home, Bills and Message reads.
9. Stop immediately if a production URL, production UID, cross-workspace row or LINE push appears.

## Acceptance and Rollback

Preparation is accepted when:

- all configuration files exist;
- ignored local files remain untracked;
- staging endpoint is HTTP 200;
- canonical validation passes;
- production LIFF files and production LINE channel remain unchanged.

Rollback:

1. Disable or remove only the staging LIFF app from its staging channel.
2. Remove the ignored local LIFF/UID values.
3. Remove the staging `TEST_TENANT_LINE_UID` Script Property if it was added.
4. Restore the previous staging frontend publication.
5. Do not alter production LIFF, production frontend or production Apps Script deployment.

## Current Result

| Check | Result |
|---|---|
| Staging Web App endpoint | PASS — HTTP 200 |
| Endpoint response | PASS — Apps Script JSON response reached `doGet` |
| LIFF placeholder mapping | PASS |
| Callback placeholder mapping | PASS |
| Deny-by-default test UID allowlist | PASS |
| Local sensitive mappings ignored by Git | PASS |
| Configuration JSON syntax | PASS |
| `npm run validate` | PASS — 68 routes, 68/68 handlers |
| `git diff --check` | PASS |
| Actual staging LIFF ID | PENDING |
| Actual staging frontend HTTPS host | PENDING |
| Approved staging UID | PENDING |
| Smoke tests | NOT TESTED |
| Production LIFF/channel changed | NO |
| Business logic changed | NO |
