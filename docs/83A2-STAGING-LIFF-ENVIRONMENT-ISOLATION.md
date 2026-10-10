# Phase 83A.2 — Staging LIFF Environment Isolation

## Boundary

This phase changes only the isolated staging release, staging fixtures,
Git-ignored staging configuration and staging documentation. It does not push,
deploy, create an Apps Script version, modify any Spreadsheet, rebind TSTG082,
change the existing staging UID, or modify production source/configuration.

## Production LIFF occurrence audit

The four original executable literals were top-level runtime defaults. Their
semantic consumers were:

| File | Function/use site | Classification |
|---|---|---|
| `V2_ANNOUNCEMENT_MANAGEMENT.js` | `getLandlordAnnouncementsInitByLineUid_()` → `tenant_liff_url` | Runtime navigation URL |
| `V2_ANNOUNCEMENT_MANAGEMENT.js` | `announcementBuildMessage_()` | Notification/message action URL |
| `V2_BILL_NOTIFICATIONS.js` | `getLandlordBillNotificationsInitByLineUid_()` → `tenant_liff_url` | Runtime navigation URL |
| `V2_BILL_NOTIFICATIONS.js` | `billNotificationBuildMessage_()` | Notification/message action URL |
| `V2_TENANT_CHECKIN_MANAGEMENT.js` | `getLandlordTenantCheckinsInitByLineUid_()` → `tenant_liff_url` | Runtime navigation URL |
| `V2_TENANT_CHECKIN_MANAGEMENT.js` | `tenantCheckinBuildBindingInvitation_()` | Login/binding URL |
| `V2_TENANT_CHECKIN_MANAGEMENT.js` | `tenantCheckinBuildWelcomeMessage_()` | Notification/message action URL |
| `V2_TENANT_LEASE_ONBOARDING.js` | `getLandlordTenantCreateInitByLineUid_()` → `tenant_liff_url` | Runtime navigation URL |
| `V2_TENANT_LEASE_ONBOARDING.js` | `createLandlordTenantLeaseByLineUid_()` → binding result | Login/binding URL |
| `V2_TENANT_LEASE_ONBOARDING.js` | `tenantLeaseBuildInvitationMessage_()` | Login/binding URL |

There were no production LIFF occurrences classified as test fixture,
documentation/comment or dead code in the executable staging payload.

## Canonical resolver

`release/staging/apps-script/V2_RUNTIME_ENVIRONMENT.js` is the single backend
owner of tenant LIFF resolution.

- Environment key: `CMWEBS_ENVIRONMENT` (the existing staging marker).
- LIFF key: `CMWEB_TENANT_LIFF_URL`.
- Approved staging value: the current staging LIFF URL supplied for Phase
  83A.2.
- Staging missing value: throws `STAGING_LIFF_NOT_CONFIGURED`.
- Staging malformed or non-approved value: throws `STAGING_LIFF_INVALID`.
- There is no production fallback in staging source.
- Production fixture behavior returns its configured production URL exactly;
  production source and properties remain untouched.

The resolver is lazy and does not read Script Properties during Apps Script
file loading. It can append optional parameters in sorted order with both names
and values encoded using `encodeURIComponent`, without duplicate `?` or `&`.

The lease-create path resolves the LIFF URL before its first Sheet mutation so
missing staging configuration cannot surface only after tenant/contract writes.
Public function signatures and response field names are unchanged.

## Complete staging scan

The executable scan covers staging Apps Script, staging frontend files, and
the staging hosting app/public trees. Test fixture literals and clearly marked
documentation are classified separately.

| Finding | Count | Classification |
|---|---:|---|
| Executable production LIFF URL | 0 | Cleared |
| Executable production LIFF ID | 0 | Cleared |
| Deleted/incorrect staging LIFF IDs | 0 | Cleared |
| Malformed `hanschuh` hostname | 0 | Cleared |
| Production test UID literals | 0 | Cleared |
| Production Apps Script endpoint in executable staging source | 0 | Cleared |
| Production Spreadsheet ID in executable staging source | 0 | Cleared |
| Production GitHub Pages landlord links | 11 | Existing runtime navigation/notification links; outside Phase 83A.2 scope |
| Production LINE add-friend/channel URL | 1 | Existing payment return URL; outside Phase 83A.2 scope |
| Missing linked staging tenant HTML targets | 5 references / 2 pages | Existing four-page artifact boundary; outside Phase 83A.2 scope |

The 11 production landlord-page links occur in auto-payment reminder, tenant
message, tenant check-in, tenant payment report, billing, team join,
announcement and contract-request paths. They are not tenant LIFF URLs, but
they remain a broader staging isolation risk. The LINE channel URL in the
payment response is also a broader isolation risk. Neither category was changed
because the approved Phase 83A.2 scope is limited to tenant LIFF coupling.

## Deterministic tests

`release/staging/tests/phase83a2-runtime-environment.test.js` verifies:

- all four module link builders emit the approved staging LIFF URL;
- no module message contains the production LIFF ID;
- missing and malformed staging properties fail closed;
- production fixture input is preserved exactly and never replaced by staging;
- state, tenant, bill, contract and generic parameters are encoded;
- complete executable payload scan contains no production/deleted LIFF,
  malformed hostname or hardcoded UID;
- the Phase 83A.1 ownership/rollback/idempotency suite remains green.

## Validation

| Gate | Result |
|---|---|
| Apps Script syntax | PASS |
| Phase 83A.1 regression fixtures | PASS |
| Phase 83A.2 environment-isolation fixtures | PASS |
| Executable/config/generated files scanned | 62 |
| `npm run validate` | PASS |
| `git diff --check` | PASS |
| Production checksum | Unchanged |
| TSTG082 | Unchanged; no remote write was performed |

## Release decision

The Phase 83A.2 tenant-LIFF isolation objective passes. The complete staging
payload is not yet approved for deployment because:

1. the remote staging Apps Script project must be manually given
   `CMWEB_TENANT_LIFF_URL` before push/deployment; and
2. the 11 production landlord frontend links and one production LINE channel
   URL require an explicit isolation decision or a documented staging exception;
   and
3. the isolated four-page staging frontend omits five linked tenant page
   targets (`tenant-contract.html` and `tenant-payment-report.html` references),
   which must be added or explicitly excluded before a complete frontend smoke
   test.

No push or deployment is authorized by this document.
